const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.run(`
CREATE TABLE IF NOT EXISTS presencas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  username TEXT,
  guild_id TEXT,
  data TEXT
)
`);

module.exports = db;
