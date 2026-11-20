# Docker build verification

This workflow builds AEVOTRON in an isolated Node.js 22 container and verifies the
artifacts produced by the existing TanStack Start / Nitro / Cloudflare build.

It is intentionally a **build-and-artifact check**, not a replacement runtime.
The app uses Base44 platform integration and a Worker-oriented server build;
serving only `dist/client` with Nginx would drop server-rendered routes and
server functions. A separate runtime container must be validated against the
actual Worker runtime and Base44 platform requirements before it is introduced.

## Local check

Requirements: Docker Engine and the Docker Compose plugin.

```sh
docker compose build build-check
docker compose run --rm --no-build build-check
```

The Docker build runs, in order:

1. `npm install --no-audit --no-fund` (same install strategy as the existing CI;
   this repository currently has no committed npm lockfile).
2. `npm test`.
3. `npm run lint`.
4. `npm run build`.
5. A separate verification stage checks that client assets, server output and
   `.wrangler/deploy/config.json` were generated and that JS/CSS bundles exist.

The image does not publish, deploy, change DNS, access Vercel aliases, or require
production secrets. It is safe to build locally or in GitHub Actions.

## GitHub Actions

The `Docker build verification` workflow runs on pushes to
`chore/docker-parallel`, on pull requests targeting `main`, and manually via
`workflow_dispatch`. It builds the image and runs its artifact checks. It does
not push the image to a registry.

## Production boundary

Vercel remains the serving platform. Do not attach a production domain, add
production secrets, or change DNS as part of this experiment. A separate
runtime/deployment proposal is required after this build check passes.
