const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./subscriptions.db');

function getVerifiedSubscriptions(callback) {
  const query = "SELECT * FROM subscriptions WHERE verified = TRUE AND enabled = TRUE";
  db.all(query, [], (err, rows) => {
    if (err) {
      throw err;
    }
    callback(rows);
  });
}

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

module.exports = {
  getVerifiedSubscriptions,
  db
};
