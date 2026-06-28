type RuntimeConfig = {
  apiUrl?: string | null;
};

declare global {
  interface Window {
    __GF_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveApiUrl() {
  const runtimeValue =
    typeof window !== "undefined" ? normalizeUrl(window.__GF_RUNTIME_CONFIG__?.apiUrl) : null;
  if (runtimeValue) {
    return runtimeValue;
  }

  return "/api";
}
