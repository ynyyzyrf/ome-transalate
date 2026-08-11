import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";

const mocks = vi.hoisted(() => ({
  bulkCreateGlossaryEntries: vi.fn(),
  createGlossaryBatch: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    bulkCreateGlossaryEntries: mocks.bulkCreateGlossaryEntries,
    createGlossaryBatch: mocks.createGlossaryBatch,
  };
});

vi.mock("../../storage", () => ({
  storagePut: mocks.storagePut,
}));

function createDashboardContext(): TrpcContext {
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
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

function csvB64(lines: string[]): string {
  return Buffer.from(lines.join("\n"), "utf-8").toString("base64");
}

describe("glossary.uploadCsv header handling", () => {
  beforeEach(() => {
    mocks.bulkCreateGlossaryEntries.mockReset();
    mocks.createGlossaryBatch.mockReset();
    mocks.storagePut.mockReset();
    mocks.bulkCreateGlossaryEntries.mockResolvedValue(undefined);
    mocks.createGlossaryBatch.mockResolvedValue(undefined);
    mocks.storagePut.mockResolvedValue({ key: "k", url: "u" });
  });

  it("skips the Chinese template header row and imports the real entries", async () => {
    const csv = [
      "中文術語,英文,西班牙語,泰文,印地語,越南文",
      "開戶,Open Account,Apertura de cuenta,,,",
      "身分證,ID Card,,,,",
    ];
    const caller = appRouter.createCaller(createDashboardContext());
    const result = await caller.glossary.uploadCsv({
      filename: "terms.csv",
      base64Content: csvB64(csv),
    });

    expect(result).toEqual({ count: 2 });
    const entries = mocks.bulkCreateGlossaryEntries.mock.calls[0][0] as Array<{
      sourceTerm: string;
    }>;
    expect(entries.map((e) => e.sourceTerm)).toEqual(["開戶", "身分證"]);
  });

  it("skips English header rows too", async () => {
    const csv = [
      "sourceTerm,englishTerm,spanishTerm,thaiTerm,hindiTerm,vietnameseTerm",
      "開戶,Open Account,,,,",
    ];
    const caller = appRouter.createCaller(createDashboardContext());
    const result = await caller.glossary.uploadCsv({
      filename: "terms.csv",
      base64Content: csvB64(csv),
    });

    expect(result).toEqual({ count: 1 });
    const entries = mocks.bulkCreateGlossaryEntries.mock.calls[0][0] as Array<{
      sourceTerm: string;
    }>;
    expect(entries[0].sourceTerm).toBe("開戶");
  });

  it("imports a headerless CSV unchanged", async () => {
    const csv = ["開戶,Open Account,,,,"];
    const caller = appRouter.createCaller(createDashboardContext());
    const result = await caller.glossary.uploadCsv({
      filename: "terms.csv",
      base64Content: csvB64(csv),
    });

    expect(result).toEqual({ count: 1 });
    const entries = mocks.bulkCreateGlossaryEntries.mock.calls[0][0] as Array<{
      sourceTerm: string;
    }>;
    expect(entries[0].sourceTerm).toBe("開戶");
  });
});
