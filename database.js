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
    browser TEXT
  )`);
});

module.exports = db;
