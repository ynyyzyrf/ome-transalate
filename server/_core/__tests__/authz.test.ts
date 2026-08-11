import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../context";
import {
  canManageCourses,
  canManageGlossary,
  canManagePlatformAdmin,
  canViewDashboard,
  resolvePrincipal,
} from "../authz";
import type { DashboardSession } from "../dashboardAuth";

function createBaseContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null,
    authSource: null,
    dashboardSession: null,
    ...overrides,
  };
}

function createDashboardSession(): DashboardSession {
  return {
    adminId: 21,
    username: "dashboard-admin",
    displayName: "Dashboard Admin",
  };
}

describe("authz principal resolution", () => {
  it("resolves an anonymous principal when no identity is present", () => {
    const principal = resolvePrincipal(createBaseContext());

    expect(principal).toEqual({
      kind: "anonymous",
    });
  });

  it("resolves a learner principal for non-admin ctx.user", () => {
    const principal = resolvePrincipal(
      createBaseContext({
        user: {
          id: 7,
          openId: "learner-7",
          email: "learner@example.com",
          name: "Learner",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );

    expect(principal).toMatchObject({
      kind: "learner",
      userId: 7,
      authSource: "oauth",
    });
  });

  it("resolves a platform admin principal for admin ctx.user", () => {
    const principal = resolvePrincipal(
      createBaseContext({
        user: {
          id: 8,
          openId: "admin-8",
          email: "admin@example.com",
          name: "Admin",
          loginMethod: "manus",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );

    expect(principal).toMatchObject({
      kind: "platform_admin",
      userId: 8,
      authSource: "oauth",
    });
  });

  it("resolves a dashboard admin principal for dashboard session", () => {
    const principal = resolvePrincipal(
      createBaseContext({
        dashboardSession: createDashboardSession(),
      }),
    );

    expect(principal).toEqual({
      kind: "dashboard_admin",
      adminId: 21,
      username: "dashboard-admin",
      displayName: "Dashboard Admin",
    });
  });
});

describe("authz policies", () => {
  it("allows only platform and dashboard admins to manage glossary", () => {
    const anonymous = resolvePrincipal(createBaseContext());
    const learner = resolvePrincipal(
      createBaseContext({
        user: {
          id: 9,
          openId: "learner-9",
          email: "learner9@example.com",
          name: "Learner",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const platformAdmin = resolvePrincipal(
      createBaseContext({
        user: {
          id: 10,
          openId: "admin-10",
          email: "admin10@example.com",
          name: "Admin",
          loginMethod: "manus",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const dashboardAdmin = resolvePrincipal(
      createBaseContext({
        dashboardSession: createDashboardSession(),
      }),
    );

    expect(canManageGlossary(anonymous)).toBe(false);
    expect(canManageGlossary(learner)).toBe(false);
    expect(canManageGlossary(platformAdmin)).toBe(true);
    expect(canManageGlossary(dashboardAdmin)).toBe(true);
  });

  it("limits dashboard access to dashboard admins", () => {
    const platformAdmin = resolvePrincipal(
      createBaseContext({
        user: {
          id: 11,
          openId: "admin-11",
          email: "admin11@example.com",
          name: "Admin",
          loginMethod: "manus",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const dashboardAdmin = resolvePrincipal(
      createBaseContext({
        dashboardSession: createDashboardSession(),
      }),
    );

    expect(canViewDashboard(platformAdmin)).toBe(false);
    expect(canViewDashboard(dashboardAdmin)).toBe(true);
  });

  it("limits platform admin surfaces to platform admins", () => {
    const learner = resolvePrincipal(
      createBaseContext({
        user: {
          id: 13,
          openId: "learner-13",
          email: "learner13@example.com",
          name: "Learner",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const platformAdmin = resolvePrincipal(
      createBaseContext({
        user: {
          id: 14,
          openId: "admin-14",
          email: "admin14@example.com",
          name: "Admin",
          loginMethod: "manus",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const dashboardAdmin = resolvePrincipal(
      createBaseContext({
        dashboardSession: createDashboardSession(),
      }),
    );

    expect(canManagePlatformAdmin(learner)).toBe(false);
    expect(canManagePlatformAdmin(platformAdmin)).toBe(true);
    expect(canManagePlatformAdmin(dashboardAdmin)).toBe(false);
  });

  it("limits courses management according to current split: platform admins manage documents, dashboard admins manage dashboard courses", () => {
    const platformAdmin = resolvePrincipal(
      createBaseContext({
        user: {
          id: 12,
          openId: "admin-12",
          email: "admin12@example.com",
          name: "Admin",
          loginMethod: "manus",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"],
        authSource: "oauth",
      }),
    );
    const dashboardAdmin = resolvePrincipal(
      createBaseContext({
        dashboardSession: createDashboardSession(),
      }),
    );

    expect(canManageCourses(platformAdmin, "documents")).toBe(true);
    expect(canManageCourses(platformAdmin, "dashboard")).toBe(false);
    expect(canManageCourses(dashboardAdmin, "documents")).toBe(false);
    expect(canManageCourses(dashboardAdmin, "dashboard")).toBe(true);
  });
});
