#!/bin/sh
set -eu

ENV_FILE="/usr/share/nginx/html/env-config.js"

json_escape() {
  printf '%s' "$1" | awk '
    BEGIN { ORS = "" }
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      gsub(/\r/, "\\r")
      gsub(/\t/, "\\t")
      if (NR > 1) {
        printf "\\n"
      }
      printf "%s", $0
    }
  '
}

cat > "$ENV_FILE" <<EOF
window.__NOETL_ENV__ = {
  "VITE_API_MODE": "$(json_escape "${VITE_API_MODE:-}")",
  "VITE_API_BASE_URL": "$(json_escape "${VITE_API_BASE_URL:-}")",
  "VITE_ALLOW_SKIP_AUTH": "$(json_escape "${VITE_ALLOW_SKIP_AUTH:-}")",
  "VITE_GATEWAY_URL": "$(json_escape "${VITE_GATEWAY_URL:-}")",
  "VITE_AUTH0_DOMAIN": "$(json_escape "${VITE_AUTH0_DOMAIN:-}")",
  "VITE_AUTH0_CLIENT_ID": "$(json_escape "${VITE_AUTH0_CLIENT_ID:-}")",
  "VITE_AUTH0_REDIRECT_URI": "$(json_escape "${VITE_AUTH0_REDIRECT_URI:-}")"
};
EOF
