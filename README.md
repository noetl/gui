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
  --build-arg APP_VERSION=dev \
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
The startup script also adds a timestamp query string to the `/env-config.js` script tag in `index.html`, matching the deploy-time environment injection pattern used by the health-vax UI reference while keeping NoETL's Vite/nginx layout.

Supported runtime variables:

- `VITE_API_MODE` (`gateway` or `direct`)
- `VITE_API_BASE_URL` (for direct mode)
- `VITE_ALLOW_SKIP_AUTH` (`true`/`false`, limited to local/private browser and API hosts)
- `VITE_GATEWAY_URL`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_REDIRECT_URI`
- `VITE_MCP_KUBERNETES_URL` (optional browser-visible MCP endpoint, for example `/mcp/kubernetes`)
- `MCP_KUBERNETES_UPSTREAM` (optional nginx upstream for same-origin proxying, for example `http://kubernetes-mcp-server.mcp.svc.cluster.local:8080`)
- `VITE_APP_VERSION` / `APP_VERSION` (optional build/runtime version surfaced to MCP server client info)

Example:

```bash
docker run --rm -p 8080:8080 \
  -e VITE_API_MODE=direct \
  -e VITE_API_BASE_URL=http://722-2.local:8082 \
  -e VITE_ALLOW_SKIP_AUTH=true \
  local/noetl-gui:dev
```

## Release and publish

This repo uses these workflows:

- `Semantic Release ⚙️` (`.github/workflows/release.yml`)
  - Trigger: push to `main`
  - Uses conventional commits (`feat:`, `fix:`) to determine next version
  - Updates `package.json`, `package-lock.json`, and `CHANGELOG.md`
  - Creates/pushes git tag `v<version>`

- `Build image on Release` (`.github/workflows/build_on_release.yml`)
  - Trigger: GitHub Release published, or manual dispatch with a release tag such as `v1.2.3`
  - Builds/pushes container image to GHCR:
    - `ghcr.io/noetl/gui:v<version>`
    - `ghcr.io/noetl/gui:<version>`
    - `ghcr.io/noetl/gui:<major>.<minor>`
    - `ghcr.io/noetl/gui:<major>`
    - `ghcr.io/noetl/gui:latest`
  - Builds multi-platform images for `linux/amd64` and `linux/arm64`

- `Validate GUI` (`.github/workflows/validate.yml`)
  - Trigger: pull requests and pushes to `main`
  - Runs `npm ci`, `npm run type-check`, `npm run build`, and a Docker container build

### Normal publish path

1. Merge PR to `main` with conventional commit message (`feat:` or `fix:`).
2. Wait for semantic-release to create the GitHub Release and tag.
3. Wait for `Build image on Release` to publish the semver-tagged image.

### Manual publish path

If needed, you can run `Build image on Release` manually from GitHub Actions:

- Workflow: `Build image on Release`
- Input: `version` (release tag, for example `v1.2.3`)

## Pull published image

```bash
docker pull ghcr.io/noetl/gui:latest
# or
docker pull ghcr.io/noetl/gui:v<version>
# or
docker pull ghcr.io/noetl/gui:<version>
```
