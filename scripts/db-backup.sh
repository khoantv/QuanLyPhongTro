#!/usr/bin/env bash
# Backup local MongoDB (Docker container qlpt-mongodb) thành file archive nén gzip.
# Output: ./backups/manual-<timestamp>.archive.gz

set -euo pipefail

CONTAINER="qlpt-mongodb"
DB="quanlyphongtro"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/manual-$TS.archive.gz"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' chưa chạy. Hãy chạy: docker compose up -d"
  exit 1
fi

echo "📦 Đang backup database '$DB' → $OUT"
docker exec "$CONTAINER" mongodump \
  --uri="mongodb://admin:admin@localhost:27017/${DB}?authSource=admin" \
  --archive --gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✅ Backup xong ($SIZE): $OUT"
