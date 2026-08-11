import type { TrpcContext } from "./context";
import type { AuthPrincipal, CourseManagementSurface } from "./authTypes";

export function resolvePrincipal(ctx: TrpcContext): AuthPrincipal {
  if (ctx.dashboardSession) {
    return {
      kind: "dashboard_admin",
      adminId: ctx.dashboardSession.adminId,
      username: ctx.dashboardSession.username,
      displayName: ctx.dashboardSession.displayName,
    };
  }

  if (!ctx.user) {
    return { kind: "anonymous" };
  }

  if (ctx.user.role === "admin") {
    return {
      kind: "platform_admin",
      userId: ctx.user.id,
      authSource: ctx.authSource,
    };
  }

  return {
    kind: "learner",
    userId: ctx.user.id,
    authSource: ctx.authSource,
  };
}

export function canManageGlossary(principal: AuthPrincipal): boolean {
  return principal.kind === "platform_admin" || principal.kind === "dashboard_admin";
}

export function canManagePlatformAdmin(principal: AuthPrincipal): boolean {
  return principal.kind === "platform_admin";
}

export function canViewDashboard(principal: AuthPrincipal): boolean {
  return principal.kind === "dashboard_admin";
}

export function canManageCourses(
  principal: AuthPrincipal,
  surface: CourseManagementSurface,
): boolean {
  if (surface === "documents") {
    return principal.kind === "platform_admin";
  }

  return principal.kind === "dashboard_admin";
}

export function getPrincipalActorId(principal: AuthPrincipal): number | null {
  switch (principal.kind) {
    case "platform_admin":
    case "learner":
      return principal.userId;
    case "dashboard_admin":
      return principal.adminId;
    default:
      return null;
  }
}
