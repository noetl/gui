import { readAppEnv } from "./runtimeEnv";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function inferGatewayHostname(hostname: string): string {
  if (hostname === "gateway.mestumre.dev" || hostname.startsWith("gateway.")) {
    return hostname;
  }

  const strippedHost = hostname.replace(/^(www\.|gui\.)/i, "");
  return `gateway.${strippedHost}`;
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
  if (envValue && envValue.trim().length > 0) {
    return trimTrailingSlash(envValue.trim());
  }

  const { hostname, protocol, origin } = window.location;

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
