import { resolveAssetUrl } from "@shared/assetUrls";

export function resolveClientAssetUrl(url: string | null | undefined): string {
  return resolveAssetUrl(url, {
    apiBaseUrl: (import.meta.env.VITE_API_URL || "").trim(),
    currentOrigin:
      typeof window !== "undefined" ? window.location.origin : "",
  });
}
