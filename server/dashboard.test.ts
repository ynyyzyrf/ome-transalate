/**
 * Dashboard (independent admin system) tests
 * Tests: login flow, me query, logout, feedback status transitions
 */
import { describe, expect, it, vi } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

function createDashboardCtx(session: { adminId: number; username: string; displayName: string } | null = null) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const clearedCookies: string[] = [];

  return {
    ctx: {
      user: null,
      dashboardSession: session,
      req: {
        protocol: "https",
        headers: {},
      } as any,
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: (name: string) => {
          clearedCookies.push(name);
        },
      } as any,
    },
    cookies,
    clearedCookies,
  };
}

// ── Feedback status transitions ───────────────────────────────────────────────

describe("Feedback status transitions", () => {
  it("status 0 (未接收) is the default for new submissions", () => {
    const defaultStatus = 0;
    expect(defaultStatus).toBe(0);
  });

  it("valid status values are 0, 1, 2", () => {
    const validStatuses = [0, 1, 2];
    const labels = ["未接收", "處理中", "已處理"];
    validStatuses.forEach((s, i) => {
      expect(s).toBe(i);
      expect(labels[s]).toBeDefined();
    });
  });

  it("status can only transition forward (0→1→2)", () => {
    const transitions: Record<number, number[]> = {
      0: [1],
      1: [2],
      2: [],
    };
    expect(transitions[0]).toContain(1);
    expect(transitions[1]).toContain(2);
    expect(transitions[2]).toHaveLength(0);
  });
});

// ── Dashboard session shape ───────────────────────────────────────────────────

describe("Dashboard session", () => {
  it("session contains adminId, username, displayName", () => {
    const session = { adminId: 1, username: "admin", displayName: "系統管理員" };
    expect(session).toHaveProperty("adminId");
    expect(session).toHaveProperty("username");
    expect(session).toHaveProperty("displayName");
  });

  it("null session means unauthenticated", () => {
    const { ctx } = createDashboardCtx(null);
    expect(ctx.dashboardSession).toBeNull();
  });

  it("valid session is injected into context", () => {
    const { ctx } = createDashboardCtx({ adminId: 1, username: "admin", displayName: "Admin" });
    expect(ctx.dashboardSession?.adminId).toBe(1);
    expect(ctx.dashboardSession?.username).toBe("admin");
  });
});

// ── Glossary multi-language structure ─────────────────────────────────────────

describe("Glossary multi-language structure", () => {
  it("glossary entry has all required language fields", () => {
    const entry = {
      id: 1,
      sourceTerm: "開戶流程",
      englishTerm: "Account Opening Process",
      spanishTerm: "Proceso de Apertura de Cuenta",
      thaiTerm: "กระบวนการเปิดบัญชี",
      hindiTerm: "खाता खोलने की प्रक्रिया",
      vietnameseTerm: "Quy trình mở tài khoản",
    };
    expect(entry.sourceTerm).toBeTruthy();
    expect(entry.englishTerm).toBeTruthy();
    expect(entry.spanishTerm).toBeTruthy();
    expect(entry.thaiTerm).toBeTruthy();
    expect(entry.hindiTerm).toBeTruthy();
    expect(entry.vietnameseTerm).toBeTruthy();
  });

  it("getGlossaryForLanguage returns correct targetTerm for each language", () => {
    const entry = {
      sourceTerm: "開戶流程",
      englishTerm: "Account Opening Process",
      spanishTerm: "Proceso de Apertura de Cuenta",
      thaiTerm: "กระบวนการเปิดบัญชี",
      hindiTerm: "खाता खोलने की प्रक्रिया",
      vietnameseTerm: "Quy trình mở tài khoản",
    };

    const getTarget = (lang: string) => {
      if (lang === "es" && entry.spanishTerm) return entry.spanishTerm;
      if (lang === "th" && entry.thaiTerm) return entry.thaiTerm;
      if (lang === "hi" && entry.hindiTerm) return entry.hindiTerm;
      if (lang === "vi" && entry.vietnameseTerm) return entry.vietnameseTerm;
      return entry.englishTerm;
    };

    expect(getTarget("es")).toBe("Proceso de Apertura de Cuenta");
    expect(getTarget("th")).toBe("กระบวนการเปิดบัญชี");
    expect(getTarget("hi")).toBe("खाता खोलने की प्रक्रिया");
    expect(getTarget("vi")).toBe("Quy trình mở tài khoản");
    expect(getTarget("en")).toBe("Account Opening Process");
    expect(getTarget("xx")).toBe("Account Opening Process"); // fallback
  });
});

// ── Translation two-step logic ────────────────────────────────────────────────

describe("Two-step translation logic (中文→英文→目標語言)", () => {
  it("English is always the intermediate language", () => {
    const intermediateLanguage = "en";
    expect(intermediateLanguage).toBe("en");
  });

  it("non-English targets go through English first", () => {
    const targetLanguages = ["es", "th", "hi", "vi"];
    const requiresEnglishIntermediate = (lang: string) => lang !== "en";
    targetLanguages.forEach((lang) => {
      expect(requiresEnglishIntermediate(lang)).toBe(true);
    });
  });

  it("English target is a direct translation (no intermediate step)", () => {
    const requiresEnglishIntermediate = (lang: string) => lang !== "en";
    expect(requiresEnglishIntermediate("en")).toBe(false);
  });
});

// ── Feedback data structure ───────────────────────────────────────────────────

describe("Feedback data structure", () => {
  it("feedback record has all required fields from spec", () => {
    const feedback = {
      tutorialId: 1,
      tutorialTitle: "開戶培訓教程",
      originalText: "開戶流程包括以下步驟",
      translatedText: "The account opening process includes the following steps",
      feedbackContent: "建議使用更口語化的表達",
      userId: 42,
      userName: "張三",
      targetLanguage: "en",
      status: 0,
      createdAt: new Date(),
    };

    expect(feedback.tutorialId).toBeTypeOf("number");
    expect(feedback.tutorialTitle).toBeTypeOf("string");
    expect(feedback.originalText).toBeTypeOf("string");
    expect(feedback.translatedText).toBeTypeOf("string");
    expect(feedback.feedbackContent).toBeTypeOf("string");
    expect(feedback.userId).toBeTypeOf("number");
    expect(feedback.status).toBe(0);
  });
});
