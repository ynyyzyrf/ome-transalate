import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";

const mocks = vi.hoisted(() => ({
  createFeedback: vi.fn(),
  getFeedbacksByUser: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    createFeedback: mocks.createFeedback,
    getFeedbacksByUser: mocks.getFeedbacksByUser,
  };
});

function createOAuthContext(role: "user" | "admin" = "user"): TrpcContext {
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

const submitInput = {
  tutorialId: 7,
  tutorialTitle: "課程一",
  originalText: "原文段落",
  translatedText: "translated",
  targetLanguage: "th",
  feedbackContent: "這裡有錯字",
};

describe("feedback submit auth policy", () => {
  beforeEach(() => {
    mocks.createFeedback.mockReset();
    mocks.getFeedbacksByUser.mockReset();
    mocks.createFeedback.mockResolvedValue(99);
    mocks.getFeedbacksByUser.mockResolvedValue([]);
  });

  it("lets dashboard admins submit feedback without a learner login", async () => {
    const caller = appRouter.createCaller(createDashboardContext());

    const result = await caller.feedbacks.submit(submitInput);

    expect(result).toEqual({ id: 99, success: true });
    // Dashboard admins live in admin_accounts, not users — their feedback must
    // be stored under a negative namespace so it can't collide with a learner's
    // users.id.
    expect(mocks.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ userId: -41, userName: "Dashboard Admin" })
    );
  });

  it("lets dashboard admins fetch their own feedback history", async () => {
    const caller = appRouter.createCaller(createDashboardContext());

    await caller.feedbacks.myFeedbacks({ tutorialId: 7 });

    expect(mocks.getFeedbacksByUser).toHaveBeenCalledWith(-41, 7);
  });

  it("keeps learner feedback submissions working", async () => {
    const caller = appRouter.createCaller(createOAuthContext("user"));

    const result = await caller.feedbacks.submit(submitInput);

    expect(result).toEqual({ id: 99, success: true });
    expect(mocks.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 32, userName: "user" })
    );
  });

  it("rejects anonymous feedback submission", async () => {
    const caller = appRouter.createCaller({
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
      user: null,
      authSource: null,
      dashboardSession: null,
    });

    await expect(caller.feedbacks.submit(submitInput)).rejects.toMatchObject<
      Partial<TRPCError>
    >({
      code: "UNAUTHORIZED",
    });
  });
});
