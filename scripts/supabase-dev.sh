#!/usr/bin/env bash
#
# Opt-in local Supabase stack — kept OUT of `pnpm test:e2e` on purpose.
#
# `pnpm test:e2e` runs against the docker-compose Postgres only and mocks
# JWKS/storage, so it needs neither Supabase nor Docker's Supabase images.
# Use this when you actually want the real Supabase environment: the auth stack
# (GoTrue), Storage, and the "create-user" database webhook on auth.users.
#
# The "create-user" webhook is defined in supabase/seed.sql (local-only), so it
# is applied automatically when the stack starts here and is never carried to a
# linked/prod project by `supabase db push`.
#
# Usage:
#   pnpm supabase:start   # bring the stack up (applies migrations + seed)
#   pnpm supabase:stop    # tear it down
set -euo pipefail

cmd="${1:-start}"

case "$cmd" in
  start)
    echo "🧼 Wiping old state and starting a fresh local Supabase instance..."
    npx supabase stop --no-backup >/dev/null 2>&1 || true
    npx supabase start
    echo "✅ Supabase is up. The 'create-user' webhook (supabase/seed.sql) is applied."
    ;;
  stop)
    echo "🧹 Stopping local Supabase instance..."
    npx supabase stop --no-backup
    ;;
  *)
    echo "Unknown command: $cmd (expected 'start' or 'stop')" >&2
    exit 1
    ;;
esac
