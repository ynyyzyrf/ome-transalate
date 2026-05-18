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
const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);
const TOKEN_EXPIRY = "8h";

export interface DashboardSession {
  adminId: number;
  username: string;
  displayName: string | null;
}

export async function signDashboardToken(session: DashboardSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyDashboardToken(token: string): Promise<DashboardSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      adminId: payload.adminId as number,
      username: payload.username as string,
      displayName: payload.displayName as string | null,
    };
  } catch {
    return null;
  }
}

/**
 * tRPC procedure that requires a valid dashboard session cookie.
 */
export const dashboardProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const cookieHeader = ctx.req.headers.cookie as string | undefined;
  let token: string | undefined;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DASHBOARD_COOKIE}=([^;]+)`));
    token = match?.[1];
  }

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入後台管理系統" });
  }

  const session = await verifyDashboardToken(token);
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "登入已過期，請重新登入" });
  }

  return next({ ctx: { ...ctx, dashboardSession: session } });
});

export { DASHBOARD_COOKIE };
