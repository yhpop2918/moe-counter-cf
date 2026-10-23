#!/usr/bin/env bash
# ============================================================
# migrate-data.sh —— 把本地 SQLite data.db 里的计数数据迁移到 D1
#
# 适用场景：你之前已经用原版 Moe-Counter-Go 跑过一段时间，
#           计数数据存在 data.db 里，迁移后不想丢失。
#
# 用法：
#   1. 把 data.db 复制到本目录（或在有 data.db 的机器上运行本脚本）
#   2. 先执行过 npm run db:create（建表）
#   3. 运行 npm run db:migrate
#
# 原理：用 sqlite3 的 .mode insert 把 counters 表导出成
#       INSERT 语句，再交给 wrangler d1 execute 远程执行。
# ============================================================
set -e

DB_FILE="${1:-data.db}"     # 数据库文件，默认取当前目录的 data.db

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "错误：未安装 sqlite3。Windows 可在 https://sqlite.org/download.html 下载；"
  echo "或直接打开原服务器，把以下两条命令的输出保存后告诉我。"
  exit 1
fi

if [ ! -f "$DB_FILE" ]; then
  echo "错误：找不到 $DB_FILE（请先复制到本目录，或用参数指定路径）"
  exit 1
fi

echo ">> 从 $DB_FILE 导出 counters 表数据..."
# .mode insert 生成 INSERT INTO counters VALUES(...) 语句
# 注意：列顺序必须与 D1 建表一致（id, created_at, updated_at, deleted_at, name, count）
sqlite3 "$DB_FILE" ".mode insert counters" "SELECT id, created_at, updated_at, deleted_at, name, count FROM counters;" > counters_data.sql

echo ">> 导入到远程 D1 数据库..."
npx wrangler d1 execute moe-counter --remote --file=counters_data.sql

echo ">> 完成！建议核对一下："
echo "   npx wrangler d1 execute moe-counter --remote --command \"SELECT name, count FROM counters LIMIT 20\""
echo "   （与原库对比，数量应一致）"
