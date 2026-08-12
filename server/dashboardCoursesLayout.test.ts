import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardCoursesPath = path.resolve(
  import.meta.dirname,
  "..",
  "client",
  "src",
  "pages",
  "dashboard",
  "DashboardCourses.tsx"
);

const courseEditDialogPath = path.resolve(
  import.meta.dirname,
  "..",
  "client",
  "src",
  "features",
  "dashboard-courses",
  "CourseEditDialog.tsx"
);

describe("DashboardCourses edit dialog layout", () => {
  const dialogSource = fs.readFileSync(courseEditDialogPath, "utf-8");

  it("uses a three-part dialog layout for the edit modal", () => {
    expect(dialogSource).toMatch(/showCloseButton=\{false\}/);
    expect(dialogSource).toMatch(/max-h-\[calc\(100vh-64px\)\]/);
    expect(dialogSource).toMatch(/overflow-hidden/);
    expect(dialogSource).toMatch(/flex-1 min-h-0 overflow-y-auto/);
    expect(dialogSource).toMatch(/shrink-0 border-t/);
  });

  it("separates section titles from form labels", () => {
    expect(dialogSource).toMatch(/t\("dashboard\.editBasic"\)/);
    expect(dialogSource).toMatch(/className="block[^"]*mb-2/);
  });
});

describe("DashboardCourses page composition", () => {
  const pageSource = fs.readFileSync(dashboardCoursesPath, "utf-8");

  it("is a thin orchestrator delegating to feature components", () => {
    // The page should no longer contain the full table / dialog JSX.
    expect(pageSource).toMatch(/from "@\/features\/dashboard-courses\//);
    expect(pageSource).toMatch(/<CourseListTable/);
    expect(pageSource).toMatch(/<CourseEditDialog/);
    expect(pageSource).toMatch(/<CourseCreateDialog/);
    expect(pageSource).toMatch(/<CourseDeleteDialog/);
    // Oversized-page guard: decomposed page stays well under the old 777 lines.
    expect(pageSource.split("\n").length).toBeLessThan(200);
  });
});
