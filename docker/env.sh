#!/bin/sh
set -eu

ENV_FILE="/usr/share/nginx/html/env-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"
MCP_LOCATION_DIR="/etc/nginx/noetl-locations"

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
  "VITE_AUTH0_REDIRECT_URI": "$(json_escape "${VITE_AUTH0_REDIRECT_URI:-}")",
  "VITE_MCP_KUBERNETES_URL": "$(json_escape "${VITE_MCP_KUBERNETES_URL:-}")"
};
EOF

mkdir -p "$MCP_LOCATION_DIR"
rm -f "$MCP_LOCATION_DIR"/*.conf

if [ -n "${MCP_KUBERNETES_UPSTREAM:-}" ]; then
  upstream="${MCP_KUBERNETES_UPSTREAM%/}"
  cat > "$MCP_LOCATION_DIR/kubernetes.conf" <<EOF
location = /mcp/kubernetes {
  proxy_http_version 1.1;
  proxy_buffering off;
  proxy_read_timeout 120s;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_pass ${upstream}/mcp;
}

location = /mcp/kubernetes/healthz {
  proxy_pass ${upstream}/healthz;
}

location = /mcp/kubernetes/stats {
  proxy_pass ${upstream}/stats;
}
EOF
fi

if [ -f "$INDEX_FILE" ]; then
  cache_buster="$(date +%s)"
  sed -i -E "s|<script src=\"/env-config.js(\\?v=[^\"]*)?\"></script>|<script src=\"/env-config.js?v=${cache_buster}\"></script>|" "$INDEX_FILE"
fi
