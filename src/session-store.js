"use strict";

const session = require("express-session");

class MySqlSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  get(sessionId, callback) {
    this.pool.execute(
      "SELECT expires, data FROM sessions WHERE session_id = ?",
      [sessionId]
    ).then(async ([rows]) => {
      if (!rows.length) return callback(null, null);
      if (Number(rows[0].expires) <= Date.now()) {
        await this.destroy(sessionId, error => error ? callback(error) : callback(null, null));
        return;
      }
      callback(null, JSON.parse(rows[0].data));
    }).catch(callback);
  }

  set(sessionId, value, callback = () => {}) {
    const expires = value.cookie && value.cookie.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + Number(value.cookie && value.cookie.maxAge || 60 * 60 * 1000);
    this.pool.execute(
      `INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
      [sessionId, expires, JSON.stringify(value)]
    ).then(() => callback()).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    this.pool.execute("DELETE FROM sessions WHERE session_id = ?", [sessionId])
      .then(() => callback()).catch(callback);
  }

  touch(sessionId, value, callback = () => {}) {
    const expires = value.cookie && value.cookie.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + Number(value.cookie && value.cookie.maxAge || 60 * 60 * 1000);
    this.pool.execute("UPDATE sessions SET expires = ? WHERE session_id = ?", [expires, sessionId])
      .then(() => callback()).catch(callback);
  }
}

module.exports = { MySqlSessionStore };
