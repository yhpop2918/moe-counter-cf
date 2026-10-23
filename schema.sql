-- ============================================================
-- schema.sql —— D1 建表脚本
-- 对应原版 database/sqlite3.go 里 GORM AutoMigrate 生成的 counters 表
-- 执行方式: npm run db:create （等价于 npx wrangler d1 execute moe-counter --remote --file=schema.sql）
-- ============================================================

-- 计数器表（字段与原版 Counter 模型一一对应）
-- gorm.Model => id / created_at / updated_at / deleted_at
-- Name(gorm uniqueIndex) => name（唯一索引）
-- Count(uint) => count
CREATE TABLE IF NOT EXISTS counters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME,
  updated_at DATETIME,
  deleted_at DATETIME,
  name       TEXT,
  count      INTEGER NOT NULL DEFAULT 0
);

-- name 唯一索引（对应 gorm 的 uniqueIndex，也是 INSERT OR IGNORE 的判重依据）
CREATE UNIQUE INDEX IF NOT EXISTS idx_counters_name ON counters (name);
