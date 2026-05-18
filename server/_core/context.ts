import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyLocalToken } from "../routers/authLocal";
import * as db from "../db";

export type AuthSource = "oauth" | "local" | "oidc" | null;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authSource: AuthSource;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authSource: AuthSource = null;

  try {
    // Try OAuth session (existing)
    user = await sdk.authenticateRequest(opts.req);
    if (user) {
      authSource = "oauth";
    }
  } catch {
    // OAuth auth failed, try local auth
  }

  // Try OIDC auth via Authorization header (Bearer token from external OIDC provider)
  if (!user) {
    try {
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        // TODO: Implement OIDC token verification
        // 1. Verify JWT against OIDC provider's JWKS endpoint
        // 2. Extract user claims (email, name, sub)
        // 3. Upsert user in local DB
        // 4. Set user and authSource = "oidc"
        //
        // Placeholder — OIDC integration will be added when the internal
        // OIDC provider is available. For now, if the local token check
        // below fails, the user remains unauthenticated.
      }
    } catch {
      // OIDC not configured — skip
    }
  }

  // Try local auth via Authorization header (as fallback)
  if (!user) {
    try {
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const payload = await verifyLocalToken(token);
        if (payload && payload.type === "access") {
          // Fetch user from DB by email
          const localUser = await db.getUserByEmail(payload.email);
          if (localUser) {
            user = localUser;
            authSource = "local";
          }
        }
      }
    } catch {
      // Local auth failed, continue as unauthenticated
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authSource,
  };
}
