/**
 * OIDC Authentication Router (placeholder)
 *
 * TODO: Implement OIDC integration for internal SSO login.
 * Required steps when the OIDC provider is available:
 *
 * 1. Add env vars to env.ts:
 *    - OIDC_ISSUER_URL  — the OIDC provider's issuer URL (e.g. https://sso.company.com/auth/realms/your-realm)
 *    - OIDC_CLIENT_ID   — the client ID registered with the OIDC provider
 *    - OIDC_CLIENT_SECRET — the client secret (if confidential client)
 *    - OIDC_JWKS_URL    — URL to fetch JWKS keys (often derived from issuer)
 *
 * 2. Install:  pnpm add jose (already installed)
 *
 * 3. Create a utility at server/_core/oidc.ts that:
 *    - Fetches and caches JWKS keys from the OIDC provider
 *    - Verifies JWT tokens (id_token / access_token) against JWKS
 *    - Validates the `iss`, `aud`, `exp`, and `sub` claims
 *    - Returns user claims (email, name, sub)
 *
 * 4. In server/_core/context.ts, add OIDC token verification in the
 *    "Try OIDC auth" section (placeholder already there).
 *
 * 5. Sync user from OIDC claims to local DB:
 *    - Use `sub` claim as the unique identifier (store in users.openId)
 *    - Upsert user with email, name, loginMethod = "oidc"
 *
 * 6. Frontend: redirect to OIDC provider's authorization endpoint,
 *    handle the callback, then pass the id_token/access_token to
 *    the tRPC API via Authorization: Bearer header.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * OIDC configuration that will be needed:
 *
 * export const OIDC_CONFIG = {
 *   issuerUrl: process.env.OIDC_ISSUER_URL ?? "",
 *   clientId: process.env.OIDC_CLIENT_ID ?? "",
 *   jwksUrl: process.env.OIDC_JWKS_URL ?? `${process.env.OIDC_ISSUER_URL}/protocol/openid-connect/certs`,
 * };
 */

export const authOidcRouter = router({
  /**
   * Initiate OIDC login flow.
   * Returns the authorization URL the frontend should redirect to.
   * TODO: Implement when OIDC provider is configured.
   */
  login: publicProcedure
    .input(
      z.object({
        redirectUri: z.string().url(),
      }).optional()
    )
    .query(async () => {
      // TODO: Build and return the OIDC authorization URL:
      //   `${OIDC_CONFIG.issuerUrl}/protocol/openid-connect/auth` +
      //   `?client_id=${OIDC_CONFIG.clientId}` +
      //   `&response_type=code` +
      //   `&scope=openid profile email` +
      //   `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      //   `&state=${crypto.randomUUID()}`
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "OIDC login is not yet configured. Please use email/password login or contact your administrator.",
      });
    }),

  /**
   * Handle OIDC callback (exchange authorization code for tokens).
   * TODO: Implement when OIDC provider is configured.
   */
  callback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
        redirectUri: z.string().url(),
      })
    )
    .mutation(async () => {
      // TODO:
      // 1. Exchange authorization code for id_token + access_token
      // 2. Verify id_token signature using JWKS
      // 3. Extract user claims from id_token
      // 4. Upsert user in local DB
      // 5. Return access_token for subsequent API calls
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "OIDC callback handling is not yet implemented.",
      });
    }),

  /**
   * Get current user info from OIDC session.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.authSource !== "oidc") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This endpoint is only available for OIDC-authenticated users.",
      });
    }
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
    };
  }),
});
