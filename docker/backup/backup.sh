#!/bin/sh
# ============================================
# 算法深度理解引擎 - MySQL 自动备份脚本
# ============================================
# 执行策略：每日凌晨 3 点由 cron 触发
# 保留策略：每日备份保留 7 天，每周日备份保留 4 周
# ============================================

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)

# 每日备份文件名
DAILY_FILE="${BACKUP_DIR}/daily_${DATE}.sql.gz"

echo "[$(date)] 开始数据库备份..."

# 执行 mysqldump 并压缩
mysqldump \
  -h "${MYSQL_HOST}" \
  -u "${MYSQL_USER}" \
  -p"${MYSQL_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  "${MYSQL_DATABASE}" | gzip > "${DAILY_FILE}"

if [ $? -eq 0 ]; then
  echo "[$(date)] 每日备份完成: ${DAILY_FILE}"
else
  echo "[$(date)] 备份失败!" >&2
  exit 1
fi

# 每周日额外保留一份周备份
if [ "${DAY_OF_WEEK}" = "7" ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly_${DATE}.sql.gz"
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  echo "[$(date)] 周备份已创建: ${WEEKLY_FILE}"
fi

# 清理过期备份：每日备份保留 7 天
find "${BACKUP_DIR}" -name "daily_*.sql.gz" -mtime +7 -delete
echo "[$(date)] 已清理 7 天前的每日备份"

# 清理过期备份：周备份保留 4 周（28 天）
find "${BACKUP_DIR}" -name "weekly_*.sql.gz" -mtime +28 -delete
echo "[$(date)] 已清理 4 周前的周备份"

echo "[$(date)] 备份任务完成"
