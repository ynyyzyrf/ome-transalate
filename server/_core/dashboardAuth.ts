/**
 * Dashboard Authentication
 * Simple username/password auth for the independent admin dashboard.
 * Uses a separate JWT cookie: dashboard_session
 */
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { publicProcedure } from "./trpc";
import { ENV } from "./env";

const DASHBOARD_COOKIE = "dashboard_session";
// Dashboard tokens use their own secret when configured (defense-in-depth); otherwise they
// fall back to the shared secret for backward compatibility. The type claim below is the
// primary gate — learner access tokens share the fallback secret but never carry type "dashboard".
const JWT_SECRET = new TextEncoder().encode(ENV.DASHBOARD_JWT_SECRET || ENV.cookieSecret);
const TOKEN_EXPIRY = "8h";

export interface DashboardSession {
  adminId: number;
  username: string;
  displayName: string | null;
}

export async function signDashboardToken(session: DashboardSession): Promise<string> {
  return new SignJWT({ ...session, type: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyDashboardToken(token: string): Promise<DashboardSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    // Only tokens explicitly issued as dashboard sessions are valid here. A token from the
    // learner access-token flow (type "access", same shared secret) must NOT pass.
    if (payload.type !== "dashboard" || typeof payload.adminId !== "number") {
      return null;
    }
    return {
      adminId: payload.adminId,
      username: typeof payload.username === "string" ? payload.username : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : null,
    };
  } catch {
    return null;
  }
}

export async function getDashboardSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<DashboardSession | null> {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DASHBOARD_COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) {
    return null;
  }

  return verifyDashboardToken(token);
}

/**
 * tRPC procedure that requires a valid dashboard session cookie.
 */
export const dashboardProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const session =
    ctx.dashboardSession ??
    (await getDashboardSessionFromCookieHeader(ctx.req.headers.cookie as string | undefined));

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入後台管理系統" });
  }

  return next({ ctx: { ...ctx, dashboardSession: session } });
});

export { DASHBOARD_COOKIE };
