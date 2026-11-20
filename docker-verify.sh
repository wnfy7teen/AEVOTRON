#!/bin/sh
set -eu

CONTAINER_NAME="aevotron-docker-smoke-$$"
HTML_FILE="$(mktemp)"
cleanup() {
  docker logs "$CONTAINER_NAME" 2>/dev/null || true
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -f "$HTML_FILE"
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

printf 'Docker runtime smoke test passed: homepage returned HTML.\n'
