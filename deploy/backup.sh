#!/usr/bin/env bash
# Daily PostgreSQL backup → S3 (run by cron, see deploy/cloud-init.yml).
# Uses the EC2 instance role: no AWS keys on the server. The role may only
# PutObject under s3://$BACKUP_S3_BUCKET/backups/ (deploy/iam/instance-backup-policy.json),
# and an S3 lifecycle rule deletes backups after 30 days.
set -euo pipefail

cd "$(dirname "$0")"
ENV_FILE=.env.prod
COMPOSE=(docker compose -f compose.prod.yml --env-file "$ENV_FILE")

# Read single values without sourcing the file (it contains JSON).
env_value() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }

BUCKET="$(env_value BACKUP_S3_BUCKET)"
DB_USER="$(env_value POSTGRES_USER)"
DB_NAME="$(env_value POSTGRES_DB)"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
KEY="backups/affiliate_crm-${STAMP}.dump"
TMP="$(mktemp /tmp/affiliate_crm-XXXXXX.dump)"
trap 'rm -f "$TMP"' EXIT

# 1. Dump to a local file (custom format: compressed, restorable selectively).
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "$TMP"

# 2. Refuse to upload a broken dump: pg_restore must be able to read its table of contents.
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$TMP" > /dev/null

# 3. Upload.
aws s3 cp "$TMP" "s3://${BUCKET}/${KEY}" --only-show-errors
echo "$(date -u +%FT%TZ) backup ok: s3://${BUCKET}/${KEY} ($(du -h "$TMP" | cut -f1))"
