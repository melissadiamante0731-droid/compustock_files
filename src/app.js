"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { errorHandler, HttpError } = require("./errors");
const { requireCsrf, registerAuthRoutes } = require("./auth");
const { registerCommerceRoutes } = require("./commerce");
const { MySqlSessionStore } = require("./session-store");

function createApp({ pool, config }) {
  const app = express();
  const sessionStore = new MySqlSessionStore(pool);

  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"]
      }
    }
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use(session({
    name: "compustock.sid",
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000
    }
  }));
  app.use("/api/v1", requireCsrf);

  app.get("/api/v1/health", async (req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (error) {
      next(new HttpError(503, "Database is unavailable.", "DATABASE_UNAVAILABLE"));
    }
  });

  registerAuthRoutes(app, pool);
  registerCommerceRoutes(app, pool);
  app.use("/api", (req, res, next) => next(new HttpError(404, "API route not found.", "NOT_FOUND")));
  const staticFiles = express.static(path.resolve(__dirname, ".."), {
    index: false,
    dotfiles: "deny",
    fallthrough: true
  });
  app.get("/", (req, res, next) => {
    res.sendFile(path.resolve(__dirname, "..", "index.html"), error => {
      if (error) next(error);
    });
  });
  app.get(["/index.html", "/script.js", "/style.css"], staticFiles);
  app.use((req, res, next) => next(new HttpError(404, "Page not found.", "NOT_FOUND")));
  app.use(errorHandler);

  return { app, sessionStore };
}

module.exports = { createApp };
