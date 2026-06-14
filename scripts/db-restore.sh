#!/usr/bin/env bash
# Restore local MongoDB từ file archive nén gzip.
# Usage:
#   ./scripts/db-restore.sh                       → restore từ bản backup mới nhất trong ./backups/
#   ./scripts/db-restore.sh <path/to/file.gz>     → restore từ file cụ thể

set -euo pipefail

CONTAINER="qlpt-mongodb"
DB="quanlyphongtro"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"

if [ $# -ge 1 ]; then
  FILE="$1"
else
  FILE="$(ls -1t "$BACKUP_DIR"/*.archive.gz 2>/dev/null | head -n 1 || true)"
  if [ -z "$FILE" ]; then
    echo "❌ Không tìm thấy file backup nào trong $BACKUP_DIR"
    exit 1
  fi
  echo "ℹ️  Dùng bản backup mới nhất: $FILE"
fi

if [ ! -f "$FILE" ]; then
  echo "❌ File không tồn tại: $FILE"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' chưa chạy. Hãy chạy: docker compose up -d"
  exit 1
fi

echo "⚠️  Sẽ GHI ĐÈ database '$DB' từ file: $FILE"
read -p "Tiếp tục? (y/N): " confirm
if [ "${confirm:-N}" != "y" ] && [ "${confirm:-N}" != "Y" ]; then
  echo "Đã hủy."
  exit 0
fi

echo "⏳ Đang restore..."
docker exec -i "$CONTAINER" mongorestore \
  --uri="mongodb://admin:admin@localhost:27017/${DB}?authSource=admin" \
  --archive --gzip --drop < "$FILE"

echo "✅ Restore xong từ: $FILE"
