"use strict";

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { readConfig } = require("./config");
const { createPool } = require("./db");

async function main() {
  const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env;
  if (!username || !password || password.length < 12) {
    throw new Error("Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters.");
  }
  const pool = createPool(readConfig());
  try {
    const [result] = await pool.execute(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'Admin')",
      [username.trim(), await bcrypt.hash(password, 12)]
    );
    console.log(`Provisioned administrator account ID ${result.insertId}. Remove the bootstrap credentials from the environment.`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Administrator provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
