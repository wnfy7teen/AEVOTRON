#!/bin/sh
set -eu

CONTAINER_NAME="aevotron-docker-smoke-$$"
HTML_FILE="$(mktemp)"
ASSET_LIST="$(mktemp)"
cleanup() {
  docker logs "$CONTAINER_NAME" 2>/dev/null || true
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -f "$HTML_FILE" "$ASSET_LIST"
}
trap cleanup EXIT INT TERM

docker run -d --name "$CONTAINER_NAME" -p 127.0.0.1:4173:3000 aevotron:docker-preview >/dev/null

attempt=0
until [ "$attempt" -ge 30 ]; do
  if curl -fsSL http://127.0.0.1:4173/ -o "$HTML_FILE"; then
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

# Fetch every same-origin Vite JS/CSS asset referenced by the rendered page.
grep -oE '/assets/[^"]+\.(js|css)(\?[^"]*)?' "$HTML_FILE" | sort -u > "$ASSET_LIST" || true
[ -s "$ASSET_LIST" ] || {
  printf 'Docker smoke test failed: no local JS/CSS assets were found in homepage HTML.\n' >&2
  exit 1
}

asset_count=0
while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  curl -fsS "http://127.0.0.1:4173$asset" -o /dev/null || {
    printf 'Docker smoke test failed: asset request failed: %s\n' "$asset" >&2
    exit 1
  }
  asset_count=$((asset_count + 1))
done < "$ASSET_LIST"

[ "$asset_count" -gt 0 ] || {
  printf 'Docker smoke test failed: no JS/CSS assets were successfully checked.\n' >&2
  exit 1
}

printf 'Docker runtime smoke test passed: homepage returned HTML.\n'
printf 'Local JS/CSS assets fetched successfully: %s\n' "$asset_count"

# Smoke-test every currently declared application page route.
for route in /login /register /forgot-password /reset-password /mfa /dashboard; do
  ROUTE_FILE="$(mktemp)"
  if ! curl -fsSL "http://127.0.0.1:4173$route" -o "$ROUTE_FILE"; then
    printf 'Docker smoke test failed: route returned an HTTP error: %s\n' "$route" >&2
    rm -f "$ROUTE_FILE"
    exit 1
  fi
  if ! grep -Eiq '<!doctype html|<html([[:space:]>])' "$ROUTE_FILE"; then
    printf 'Docker smoke test failed: route did not return HTML: %s\n' "$route" >&2
    rm -f "$ROUTE_FILE"
    exit 1
  fi
  rm -f "$ROUTE_FILE"
  printf 'Route OK: %s\n' "$route"
done
