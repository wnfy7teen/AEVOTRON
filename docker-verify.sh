#!/bin/sh
set -eu

PROJECT_NAME="aevotron-smoke-$"
API_PROJECT_NAME="${PROJECT_NAME}-api"
HTML_FILE="$(mktemp)"
API_FILE="$(mktemp)"
ASSET_LIST="$(mktemp)"
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    docker compose -p "$PROJECT_NAME" logs --no-color >&2 || true
  fi
  docker compose -p "$PROJECT_NAME" down -v --remove-orphans >/dev/null 2>&1 || true
  docker compose -p "$API_PROJECT_NAME" -f docker-compose.api.yml down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$HTML_FILE" "$API_FILE" "$ASSET_LIST"
  exit "$status"
}
trap cleanup EXIT INT TERM

# Ephemeral CI-only secrets. Nothing is written to the repository or image.
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export AEVOTRON_MASTER_KEY="$(openssl rand -base64 32)"
export IP_HASH_SALT="$(openssl rand -hex 32)"
export COOKIE_SECURE=false
export PUBLIC_APP_URL=http://localhost:3000
export SMTP_HOST=localhost
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=smoke-test
export SMTP_PASS=smoke-test
export SMTP_FROM=smoke@example.invalid

docker compose -p "$PROJECT_NAME" up --build -d

attempt=0
until [ "$attempt" -ge 40 ]; do
  if curl -fsSL http://127.0.0.1:3000/ -o "$HTML_FILE"; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

[ -s "$HTML_FILE" ] || {
  printf 'Docker smoke test failed: homepage did not return a response.\n' >&2
  exit 1
}
grep -Eiq '<!doctype html|<html([[:space:]>])' "$HTML_FILE" || {
  printf 'Docker smoke test failed: response is not HTML.\n' >&2
  exit 1
}

# The self-hosted API must be live and the session-protected route must reject anonymous callers.
attempt=0
status=""
until [ "$attempt" -ge 40 ]; do
  status="$(curl -sS -o "$API_FILE" -w '%{http_code}' http://127.0.0.1:3000/api/v1/auth/me || true)"
  [ "$status" = "401" ] && break
  attempt=$((attempt + 1))
  sleep 2
done
[ "$status" = "401" ] || {
  printf 'Docker smoke test failed: unauthenticated /api/v1/auth/me returned %s, expected 401.\n' "$status" >&2
  cat "$API_FILE" >&2
  exit 1
}
grep -q '"UNAUTHORIZED"' "$API_FILE" || {
  printf 'Docker smoke test failed: API did not return the expected auth error.\n' >&2
  exit 1
}
printf 'Self-hosted API smoke test passed: anonymous session rejected with HTTP 401.\n'

# Verify that the frontend origin survives the reverse proxy and foreign origins are rejected.
matching_origin_status="$(curl -sS -o "$API_FILE" -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' --data '{}')"
[ "$matching_origin_status" = "503" ] || {
  printf 'Docker smoke test failed: same-origin registration returned %s, expected SMTP guard HTTP 503.\n' "$matching_origin_status" >&2
  cat "$API_FILE" >&2
  exit 1
}
grep -q 'EMAIL_NOT_CONFIGURED' "$API_FILE" || {
  printf 'Docker smoke test failed: same-origin request did not reach the SMTP configuration guard.\n' >&2
  exit 1
}
foreign_origin_status="$(curl -sS -o "$API_FILE" -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H 'Origin: https://attacker.example' -H 'X-Forwarded-Host: attacker.example' -H 'X-Forwarded-Proto: https' -H 'Content-Type: application/json' --data '{}')"
[ "$foreign_origin_status" = "403" ] || {
  printf 'Docker smoke test failed: foreign-origin registration returned %s, expected 403.\n' "$foreign_origin_status" >&2
  cat "$API_FILE" >&2
  exit 1
}
printf 'Reverse-proxy origin checks passed: same-origin forwarded, foreign origin rejected.\n'

# Fetch every same-origin Vite JS/CSS asset referenced by the rendered page.
grep -oE '/assets/[^"]+\.(js|css)(\?[^"]*)?' "$HTML_FILE" | sort -u > "$ASSET_LIST" || true
[ -s "$ASSET_LIST" ] || {
  printf 'Docker smoke test failed: no local JS/CSS assets were found in homepage HTML.\n' >&2
  exit 1
}
asset_count=0
while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  curl -fsS "http://127.0.0.1:3000$asset" -o /dev/null
  asset_count=$((asset_count + 1))
done < "$ASSET_LIST"
printf 'Homepage and JS/CSS assets passed: %s assets.\n' "$asset_count"

for route in /login /register /forgot-password /reset-password /verify-email /mfa /dashboard; do
  curl -fsSL "http://127.0.0.1:3000$route" -o "$HTML_FILE"
  grep -Eiq '<!doctype html|<html([[:space:]>])' "$HTML_FILE"
  printf 'Route OK: %s\n' "$route"
done

# Build and smoke-test the backend-only VPS stack used with the Vercel frontend.
docker compose -p "$API_PROJECT_NAME" -f docker-compose.api.yml config >/dev/null
docker compose -p "$API_PROJECT_NAME" -f docker-compose.api.yml up --build -d
attempt=0
until [ "$attempt" -ge 40 ]; do
  status="$(curl -sS -o "$API_FILE" -w '%{http_code}' http://127.0.0.1:3001/healthz || true)"
  [ "$status" = "200" ] && break
  attempt=$((attempt + 1))
  sleep 2
done
[ "$status" = "200" ] || {
  printf 'API-only Docker stack failed health check: HTTP %s.\n' "$status" >&2
  cat "$API_FILE" >&2
  exit 1
}
status="$(curl -sS -o "$API_FILE" -w '%{http_code}' http://127.0.0.1:3001/api/v1/auth/me)"
[ "$status" = "401" ] || {
  printf 'API-only Docker stack expected anonymous /auth/me HTTP 401, got %s.\n' "$status" >&2
  cat "$API_FILE" >&2
  exit 1
}
status="$(curl -sS -o "$API_FILE" -w '%{http_code}' -X POST http://127.0.0.1:3001/api/v1/auth/register \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' --data '{"email":"invalid"}')"
[ "$status" = "400" ] || {
  printf 'API-only Docker stack same-origin request expected validation HTTP 400, got %s.\n' "$status" >&2
  cat "$API_FILE" >&2
  exit 1
}
status="$(curl -sS -o "$API_FILE" -w '%{http_code}' -X POST http://127.0.0.1:3001/api/v1/auth/register \
  -H 'Origin: https://attacker.example' -H 'X-Forwarded-Host: attacker.example' -H 'X-Forwarded-Proto: https' \
  -H 'Content-Type: application/json' --data '{"email":"invalid"}')"
[ "$status" = "403" ] || {
  printf 'API-only Docker stack foreign origin expected HTTP 403, got %s.\n' "$status" >&2
  cat "$API_FILE" >&2
  exit 1
}
printf 'Backend-only VPS stack passed: health, auth guard, configured-origin allowlist, and spoofed-header rejection.\n'
