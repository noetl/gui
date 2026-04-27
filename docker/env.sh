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

validate_proxy_upstream() {
  value="$1"
  if printf '%s' "$value" | grep -Eq '[[:space:];{}]'; then
    echo "ERROR: MCP_KUBERNETES_UPSTREAM contains unsafe characters." >&2
    exit 1
  fi
  case "$value" in
    http://*|https://*) ;;
    *)
      echo "ERROR: MCP_KUBERNETES_UPSTREAM must start with http:// or https://." >&2
      exit 1
      ;;
  esac
}

is_enabled() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on|enabled) return 0 ;;
    *) return 1 ;;
  esac
}

MCP_KUBERNETES_ENABLED_VALUE="${MCP_KUBERNETES_ENABLED:-${VITE_MCP_KUBERNETES_ENABLED:-false}}"
MCP_KUBERNETES_URL_VALUE=""
if is_enabled "$MCP_KUBERNETES_ENABLED_VALUE"; then
  MCP_KUBERNETES_ENABLED_VALUE="true"
  MCP_KUBERNETES_URL_VALUE="${VITE_MCP_KUBERNETES_URL:-}"
else
  MCP_KUBERNETES_ENABLED_VALUE="false"
fi

cat > "$ENV_FILE" <<EOF
window.__NOETL_ENV__ = {
  "VITE_API_MODE": "$(json_escape "${VITE_API_MODE:-}")",
  "VITE_API_BASE_URL": "$(json_escape "${VITE_API_BASE_URL:-}")",
  "VITE_ALLOW_SKIP_AUTH": "$(json_escape "${VITE_ALLOW_SKIP_AUTH:-}")",
  "VITE_GATEWAY_URL": "$(json_escape "${VITE_GATEWAY_URL:-}")",
  "VITE_AUTH0_DOMAIN": "$(json_escape "${VITE_AUTH0_DOMAIN:-}")",
  "VITE_AUTH0_CLIENT_ID": "$(json_escape "${VITE_AUTH0_CLIENT_ID:-}")",
  "VITE_AUTH0_REDIRECT_URI": "$(json_escape "${VITE_AUTH0_REDIRECT_URI:-}")",
  "VITE_MCP_KUBERNETES_ENABLED": "$(json_escape "$MCP_KUBERNETES_ENABLED_VALUE")",
  "VITE_MCP_KUBERNETES_URL": "$(json_escape "$MCP_KUBERNETES_URL_VALUE")",
  "VITE_APP_VERSION": "$(json_escape "${VITE_APP_VERSION:-${APP_VERSION:-0.0.0}}")"
};
EOF

mkdir -p "$MCP_LOCATION_DIR"
rm -f "$MCP_LOCATION_DIR"/*.conf
: > "$MCP_LOCATION_DIR/00-empty.conf"

if is_enabled "$MCP_KUBERNETES_ENABLED_VALUE" && [ -n "${MCP_KUBERNETES_UPSTREAM:-}" ]; then
  upstream="${MCP_KUBERNETES_UPSTREAM%/}"
  validate_proxy_upstream "$upstream"
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
