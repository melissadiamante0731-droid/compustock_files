"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { HttpError } = require("./errors");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "LOGIN_RATE_LIMIT", message: "Too many sign-in attempts. Try again later." } }
});

function requireAuth(req, res, next) {
  if (!req.session.user) return next(new HttpError(401, "Sign in is required.", "AUTH_REQUIRED"));
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return next(new HttpError(401, "Sign in is required.", "AUTH_REQUIRED"));
    if (!roles.includes(req.session.user.role)) {
      return next(new HttpError(403, "You do not have permission to perform this action.", "FORBIDDEN"));
    }
    next();
  };
}

function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const supplied = req.get("X-CSRF-Token");
  const expectedBuffer = Buffer.from(expected || "");
  const suppliedBuffer = Buffer.from(supplied || "");
  if (!expected || !supplied || expectedBuffer.length !== suppliedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return next(new HttpError(403, "A valid CSRF token is required.", "CSRF_INVALID"));
  }
  next();
}

function registerAuthRoutes(app, pool) {
  app.get("/api/v1/auth/csrf", (req, res) => {
    req.session.csrfToken ||= crypto.randomBytes(32).toString("hex");
    res.json({ csrfToken: req.session.csrfToken });
  });

  app.post("/api/v1/auth/login", loginLimiter, async (req, res, next) => {
    try {
      const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body.password === "string" ? req.body.password : "";
      if (!username || !password || username.length > 100 || password.length > 200) {
        throw new HttpError(400, "A valid username and password are required.", "INVALID_CREDENTIALS");
      }

      const [rows] = await pool.execute(
        "SELECT id, username, password_hash, role FROM users WHERE username = ? AND is_active = 1 LIMIT 1",
        [username]
      );
      const user = rows[0];
      const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
      if (!valid) throw new HttpError(401, "Invalid username or password.", "LOGIN_FAILED");

      await new Promise((resolve, reject) => {
        req.session.regenerate(error => error ? reject(error) : resolve());
      });
      req.session.user = { id: user.id, username: user.username, role: user.role };
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/auth/logout", requireAuth, (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie("compustock.sid");
      res.status(204).end();
    });
  });

  app.get("/api/v1/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.session.user });
  });
}

module.exports = { requireAuth, requireRoles, requireCsrf, registerAuthRoutes };
