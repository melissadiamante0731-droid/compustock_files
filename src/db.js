"use strict";

const mysql = require("mysql2/promise");

function createPool(config) {
  return mysql.createPool({
    ...config.database,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true
  });
}

module.exports = { createPool };
