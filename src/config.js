"use strict";

function readConfig(env = process.env) {
  const required = ["SESSION_SECRET", "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter(key => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  if (env.NODE_ENV === "production" && env.SESSION_COOKIE_SECURE !== "true") {
    throw new Error("SESSION_COOKIE_SECURE must be true in production.");
  }

  const port = Number(env.PORT || 3000);
  const dbPort = Number(env.DB_PORT || 3306);
  const connectionLimit = Number(env.DB_CONNECTION_LIMIT || 10);
  if (![port, dbPort, connectionLimit].every(Number.isInteger) ||
      port < 1 || port > 65535 || dbPort < 1 || dbPort > 65535 || connectionLimit < 1) {
    throw new Error("PORT, DB_PORT, or DB_CONNECTION_LIMIT is invalid.");
  }

  return {
    nodeEnv: env.NODE_ENV || "development",
    port,
    sessionSecret: env.SESSION_SECRET,
    secureCookies: env.SESSION_COOKIE_SECURE === "true",
    database: {
      host: env.DB_HOST,
      port: dbPort,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectionLimit,
      timezone: "Z",
      decimalNumbers: false
    }
  };
}

module.exports = { readConfig };
