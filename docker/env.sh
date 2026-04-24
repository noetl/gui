#!/bin/sh
set -eu

ENV_FILE="/usr/share/nginx/html/env-config.js"

js_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$ENV_FILE" <<EOF
window.__NOETL_ENV__ = {
  "VITE_API_MODE": "$(js_escape "${VITE_API_MODE:-}")",
  "VITE_API_BASE_URL": "$(js_escape "${VITE_API_BASE_URL:-}")",
  "VITE_ALLOW_SKIP_AUTH": "$(js_escape "${VITE_ALLOW_SKIP_AUTH:-}")",
  "VITE_GATEWAY_URL": "$(js_escape "${VITE_GATEWAY_URL:-}")",
  "VITE_AUTH0_DOMAIN": "$(js_escape "${VITE_AUTH0_DOMAIN:-}")",
  "VITE_AUTH0_CLIENT_ID": "$(js_escape "${VITE_AUTH0_CLIENT_ID:-}")",
  "VITE_AUTH0_REDIRECT_URI": "$(js_escape "${VITE_AUTH0_REDIRECT_URI:-}")"
};
EOF
