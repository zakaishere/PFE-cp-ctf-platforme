#!/bin/sh
# Applies schema.sql (base tables) and every db/migration_v*.sql (in numeric
# order) before the app starts, then execs the JVM. This is what makes the
# schema fully automatic: no manual `make db-migrate`, no DDL_AUTO=update
# dance on first boot. Safe to run on every single container start —
# schema.sql uses CREATE TABLE IF NOT EXISTS and all 27 migration files are
# either explicitly guarded (IF NOT EXISTS / IF EXISTS / DROP ... IF EXISTS)
# or, in the one exception (migration_v28, a WHERE-scoped UPDATE), naturally
# idempotent — already-applied statements are no-ops on re-run.
#
# Runs BEFORE `java -jar app.jar` as a separate process, which is the only
# reliable way to guarantee ordering: Hibernate validates the schema during
# Spring context startup (EntityManagerFactory bean creation), which happens
# BEFORE any CommandLineRunner gets a chance to run — a Spring-side migration
# runner would hit the exact same "missing table" race this replaces.
set -eu

: "${PGHOST:?PGHOST must be set}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE must be set}"
: "${PGUSER:?PGUSER must be set}"
: "${PGPASSWORD:?PGPASSWORD must be set}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

echo "[schema] Waiting for Postgres at $PGHOST:$PGPORT ..."
i=0
until pg_isready -q; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[schema] Postgres not reachable after 30 attempts — giving up." >&2
    exit 1
  fi
  sleep 2
done
echo "[schema] Postgres is ready."

PSQL="psql -v ON_ERROR_STOP=1 -q"
SCHEMA_DIR="$(dirname "$0")/schema"

if [ -f "$SCHEMA_DIR/schema.sql" ]; then
  echo "[schema] Applying schema.sql (base tables) ..."
  $PSQL -f "$SCHEMA_DIR/schema.sql"
fi

for f in $(ls "$SCHEMA_DIR"/migration_v*.sql 2>/dev/null | sort -V); do
  echo "[schema] Applying $(basename "$f") ..."
  $PSQL -f "$f"
done

echo "[schema] Schema is up to date. Starting the application."
exec java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -jar app.jar "$@"
