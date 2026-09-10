#!/usr/bin/env bash
#
# Ночная резервная копия: база и загруженные фото. Ставится в cron
# скриптом setup.sh, руками — /usr/local/bin/ugg-backup.
#
# База копируется через .backup, а не cp: файл SQLite в режиме WAL
# состоит из трёх частей, и простое копирование посреди записи даёт
# битую копию. Хранится две недели.
set -euo pipefail

APP_DIR="/srv/ugg/app"
OUT="/srv/ugg/backups"
STAMP="$(date +%F)"

mkdir -p "$OUT"
sqlite3 "$APP_DIR/data/shop.db" ".backup '$OUT/shop-$STAMP.db'"
tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$APP_DIR/public" uploads

find "$OUT" -name 'shop-*.db' -mtime +14 -delete
find "$OUT" -name 'uploads-*.tar.gz' -mtime +14 -delete
