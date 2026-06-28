function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveBackendApiUrl() {
  const value = normalizeUrl(process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL);
  return value ?? "http://localhost:3001";
}
