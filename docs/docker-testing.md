# Docker preview

This is a parallel, local Docker runtime for AEVOTRON. It does not replace or
modify the Vercel deployment.

The current Vite build log confirms that Nitro selects the `node-server` preset
and emits a runnable `.output/server/index.mjs` plus public assets in
`.output/public`. The Docker image runs that Nitro server; it does not serve
only the client folder with Nginx, which would break SSR and server routes.

## Local preview

Requirements: Docker Engine and the Docker Compose plugin.

```sh
docker compose up --build -d
```

Open http://localhost:3000. To stop it:

```sh
docker compose down
```

To build and run the HTTP smoke test manually:

```sh
docker build -t aevotron:docker-preview .
sh docker-verify.sh
```

The Docker build runs `npm install --no-audit --no-fund`, `npm test`,
`npm run lint` and `npm run build`. The runtime image contains only Nitro's
generated `.output` directory and runs as the unprivileged `node` user.

This repository currently has no committed npm lockfile, so the dependency
install follows the existing CI's `npm install` strategy rather than
`npm ci`.

## Platform-dependent features

The public landing page can be smoke-tested without production credentials.
Features that call Base44 platform APIs, use platform-injected request headers,
or depend on Base44-managed secrets may not work in a standalone local
container until their supported standalone configuration is established.
Do not copy production secrets into the image or commit them to the repository.

## GitHub Actions

The `Docker build verification` workflow builds the image and runs
`docker-verify.sh` through the POSIX shell. The script starts the container,
checks that the homepage returns HTML, fetches every same-origin JS/CSS asset
referenced by the homepage, and verifies that the declared login, registration,
password recovery, MFA, and dashboard routes return HTML over HTTP. It does
not push an image to a registry or deploy it.

## Production boundary

Vercel remains the production serving platform. This branch does not change
production domains, DNS, aliases, environment variables, or deployment settings.
A separate reviewed change is required before any production migration.
