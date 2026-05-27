-- Cloudflare D1 Database Schema for PANN Task Manager
-- Initialize your D1 database by pasting this schema in the Cloudflare D1 Console,
-- or running: npx wrangler d1 execute <database-name> --file=./schema.sql

CREATE TABLE IF NOT EXISTS TaskRecord (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  photographer TEXT NOT NULL DEFAULT '',
  taskType TEXT NOT NULL DEFAULT '',
  taskDate TEXT NOT NULL DEFAULT '',
  fee REAL NOT NULL DEFAULT 0
);
