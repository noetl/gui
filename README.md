# noetl/gui

React + Vite frontend for NoETL GUI.

## Local development

Requirements:
- Node.js 20+
- npm

Run locally:

```bash
npm ci
npm run dev
```

Default dev URL: `http://localhost:3001`

## Build

```bash
npm ci
npm run build
```

Build output: `dist/`

## Docker image

Build image locally:

```bash
docker build \
  -t local/noetl-gui:dev \
  .
```

Run image locally:

```bash
docker run --rm -p 8080:8080 local/noetl-gui:dev
```

Open: `http://localhost:8080`

## Runtime/API routing

- API base defaults to `gateway.<host>` in browser runtime (for public deployments).
- For local browser host (`localhost` / `127.0.0.1`), GUI uses `http://localhost:8090`.

## Runtime environment configuration (no rebuild)

The container writes `/env-config.js` at startup from environment variables, so API/auth settings can be changed at deploy/run time without rebuilding the image.

Supported runtime variables:

- `VITE_API_MODE` (`gateway` or `direct`)
- `VITE_API_BASE_URL` (for direct mode)
- `VITE_ALLOW_SKIP_AUTH` (`true`/`false`, limited to local/private browser and API hosts)
- `VITE_GATEWAY_URL`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_REDIRECT_URI`

Example:

```bash
docker run --rm -p 8080:8080 \
  -e VITE_API_MODE=direct \
  -e VITE_API_BASE_URL=http://722-2.local:8082 \
  -e VITE_ALLOW_SKIP_AUTH=true \
  local/noetl-gui:dev
```

## Release and publish

This repo uses two workflows:

- `Semantic Release ⚙️` (`.github/workflows/semantic-release.yml`)
  - Trigger: push to `main`
  - Uses conventional commits (`feat:`, `fix:`) to determine next version
  - Updates `package.json` + `package-lock.json` + `CHANGELOG.md`
  - Creates/pushes git tag `v<version>`

- `release-gui` (`.github/workflows/release.yml`)
  - Trigger: tag push `v*` (or manual dispatch)
  - Builds/pushes container image to GHCR:
    - `ghcr.io/noetl/gui:<version>`
    - `ghcr.io/noetl/gui:latest`
  - Creates/updates GitHub Release for the same tag

### Normal publish path

1. Merge PR to `main` with conventional commit message (`feat:` or `fix:`).
2. Wait for semantic-release to create tag.
3. Wait for `release-gui` run on that tag to publish image.

### Manual publish path

If needed, you can run `release-gui` manually from GitHub Actions:

- Workflow: `release-gui`
- Input: `version` (must match `package.json` version)

## Pull published image

```bash
docker pull ghcr.io/noetl/gui:latest
# or
docker pull ghcr.io/noetl/gui:<version>
```
