/**
 * Glossary Router
 * Multi-language glossary management: English as base, with ES/TH/HI/VI translations.
 * CSV format: 中文術語, 英文, 西班牙語, 泰文, 印地語, 越南文
 *
 * Auth: accepts both OAuth admin sessions AND dashboard sessions.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { verifyDashboardToken, DASHBOARD_COOKIE } from "../_core/dashboardAuth";
import {
  bulkCreateGlossaryEntries,
  createGlossaryBatch,
  createGlossaryEntry,
  deleteGlossaryEntry,
  listGlossaryBatches,
  listGlossaryEntries,
} from "../db";
import { storagePut } from "../storage";

/**
 * Auth middleware that accepts EITHER:
 *   - OAuth admin session (ctx.user.role === "admin"), OR
 *   - Dashboard session (dashboard_session cookie)
 *
 * Resolves ctx._userId to the authenticated user/admin ID.
 */
const glossaryProcedure = publicProcedure.use(async ({ ctx, next }) => {
  // Check OAuth admin session first
  if (ctx.user?.role === "admin") {
    return next({ ctx: { ...ctx, _userId: ctx.user.id } });
  }

  // Check dashboard session
  const cookieHeader = ctx.req.headers.cookie as string | undefined;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DASHBOARD_COOKIE}=([^;]+)`));
    if (match?.[1]) {
      const session = await verifyDashboardToken(match[1]);
      if (session) {
        return next({ ctx: { ...ctx, _userId: session.adminId } });
      }
    }
  }

  throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
});

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export const glossaryRouter = router({
  // ── List all glossary entries ──────────────────────────────────────────────
  list: glossaryProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const entries = await listGlossaryEntries();
      if (input?.search) {
        const q = input.search.toLowerCase();
        return entries.filter(
          (e) =>
            e.sourceTerm.toLowerCase().includes(q) ||
            e.englishTerm.toLowerCase().includes(q) ||
            (e.spanishTerm ?? "").toLowerCase().includes(q)
        );
      }
      return entries;
    }),

  // ── List upload batches ────────────────────────────────────────────────────
  listBatches: glossaryProcedure.query(async () => {
    return listGlossaryBatches();
  }),

  // ── Add single entry ───────────────────────────────────────────────────────
  addEntry: glossaryProcedure
    .input(
      z.object({
        sourceTerm: z.string().min(1).max(512),
        englishTerm: z.string().min(1).max(512),
        spanishTerm: z.string().max(512).optional(),
        thaiTerm: z.string().max(512).optional(),
        hindiTerm: z.string().max(512).optional(),
        vietnameseTerm: z.string().max(512).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createGlossaryEntry({
        sourceTerm: input.sourceTerm,
        englishTerm: input.englishTerm,
        spanishTerm: input.spanishTerm ?? null,
        thaiTerm: input.thaiTerm ?? null,
        hindiTerm: input.hindiTerm ?? null,
        vietnameseTerm: input.vietnameseTerm ?? null,
        description: input.description ?? null,
        createdBy: ctx._userId,
      });
      return { id };
    }),

  // ── Delete entry ───────────────────────────────────────────────────────────
  deleteEntry: glossaryProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteGlossaryEntry(input.id);
      return { success: true };
    }),

  // ── Upload CSV ─────────────────────────────────────────────────────────────
  // CSV format (with optional header row):
  // 中文術語, 英文, 西班牙語, 泰文, 印地語, 越南文
  uploadCsv: glossaryProcedure
    .input(
      z.object({
        filename: z.string(),
        base64Content: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Content, "base64");
      const csvText = buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));

      const entries: Array<{
        sourceTerm: string;
        englishTerm: string;
        spanishTerm: string | null;
        thaiTerm: string | null;
        hindiTerm: string | null;
        vietnameseTerm: string | null;
        createdBy: number;
      }> = [];

      for (const line of lines) {
        const cols = line.split(",").map((c) => c.trim());
        if (cols.length < 2) continue;
        const [sourceTerm, englishTerm, spanishTerm, thaiTerm, hindiTerm, vietnameseTerm] = cols;
        // Skip header row
        if (!sourceTerm || sourceTerm === "中文術語" || sourceTerm.toLowerCase() === "sourceterm") continue;
        if (!englishTerm) continue;
        entries.push({
          sourceTerm,
          englishTerm,
          spanishTerm: spanishTerm || null,
          thaiTerm: thaiTerm || null,
          hindiTerm: hindiTerm || null,
          vietnameseTerm: vietnameseTerm || null,
          createdBy: ctx._userId,
        });
      }

      if (entries.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV 中未找到有效術語，請確認格式：中文術語, 英文, 西班牙語, 泰文, 印地語, 越南文",
        });
      }

      const fileKey = `glossary/${ctx._userId}-${randomSuffix()}-${input.filename}`;
      const { key: s3Key } = await storagePut(fileKey, buffer, "text/csv");

      await bulkCreateGlossaryEntries(entries);
      await createGlossaryBatch({
        filename: input.filename,
        s3Key,
        entriesCount: entries.length,
        uploadedBy: ctx._userId,
      });

      return { count: entries.length };
    }),
});
