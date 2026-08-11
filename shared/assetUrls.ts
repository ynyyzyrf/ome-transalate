type ResolveAssetUrlOptions = {
  apiBaseUrl?: string;
  currentOrigin?: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function inferLocalApiOrigin(currentOrigin: string): string | null {
  const parsed = new URL(currentOrigin);
  const isLocalHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (isLocalHost && parsed.port === "5173") {
    return `${parsed.protocol}//${parsed.hostname}:3001`;
  }

  return null;
}

export function resolveAssetUrl(
  url: string | null | undefined,
  options: ResolveAssetUrlOptions = {}
): string {
  if (!url) return "";
  if (!url.startsWith("/")) return url;

  const apiBaseUrl = trimTrailingSlash(options.apiBaseUrl || "");
  if (apiBaseUrl) {
    return `${apiBaseUrl}${url}`;
  }

  const currentOrigin = options.currentOrigin || "";
  if (!currentOrigin) return url;

  const localApiOrigin = inferLocalApiOrigin(currentOrigin);
  if (localApiOrigin) {
    return `${localApiOrigin}${url}`;
  }

  return `${trimTrailingSlash(currentOrigin)}${url}`;
}
