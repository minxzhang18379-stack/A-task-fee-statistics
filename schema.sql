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

-- 用户凭证与权限角色表
CREATE TABLE IF NOT EXISTS UserCredential (
  username TEXT PRIMARY KEY,                  -- 用户名 (唯一主键)
  password_hash TEXT NOT NULL,                -- 经过加盐哈希加密后的密码密文 (PBKDF2/SHA-256)
  salt TEXT NOT NULL,                         -- 随机生成的加密盐值，防彩虹表破解
  role TEXT NOT NULL DEFAULT 'member',        -- 权限角色: 'admin' (管理员) 或 'member' (成员)
  created_at INTEGER NOT NULL,                -- 账号创建时间戳
  is_active INTEGER NOT NULL DEFAULT 1        -- 账号状态: 1 (启用), 0 (禁用)
);

-- 为账号状态和角色建立索引，优化鉴权查询
CREATE INDEX IF NOT EXISTS idx_user_status ON UserCredential(username, is_active);
CREATE INDEX IF NOT EXISTS idx_task_date ON TaskRecord(taskDate);
CREATE INDEX IF NOT EXISTS idx_photographer ON TaskRecord(photographer);

