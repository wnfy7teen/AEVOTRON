#!/bin/sh
set -eu

fail() {
  printf 'Docker verification failed: %s\n' "$1" >&2
  exit 1
}

[ -d dist/client ] || fail "dist/client is missing"
[ -d dist/server ] || fail "dist/server is missing"
[ -s .wrangler/deploy/config.json ] || fail ".wrangler/deploy/config.json is missing or empty"

client_files="$(find dist/client -type f | wc -l | tr -d ' ')"
server_files="$(find dist/server -type f | wc -l | tr -d ' ')"
js_files="$(find dist/client -type f \( -name '*.js' -o -name '*.mjs' \) | wc -l | tr -d ' ')"
css_files="$(find dist/client -type f -name '*.css' | wc -l | tr -d ' ')"

[ "$client_files" -gt 0 ] || fail "client output contains no files"
[ "$server_files" -gt 0 ] || fail "server output contains no files"
[ "$js_files" -gt 0 ] || fail "client output contains no JavaScript bundles"
[ "$css_files" -gt 0 ] || fail "client output contains no CSS bundles"

printf 'Docker build verification passed.\n'
printf 'Client files: %s\n' "$client_files"
printf 'Server files: %s\n' "$server_files"
printf 'JavaScript bundles: %s\n' "$js_files"
printf 'CSS bundles: %s\n' "$css_files"
printf 'Base44/Cloudflare deployment config: present\n'
