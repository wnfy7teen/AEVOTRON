# AEVOTRON Docker preview

This is a parallel, non-production runtime experiment. It does not change Vercel,
DNS, domains, or the production deployment.

## Requirements

- Docker Engine with Compose v2
- Node.js is not required on the host

## Build and start

```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs --tail=100 aevotron-docker-preview
```

Open http://127.0.0.1:3001.

## Stop

```bash
docker compose down
```

The service binds only to 127.0.0.1 on the host. Do not expose it publicly or
configure production DNS until runtime compatibility, Base44 integrations,
authentication, server functions, and static asset delivery have been verified.

## Important implementation note

The repository does not currently contain a committed npm lockfile. The
container build therefore installs the dependency ranges from package.json.
Before using this image for a production deployment, generate and commit the
project's lockfile, then change the Docker build to use `npm ci`.

The Docker image expects Nitro's Node server output at
`.output/server/index.mjs`. The CI smoke test verifies that this output is
actually produced and that the container responds over HTTP.
