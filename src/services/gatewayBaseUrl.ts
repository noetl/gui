import { readAppEnv } from "./runtimeEnv";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

// LAN-access correction. The local kind deployment bakes
// `VITE_API_BASE_URL=http://localhost:8082` into the helm chart, which is
// fine when the GUI is opened on the same machine — but breaks the moment
// another LAN client points its browser at the host's NodePort. From that
// client, `localhost` resolves back to itself, not the Mac running kind.
//
// Rule: if the env-configured base URL has a localhost hostname but the
// page itself is loaded from a non-localhost host, rewrite the env URL's
// hostname to match the page's hostname. Preserves scheme + port. Applies
// ONLY in this asymmetry; if the page is already on localhost (single-
// machine dev), leave the env value untouched.
function rewriteLocalhostForLan(envValue: string, pageHostname: string): string {
  if (isLocalHost(pageHostname)) return envValue;
  try {
    const parsed = new URL(envValue);
    if (isLocalHost(parsed.hostname)) {
      parsed.hostname = pageHostname;
      return trimTrailingSlash(parsed.toString());
    }
  } catch {
    // Non-URL string (relative path, malformed entry). Leave as-is.
  }
  return envValue;
}

function inferGatewayHostname(hostname: string): string {
  if (hostname.startsWith("gateway.")) {
    return hostname;
  }

  // ⚠ PREFIX THE REGISTRABLE DOMAIN, NOT THE FULL HOST.
  //
  // The old rule was `gateway.${hostname}` after stripping only `www.`/`gui.`,
  // which turns a THREE-label host into a four-label one that nobody
  // registers: `noetl.mestumre.dev` -> `gateway.noetl.mestumre.dev`, NXDOMAIN.
  // The deployed GUI had exactly this: every API call resolved to a host that
  // does not exist, so the app loaded and then failed silently against its own
  // backend. The identical bug took down team4.mestumre.dev
  // (adiona/frontend#29) — same shape, same fix.
  //
  // Drop the leading label when there are 3+ of them so a subdomain deployment
  // reaches the zone's gateway: noetl.mestumre.dev -> gateway.mestumre.dev.
  // A two-label apex keeps all of it: noetl.ai -> gateway.noetl.ai.
  //
  // This is a LAST RESORT. Set VITE_GATEWAY_URL (or VITE_API_BASE_URL in
  // direct mode) explicitly for any real deployment; inference cannot know
  // that a zone puts its API somewhere else, and a wrong guess fails silently.
  const strippedHost = hostname.replace(/^(www\.|gui\.)/i, "");
  const labels = strippedHost.split(".");
  const base = labels.length >= 3 ? labels.slice(1).join(".") : strippedHost;
  return `gateway.${base}`;
}

export function resolveApiMode(): "gateway" | "direct" {
  const envMode = readAppEnv("VITE_API_MODE");
  return envMode === "direct" ? "direct" : "gateway";
}

export function resolveGatewayBaseUrl(): string {
  const mode = resolveApiMode();
  const envValue = mode === "direct"
    ? readAppEnv("VITE_API_BASE_URL")
    : readAppEnv("VITE_GATEWAY_URL");
  const { hostname, protocol, origin } = window.location;

  if (envValue && envValue.trim().length > 0) {
    const trimmed = trimTrailingSlash(envValue.trim());
    return rewriteLocalhostForLan(trimmed, hostname);
  }

  if (isLocalHost(hostname)) {
    return mode === "direct" ? "http://localhost:8082" : "http://localhost:8090";
  }

  if (mode === "direct") {
    return trimTrailingSlash(origin);
  }

  const inferredGatewayHost = inferGatewayHostname(hostname);
  if (inferredGatewayHost === hostname) {
    return trimTrailingSlash(origin);
  }

  return trimTrailingSlash(`${protocol}//${inferredGatewayHost}`);
}
