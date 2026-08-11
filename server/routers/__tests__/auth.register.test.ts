import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";
import { LOCAL_SESSION_COOKIE } from "../../_core/localAuth";

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getAdminByUsername: vi.fn(),
  createLocalUser: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    getUserByEmail: mocks.getUserByEmail,
    getAdminByUsername: mocks.getAdminByUsername,
    createLocalUser: mocks.createLocalUser,
    updateUserLastSignedIn: mocks.updateUserLastSignedIn,
  };
});

function createContext() {
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const ctx: TrpcContext = {
    user: null,
    authSource: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

beforeEach(() => {
  mocks.getUserByEmail.mockReset();
  mocks.getAdminByUsername.mockReset();
  mocks.createLocalUser.mockReset();
  mocks.updateUserLastSignedIn.mockReset();
});

describe("auth.register", () => {
  it("creates a learner, sets local_session cookie, and routes to /learn", async () => {
    mocks.getUserByEmail.mockResolvedValue(null); // email not taken
    mocks.createLocalUser.mockResolvedValue(42);

    const { ctx, cookies } = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.register({
      email: "new@example.com",
      password: "secret123",
      name: "New Learner",
    });

    expect(result).toEqual({
      role: "user",
      redirect: "/learn",
      user: { id: 42, email: "new@example.com", name: "New Learner", role: "user" },
    });

    // One httpOnly local_session cookie is set (auto-login).
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(LOCAL_SESSION_COOKIE);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, path: "/" });
  });

  it("rejects an email that is already registered", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 1, email: "taken@example.com" });

    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({ email: "Taken@Example.com", password: "secret123" })
    ).rejects.toMatchObject<Partial<TRPCError>>({ code: "CONFLICT" });

    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("lowercases the email before checking uniqueness", async () => {
    mocks.getUserByEmail.mockResolvedValue(null);
    mocks.createLocalUser.mockResolvedValue(7);

    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.register({
      email: "  MixedCase@Example.com  ",
      password: "secret123",
    });

    expect(mocks.getUserByEmail).toHaveBeenCalledWith("mixedcase@example.com");
    expect(result.user.email).toBe("mixedcase@example.com");
  });

  it("rejects passwords shorter than 6 characters", async () => {
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({ email: "short@example.com", password: "12345" })
    ).rejects.toThrow();
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
  });
});
