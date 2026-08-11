/**
 * Local user session authentication
 * Issues a signed JWT cookie (local_session) for email+password users (learners),
 * so useAuth()/auth.me resolves them as ctx.user via the cookie — no Bearer token plumbing.
 */
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export const LOCAL_SESSION_COOKIE = "local_session";

const TOKEN_EXPIRY = "8h";

export interface LocalSession {
  userId: number;
  email: string;
  role: "admin" | "user";
}

export async function signLocalSessionToken(session: LocalSession): Promise<string> {
  return new SignJWT({ ...session, type: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

export async function verifyLocalSessionToken(
  token: string
): Promise<LocalSession | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), {
      algorithms: ["HS256"],
    });
    // Only tokens explicitly issued as local sessions are valid here.
    if (
      payload.type !== "local" ||
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export async function getLocalSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<LocalSession | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCAL_SESSION_COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;
  return verifyLocalSessionToken(token);
}
