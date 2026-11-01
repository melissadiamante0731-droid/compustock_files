"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readConfig } = require("../src/config");
const { centsToDecimal, moneyToCents, parsePaymentAmount, validateItems } = require("../src/commerce");

const validEnv = {
  SESSION_SECRET: "a-secure-session-secret-that-is-at-least-32-characters",
  DB_HOST: "localhost",
  DB_NAME: "compustock",
  DB_USER: "app",
  DB_PASSWORD: "password"
};

test("configuration requires secrets and valid numeric settings", () => {
  assert.throws(() => readConfig({}), /Missing required/);
  assert.throws(() => readConfig({ ...validEnv, PORT: "not-a-port" }), /invalid/);
  assert.throws(() => readConfig({ ...validEnv, NODE_ENV: "production" }), /must be true in production/);
  assert.equal(readConfig({ ...validEnv, NODE_ENV: "production", SESSION_COOKIE_SECURE: "true" }).secureCookies, true);
  assert.equal(readConfig(validEnv).port, 3000);
});

test("money conversion uses exact cents and rejects invalid precision", () => {
  assert.equal(moneyToCents("1299.95"), 129995n);
  assert.equal(centsToDecimal(129995n), "1299.95");
  assert.throws(() => moneyToCents("1.999"), /Invalid monetary value/);
  assert.throws(() => parsePaymentAmount(undefined), /cash amount/);
  assert.throws(() => parsePaymentAmount("1.999"), /two decimal places/);
});

test("cart validation rejects duplicate products, fractions, and invalid identifiers", () => {
  assert.deepEqual(validateItems([{ productId: 3, quantity: 2 }]), [{ productId: 3, quantity: 2 }]);
  assert.throws(() => validateItems([{ productId: 3, quantity: 1 }, { productId: 3, quantity: 1 }]), /unique ID/);
  assert.throws(() => validateItems([{ productId: 3, quantity: 1.5 }]), /whole-number/);
});
