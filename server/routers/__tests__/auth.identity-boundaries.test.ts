import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";
import { signDashboardToken } from "../../_core/dashboardAuth";

function createOAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 11 : 12,
      openId: `${role}-openid`,
      email: `${role}@example.com`,
      name: role === "admin" ? "OAuth Admin" : "Learner User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    authSource: "oauth",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

async function createDashboardContext() {
  const token = await signDashboardToken({
    adminId: 21,
    username: "dashboard-admin",
    displayName: "Dashboard Admin",
  });

  return {
    user: null,
    authSource: null,
    req: {
      protocol: "https",
      headers: {
        cookie: `dashboard_session=${token}`,
      },
    },
    res: {},
  } as TrpcContext;
}

describe("auth identity boundaries", () => {
  it("auth.me returns the OAuth learner identity from ctx.user", async () => {
    const caller = appRouter.createCaller(createOAuthContext("user"));

    const result = await caller.auth.me();

    expect(result).toMatchObject({
      id: 12,
      role: "user",
      email: "user@example.com",
      name: "Learner User",
    });
  });

  it("auth.me stays null for a dashboard-only session", async () => {
    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });

  it("dashboard.me returns the dashboard session identity", async () => {
    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.dashboard.me();

    expect(result).toEqual({
      adminId: 21,
      username: "dashboard-admin",
      displayName: "Dashboard Admin",
    });
  });

  it("dashboard.me returns null for an OAuth admin without a dashboard session", async () => {
    const caller = appRouter.createCaller(createOAuthContext("admin"));

    // A missing dashboard session is a normal state (anonymous / learner / OAuth
    // admin who hasn't signed into the dashboard) — it returns null rather than
    // throwing, so frontend queries can treat "no admin session" like "no user".
    const result = await caller.dashboard.me();

    expect(result).toBeNull();
  });

  it("documents.list rejects a dashboard-only session because it requires ctx.user", async () => {
    const caller = appRouter.createCaller(await createDashboardContext());

    await expect(
      caller.documents.list({
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
    });
  });
});
