"use strict";

const { HttpError } = require("./errors");
const { requireAuth, requireRoles } = require("./auth");

function moneyToCents(value) {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new HttpError(500, "Invalid monetary value in database.", "INVALID_DB_MONEY");
  return BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
}

function centsToDecimal(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function parsePaymentAmount(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new HttpError(400, "A valid cash amount is required.", "INVALID_PAYMENT");
  }
  const amount = String(value);
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) {
    throw new HttpError(400, "Enter a valid cash amount with at most two decimal places.", "INVALID_PAYMENT");
  }
  return moneyToCents(amount);
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new HttpError(400, "Provide between 1 and 100 cart items.", "INVALID_ITEMS");
  }
  const seen = new Set();
  return items.map(item => {
    const productId = Number(item && item.productId);
    const quantity = Number(item && item.quantity);
    if (!Number.isSafeInteger(productId) || productId < 1 ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000 ||
        seen.has(productId)) {
      throw new HttpError(400, "Each product must have a unique ID and a whole-number quantity.", "INVALID_ITEMS");
    }
    seen.add(productId);
    return { productId, quantity };
  });
}

async function transaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function registerCommerceRoutes(app, pool) {
  app.get("/api/v1/products", async (req, res, next) => {
    try {
      const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
      const requestedLimit = Number(req.query.limit);
      const requestedPage = Number(req.query.page);
      const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100) : 24;
      const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage : 1;
      const offset = (page - 1) * limit;
      const pattern = `%${search}%`;
      const [rows] = await pool.execute(
        `SELECT p.id, p.name, p.brand, p.model, p.sku, p.description, p.specifications,
                p.price, p.stock, p.reorder_level, c.name AS category
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1 AND (? = '' OR p.name LIKE ? OR p.brand LIKE ?
               OR p.model LIKE ? OR p.sku LIKE ? OR p.specifications LIKE ? OR c.name LIKE ?)
         ORDER BY p.name LIMIT ? OFFSET ?`,
        [search, pattern, pattern, pattern, pattern, pattern, pattern, limit, offset]
      );
      res.json({ products: rows, page, limit });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/inventory/movements", requireAuth, requireRoles("Admin", "Owner"), async (req, res, next) => {
    try {
      const productId = Number(req.body.productId);
      const type = req.body.type;
      const quantity = Number(req.body.quantity);
      const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
      if (!Number.isSafeInteger(productId) || productId < 1 ||
          !["stock_in", "stock_out", "adjustment"].includes(type) ||
          !Number.isSafeInteger(quantity) || quantity < 0 ||
          (type !== "adjustment" && quantity < 1) || !reason || reason.length > 500) {
        throw new HttpError(400, "Provide a valid product, movement type, quantity, and reason.", "INVALID_MOVEMENT");
      }

      const movement = await transaction(pool, async connection => {
        const [products] = await connection.execute(
          "SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE",
          [productId]
        );
        if (!products.length) throw new HttpError(404, "Product not found.", "PRODUCT_NOT_FOUND");
        const product = products[0];
        const before = product.stock;
        const after = type === "stock_in" ? before + quantity
          : type === "stock_out" ? before - quantity : quantity;
        if (after < 0) throw new HttpError(409, "Insufficient stock for this movement.", "INSUFFICIENT_STOCK");
        await connection.execute("UPDATE products SET stock = ? WHERE id = ?", [after, productId]);
        const [result] = await connection.execute(
          `INSERT INTO inventory_movements
             (product_id, actor_user_id, movement_type, quantity, stock_before, stock_after, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [productId, req.session.user.id, type, Math.abs(after - before), before, after, reason]
        );
        await connection.execute(
          "INSERT INTO activity_logs (actor_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)",
          [req.session.user.id, "inventory_movement", "product", productId, reason]
        );
        return { id: result.insertId, productId, before, after, type };
      });
      res.status(201).json({ movement });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/pos/sales", requireAuth, requireRoles("Admin", "Owner", "Cashier"), async (req, res, next) => {
    try {
      const items = validateItems(req.body.items);
      const paymentMethod = req.body.paymentMethod;
      const cashReceived = req.body.cashReceived;
      if (!["cash", "card", "bank_transfer", "other"].includes(paymentMethod)) {
        throw new HttpError(400, "Select a supported payment method.", "INVALID_PAYMENT_METHOD");
      }
      const idempotencyKey = req.get("Idempotency-Key");
      if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)) {
        throw new HttpError(400, "A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED");
      }

      let sale;
      try {
        sale = await transaction(pool, async connection => {
        const [existing] = await connection.execute(
          "SELECT id, receipt_number, total, payment_status FROM sales WHERE idempotency_key = ?",
          [idempotencyKey]
        );
        if (existing.length) {
          const previous = existing[0];
          return {
            id: previous.id,
            receiptNumber: previous.receipt_number,
            total: previous.total,
            paymentStatus: previous.payment_status,
            duplicate: true
          };
        }

        const snapshots = [];
        let totalCents = 0n;
        for (const item of items) {
          const [rows] = await connection.execute(
            "SELECT id, name, sku, price, cost, stock FROM products WHERE id = ? AND is_active = 1 FOR UPDATE",
            [item.productId]
          );
          if (!rows.length) throw new HttpError(404, "A requested product is unavailable.", "PRODUCT_UNAVAILABLE");
          const product = rows[0];
          if (product.stock < item.quantity) {
            throw new HttpError(409, `Insufficient stock for ${product.name}.`, "INSUFFICIENT_STOCK");
          }
          const unitPriceCents = moneyToCents(product.price);
          const unitCostCents = moneyToCents(product.cost);
          totalCents += unitPriceCents * BigInt(item.quantity);
          snapshots.push({ ...product, quantity: item.quantity, unitPriceCents, unitCostCents });
        }

        if (paymentMethod === "cash") {
          const receivedCents = parsePaymentAmount(cashReceived);
          if (receivedCents < totalCents) throw new HttpError(400, "Cash received cannot be less than the sale total.", "INSUFFICIENT_PAYMENT");
        } else if (cashReceived !== undefined && cashReceived !== null && cashReceived !== "") {
          throw new HttpError(400, "Cash received is only valid for cash payments.", "INVALID_PAYMENT");
        }

        const receiptNumber = `CS-${Date.now()}-${require("node:crypto").randomBytes(3).toString("hex").toUpperCase()}`;
        const [saleResult] = await connection.execute(
          `INSERT INTO sales (receipt_number, idempotency_key, actor_user_id, source, subtotal, total, payment_status)
           VALUES (?, ?, ?, 'pos', ?, ?, 'paid')`,
          [receiptNumber, idempotencyKey, req.session.user.id, centsToDecimal(totalCents), centsToDecimal(totalCents)]
        );

        for (const item of snapshots) {
          const before = item.stock;
          const after = before - item.quantity;
          await connection.execute("UPDATE products SET stock = ? WHERE id = ?", [after, item.id]);
          await connection.execute(
            `INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleResult.insertId, item.id, item.name, item.sku, item.quantity,
              centsToDecimal(item.unitPriceCents), centsToDecimal(item.unitCostCents)]
          );
          await connection.execute(
            `INSERT INTO inventory_movements
               (product_id, actor_user_id, movement_type, quantity, stock_before, stock_after, reason)
             VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
            [item.id, req.session.user.id, item.quantity, before, after, receiptNumber]
          );
        }
        await connection.execute(
          "INSERT INTO payments (sale_id, payment_method, amount, status) VALUES (?, ?, ?, 'paid')",
          [saleResult.insertId, paymentMethod, centsToDecimal(totalCents)]
        );
        await connection.execute(
          "INSERT INTO activity_logs (actor_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)",
          [req.session.user.id, "pos_sale_completed", "sale", saleResult.insertId, receiptNumber]
        );
        return {
          id: saleResult.insertId, receiptNumber, total: centsToDecimal(totalCents),
          paymentStatus: "paid", change: paymentMethod === "cash"
            ? centsToDecimal(parsePaymentAmount(cashReceived) - totalCents) : "0.00"
        };
        });
      } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") throw error;
        const [existing] = await pool.execute(
          "SELECT id, receipt_number, total, payment_status FROM sales WHERE idempotency_key = ?",
          [idempotencyKey]
        );
        if (!existing.length) throw error;
        const previous = existing[0];
        sale = {
          id: previous.id,
          receiptNumber: previous.receipt_number,
          total: previous.total,
          paymentStatus: previous.payment_status,
          duplicate: true
        };
      }

      res.status(sale.duplicate ? 200 : 201).json({ sale });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerCommerceRoutes, moneyToCents, centsToDecimal, parsePaymentAmount, validateItems };
