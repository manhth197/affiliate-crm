#!/usr/bin/env bash
# Restore a backup made by backup.sh. DESTRUCTIVE: replaces the current data.
#   ./restore.sh ./affiliate_crm-2026-11-24T1830Z.dump
# Download the file first with credentials that can read the bucket (the
# server's instance role cannot, on purpose), e.g. from your own machine:
#   aws s3 cp s3://<bucket>/backups/<file>.dump .   then scp it to the server.
set -euo pipefail

DUMP="${1:?usage: restore.sh <file.dump>}"
cd "$(dirname "$0")"
ENV_FILE=.env.prod
env_value() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }
DB_USER="$(env_value POSTGRES_USER)"
DB_NAME="$(env_value POSTGRES_DB)"

read -r -p "Replace ALL data in database '${DB_NAME}' with ${DUMP}? Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "aborted"; exit 1; }

# Stop the API so nothing writes during the restore.
docker compose -f compose.prod.yml --env-file "$ENV_FILE" stop api
docker compose -f compose.prod.yml --env-file "$ENV_FILE" exec -T postgres \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$DUMP"
docker compose -f compose.prod.yml --env-file "$ENV_FILE" start api
echo "restore done"
