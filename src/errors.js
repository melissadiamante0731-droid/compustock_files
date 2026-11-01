"use strict";

class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: "error",
      message: error.message,
      method: req.method,
      path: req.path,
      requestId: req.requestId
    }));
  }
  res.status(status).json({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: status >= 500 ? "An unexpected server error occurred." : error.message,
      requestId: req.requestId
    }
  });
}

module.exports = { HttpError, errorHandler };
