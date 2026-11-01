"use strict";

require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const { readConfig } = require("./config");
const { createPool } = require("./db");

async function main() {
  const pool = createPool(readConfig());
  const sql = await fs.readFile(path.join(__dirname, "..", "migrations", "001-initial.sql"), "utf8");
  const statements = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const [existing] = await connection.execute(
      "SELECT version FROM schema_migrations WHERE version = ?",
      ["001-initial"]
    );
    if (existing.length) {
      console.log("Migration 001-initial is already applied.");
      return;
    }
    for (const statement of statements) await connection.query(statement);
    await connection.execute("INSERT INTO schema_migrations (version) VALUES (?)", ["001-initial"]);
    console.log("Applied migration 001-initial.");
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
