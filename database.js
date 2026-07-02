const sqlite3 = require('sqlite3').verbose();

// SDRTW_DB_PATH lets tests point at a scratch database instead of live data
const db = new sqlite3.Database(process.env.SDRTW_DB_PATH || './subscriptions.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regex TEXT NOT NULL,
      email TEXT NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      enabled BOOLEAN DEFAULT TRUE,
      ip TEXT,
      browser TEXT,
      confirmationID TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      yubikeyId TEXT
    )`);
});

// Promise wrapper: sqlite3's db.run is callback-based, so `await db.run(...)`
// silently ignores errors. Use this for any write whose failure must surface.
db.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

module.exports = db;
