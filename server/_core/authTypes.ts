import type { DashboardSession } from "./dashboardAuth";
import type { AuthSource } from "./context";

export type AnonymousPrincipal = {
  kind: "anonymous";
};

export type LearnerPrincipal = {
  kind: "learner";
  userId: number;
  authSource: AuthSource;
};

export type PlatformAdminPrincipal = {
  kind: "platform_admin";
  userId: number;
  authSource: AuthSource;
};

export type DashboardAdminPrincipal = DashboardSession & {
  kind: "dashboard_admin";
};

export type AuthPrincipal =
  | AnonymousPrincipal
  | LearnerPrincipal
  | PlatformAdminPrincipal
  | DashboardAdminPrincipal;

export type CourseManagementSurface = "documents" | "dashboard";
