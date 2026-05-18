import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  return createAdminContext({ role: "user", openId: "regular-user", id: 2, ...overrides });
}

describe("usersAdmin.setRole", () => {
  it("rejects non-admin users with FORBIDDEN", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.usersAdmin.setRole({ userId: 3, role: "admin" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects admin self-demotion with BAD_REQUEST", async () => {
    const ctx = createAdminContext({ id: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.usersAdmin.setRole({ userId: 1, role: "user" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects non-admin from listing users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.usersAdmin.list({ page: 1, pageSize: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
