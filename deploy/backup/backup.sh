#!/bin/sh

set -eu

: "${POSTGRES_USER:?POSTGRES_USER não definido}"
: "${POSTGRES_DB:?POSTGRES_DB não definido}"
: "${PGPASSWORD:?PGPASSWORD não definido}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETRY_SECONDS="${BACKUP_RETRY_SECONDS:-300}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "${BACKUP_DIR}"

perform_backup() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  filename="gestoria-${timestamp}.dump"
  temporary_path="${BACKUP_DIR}/.${filename}.tmp"
  final_path="${BACKUP_DIR}/${filename}"

  echo "Iniciando backup do banco ${POSTGRES_DB} em ${timestamp}."

  if pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --no-privileges \
    --file="${temporary_path}"
  then
    mv "${temporary_path}" "${final_path}"

    (
      cd "${BACKUP_DIR}"
      sha256sum "${filename}" > "${filename}.sha256"
    )

    find "${BACKUP_DIR}" \
      -type f \
      \( -name "gestoria-*.dump" -o -name "gestoria-*.dump.sha256" \) \
      -mtime "+${BACKUP_RETENTION_DAYS}" \
      -delete

    echo "Backup concluído: ${final_path}"
    return 0
  fi

  rm -f "${temporary_path}"
  echo "Falha ao criar backup. Nova tentativa em ${BACKUP_RETRY_SECONDS} segundos." >&2
  return 1
}

trap 'exit 0' INT TERM

while true
do
  if perform_backup
  then
    sleep "${BACKUP_INTERVAL_SECONDS}" &
  else
    sleep "${BACKUP_RETRY_SECONDS}" &
  fi

  wait "$!"
done