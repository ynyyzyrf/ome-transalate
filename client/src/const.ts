export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = (import.meta.env.VITE_OAUTH_PORTAL_URL || "").trim();
  const appId = (import.meta.env.VITE_APP_ID || "").trim();
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  // Fallback to local dashboard login when external OAuth config is absent/invalid.
  if (!oauthPortalUrl || !appId) {
    return `${window.location.origin}/dashboard/login`;
  }

  try {
    const url = new URL("/app-auth", oauthPortalUrl);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return `${window.location.origin}/dashboard/login`;
  }

};
