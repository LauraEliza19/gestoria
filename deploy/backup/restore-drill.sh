#!/bin/sh

set -eu

: "${POSTGRES_USER:?POSTGRES_USER não definido}"
: "${POSTGRES_DB:?POSTGRES_DB não definido}"
: "${PGPASSWORD:?PGPASSWORD não definido}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

backup_path="${1:-}"

if [ -z "${backup_path}" ]
then
  backup_path="$(
    find "${BACKUP_DIR}" \
      -maxdepth 1 \
      -type f \
      -name "gestoria-*.dump" |
    sort |
    tail -n 1
  )"
fi

if [ -z "${backup_path}" ] || [ ! -f "${backup_path}" ]
then
  echo "Nenhum backup válido foi encontrado." >&2
  exit 1
fi

backup_directory="$(dirname "${backup_path}")"
backup_filename="$(basename "${backup_path}")"
checksum_path="${backup_path}.sha256"

if [ -f "${checksum_path}" ]
then
  (
    cd "${backup_directory}"
    sha256sum -c "${backup_filename}.sha256"
  )
fi

restore_database="gestoria_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"
database_created="false"

cleanup() {
  if [ "${database_created}" = "true" ]
  then
    dropdb \
      --host="${POSTGRES_HOST}" \
      --port="${POSTGRES_PORT}" \
      --username="${POSTGRES_USER}" \
      --maintenance-db=postgres \
      --if-exists \
      --force \
      "${restore_database}"

    echo "Banco temporário removido: ${restore_database}"
  fi
}

trap cleanup EXIT HUP INT TERM

echo "Criando banco temporário: ${restore_database}"

createdb \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --maintenance-db=postgres \
  --owner="${POSTGRES_USER}" \
  "${restore_database}"

database_created="true"

echo "Restaurando ${backup_filename}."

pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${restore_database}" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "${backup_path}"

migration_revision="$(
  psql \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${restore_database}" \
    --tuples-only \
    --no-align \
    --command="SELECT version_num FROM alembic_version LIMIT 1;"
)"

table_count="$(
  psql \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${restore_database}" \
    --tuples-only \
    --no-align \
    --command="
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    "
)"

if [ -z "${migration_revision}" ]
then
  echo "A restauração não contém uma revisão Alembic válida." >&2
  exit 1
fi

if [ "${table_count}" -le 0 ]
then
  echo "A restauração não contém tabelas de aplicação." >&2
  exit 1
fi

echo "Teste de restauração aprovado."
echo "Migration restaurada: ${migration_revision}"
echo "Tabelas restauradas: ${table_count}"