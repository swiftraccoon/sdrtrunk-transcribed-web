const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./subscriptions.db');

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

module.exports = db;
