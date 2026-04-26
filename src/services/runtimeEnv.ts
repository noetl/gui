type RuntimeEnv = Record<string, string | undefined>;

type WindowWithRuntimeEnv = Window & {
  __NOETL_ENV__?: RuntimeEnv;
};

function getRuntimeEnv(): RuntimeEnv {
  return ((window as WindowWithRuntimeEnv).__NOETL_ENV__ || {}) as RuntimeEnv;
}

export function readAppEnv(key: string, fallback = ""): string {
  const runtimeValue = getRuntimeEnv()[key];
  if (typeof runtimeValue === "string" && runtimeValue.trim().length > 0) {
    return runtimeValue.trim();
  }

  const buildEnv = import.meta.env as unknown as Record<string, string | undefined>;
  const buildValue = buildEnv[key];
  if (typeof buildValue === "string" && buildValue.trim().length > 0) {
    return buildValue.trim();
  }

  return fallback;
}

export function isEnvTrue(key: string, fallback = false): boolean {
  const value = readAppEnv(key, fallback ? "true" : "false");
  return value.toLowerCase() === "true";
}
