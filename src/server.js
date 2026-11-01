"use strict";

require("dotenv").config();
const { readConfig } = require("./config");
const { createPool } = require("./db");
const { createApp } = require("./app");

async function main() {
  const config = readConfig();
  const pool = createPool(config);
  await pool.query("SELECT 1");
  const { app } = createApp({ pool, config });
  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({ level: "info", message: "CompuStock server listening", port: config.port }));
  });

  const shutdown = signal => {
    console.log(JSON.stringify({ level: "info", message: "Shutting down", signal }));
    server.close(async error => {
      await pool.end();
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(error => {
  console.error(JSON.stringify({ level: "fatal", message: error.message }));
  process.exitCode = 1;
});
