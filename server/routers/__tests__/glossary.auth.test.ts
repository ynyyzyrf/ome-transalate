import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";

const mocks = vi.hoisted(() => ({
  listGlossaryEntries: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    listGlossaryEntries: mocks.listGlossaryEntries,
  };
});

function createOAuthContext(role: "user" | "admin"): TrpcContext {
  return {
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: role === "admin" ? 31 : 32,
      openId: `${role}-openid`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    authSource: "oauth",
    dashboardSession: null,
  };
}

function createDashboardContext(): TrpcContext {
  return {
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null,
    authSource: null,
    dashboardSession: {
      adminId: 41,
      username: "dashboard-admin",
      displayName: "Dashboard Admin",
    },
  };
}

describe("glossary auth policy", () => {
  beforeEach(() => {
    mocks.listGlossaryEntries.mockReset();
    mocks.listGlossaryEntries.mockResolvedValue([]);
  });

  it("allows platform admins to access glossary routes", async () => {
    const caller = appRouter.createCaller(createOAuthContext("admin"));

    const result = await caller.glossary.list();

    expect(result).toEqual([]);
  });

  it("allows dashboard admins to access glossary routes", async () => {
    const caller = appRouter.createCaller(createDashboardContext());

    const result = await caller.glossary.list();

    expect(result).toEqual([]);
  });

  it("rejects learner users from glossary routes", async () => {
    const caller = appRouter.createCaller(createOAuthContext("user"));

    await expect(caller.glossary.list()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
    });
  });
});
