import { describe, expect, it } from "vitest";
import { textToSegments } from "./documentParser";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { LOCAL_SESSION_COOKIE } from "./_core/localAuth";
import { DASHBOARD_COOKIE } from "./_core/dashboardAuth";
import type { TrpcContext } from "./_core/context";

// ─── Document Parser Tests ────────────────────────────────────────────────────
describe("textToSegments", () => {
  it("splits paragraphs into segments", () => {
    const text = "第一段落\n\n第二段落\n\n第三段落";
    const { segments, extractedText } = textToSegments(text);
    expect(segments).toHaveLength(3);
    expect(segments[0]?.id).toBe("seg-0001");
    expect(segments[0]?.text).toBe("第一段落");
    expect(segments[1]?.order).toBe(2);
    expect(extractedText).toContain("第一段落");
  });

  it("filters empty lines", () => {
    const text = "\n\n有效段落\n\n\n\n另一段落\n\n";
    const { segments } = textToSegments(text);
    expect(segments).toHaveLength(2);
  });

  it("detects heading type for short Chinese text", () => {
    const text = "培訓手冊";
    const { segments } = textToSegments(text);
    expect(segments[0]?.type).toBe("heading");
  });

  it("assigns paragraph type for long text", () => {
    const text = "這是一個比較長的段落，包含了很多內容和詳細的說明文字，超過了標題的長度限制。";
    const { segments } = textToSegments(text);
    expect(segments[0]?.type).toBe("paragraph");
  });

  it("returns empty segments for empty input", () => {
    const { segments } = textToSegments("");
    expect(segments).toHaveLength(0);
  });
});

// ─── Auth Logout Tests ────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext() {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    preferredLanguage: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(3);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
    // The local session cookie (learners) is cleared too.
    expect(clearedCookies[1]?.name).toBe(LOCAL_SESSION_COOKIE);
    expect(clearedCookies[1]?.options).toMatchObject({ maxAge: -1 });
    // The dashboard admin session cookie is cleared too.
    expect(clearedCookies[2]?.name).toBe(DASHBOARD_COOKIE);
    expect(clearedCookies[2]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Glossary CSV Parsing Tests ───────────────────────────────────────────────
describe("glossary CSV parsing", () => {
  it("parses valid CSV lines correctly", () => {
    const csvText = "開戶流程, Account Opening Process\n風險管理, Risk Management\n合規要求, Compliance Requirements";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
    const entries: { sourceTerm: string; targetTerm: string }[] = [];
    for (const line of lines) {
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) continue;
      const sourceTerm = line.slice(0, commaIdx).trim();
      const targetTerm = line.slice(commaIdx + 1).trim();
      if (sourceTerm && targetTerm) entries.push({ sourceTerm, targetTerm });
    }
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ sourceTerm: "開戶流程", targetTerm: "Account Opening Process" });
    expect(entries[1]).toEqual({ sourceTerm: "風險管理", targetTerm: "Risk Management" });
  });

  it("skips comment lines starting with #", () => {
    const csvText = "# 術語庫\n開戶流程, Account Opening Process\n# 另一個注釋\n風險管理, Risk Management";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
    expect(lines).toHaveLength(2);
  });

  it("skips lines without comma", () => {
    const csvText = "無效行\n開戶流程, Account Opening Process";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
    const entries: { sourceTerm: string; targetTerm: string }[] = [];
    for (const line of lines) {
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) continue;
      const sourceTerm = line.slice(0, commaIdx).trim();
      const targetTerm = line.slice(commaIdx + 1).trim();
      if (sourceTerm && targetTerm) entries.push({ sourceTerm, targetTerm });
    }
    expect(entries).toHaveLength(1);
  });
});
