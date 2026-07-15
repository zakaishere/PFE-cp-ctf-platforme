#!/usr/bin/env bash
# Platform quickstart — run from the repo root:  ./quickstart.sh
#
# Creates .env (if missing) and auto-generates every secret that CAN be
# auto-generated: DB_PASSWORD, RABBITMQ_PASSWORD, JWT_SECRET, CTF_FLAG_SECRET,
# GRAFANA_PASSWORD. Safe to re-run — only touches values still at their
# .env.example placeholder, never overwrites something you've already set.
#
# Email is the one thing that genuinely cannot be scripted (Gmail requires an
# interactive login + manual App Password generation, no API for it). If you
# haven't filled in MAIL_USERNAME yourself, this script sets
# DISABLE_EMAIL_VERIFICATION=true so the app runs with zero email setup —
# accounts auto-verify, fine for a demo/PFE. See QUICKSTART.md to switch to
# real OTP emails later.

set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=.env
EXAMPLE_FILE=.env.example

if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "Run this from the repo root (where .env.example lives)." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE from $EXAMPLE_FILE"
fi

gen_hex() { openssl rand -hex "$1"; }

# Reads VAR= from .env, stripping any inline `# comment` and trailing
# whitespace, so a line like "VAR=value   # note" isn't mistaken as customized.
read_value() {
  local var="$1"
  grep -E "^${var}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- \
    | sed -E 's/[[:space:]]*#.*$//; s/[[:space:]]+$//'
}

# set_secret VAR placeholder_value hex_bytes
set_secret() {
  local var="$1" placeholder="$2" bytes="$3"
  local current
  current=$(read_value "$var")
  if [ -z "$current" ] || [ "$current" = "$placeholder" ]; then
    local newval
    newval=$(gen_hex "$bytes")
    grep -q "^${var}=" "$ENV_FILE" || echo "${var}=" >> "$ENV_FILE"
    sed -i "s|^${var}=.*|${var}=${newval}|" "$ENV_FILE"
    echo "  generated $var"
  else
    echo "  kept existing $var (already customized)"
  fi
}

echo "Setting up $ENV_FILE ..."
set_secret DB_PASSWORD "change_me_in_production" 16
set_secret RABBITMQ_PASSWORD "change_me_in_production" 16
set_secret JWT_SECRET "change_me_minimum_32_chars_long_random_string" 32
set_secret CTF_FLAG_SECRET "change_me_minimum_32_chars_long_random_string" 32
set_secret GRAFANA_PASSWORD "change_me_in_production" 16

# Email: only Gmail App Password setup is manual — everything else is automatic.
mail_user=$(read_value MAIL_USERNAME)
if [ -z "$mail_user" ]; then
  grep -q '^DISABLE_EMAIL_VERIFICATION=' "$ENV_FILE" || echo "DISABLE_EMAIL_VERIFICATION=" >> "$ENV_FILE"
  sed -i "s|^DISABLE_EMAIL_VERIFICATION=.*|DISABLE_EMAIL_VERIFICATION=true|" "$ENV_FILE"
  echo "  MAIL_USERNAME empty -> DISABLE_EMAIL_VERIFICATION=true (no real email needed)"
else
  echo "  MAIL_USERNAME already set -> leaving DISABLE_EMAIL_VERIFICATION as-is"
fi

echo ""
echo "Done. $ENV_FILE is ready."
echo ""
echo "Next steps:"
echo "  1. make build"
echo "  2. echo 'DDL_AUTO=update' >> .env   (first boot on a fresh DB only)"
echo "  3. make up"
echo "  4. sed -i '/^DDL_AUTO=update/d' .env && docker compose up -d --no-build backend"
echo "  5. make db-migrate"
echo "  See QUICKSTART.md for the rest (creating an admin, wiring the worker agent)."
