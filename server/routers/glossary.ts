/**
 * Glossary Router
 * Multi-language glossary management: English as base, with ES/TH/HI/VI translations.
 *
 * Auth: accepts both platform admin sessions and dashboard admin sessions.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  canManageGlossary,
  getPrincipalActorId,
  resolvePrincipal,
} from "../_core/authz";
import { publicProcedure, router } from "../_core/trpc";
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
 * Auth middleware that accepts either platform admins or dashboard admins.
 * Resolves ctx._userId to the authenticated actor ID.
 */
const glossaryProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const principal = resolvePrincipal(ctx);
  if (!canManageGlossary(principal)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
  }

  const actorId = getPrincipalActorId(principal);
  if (!actorId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
  }

  return next({ ctx: { ...ctx, principal, _userId: actorId } });
});

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Header-row detection for the glossary CSV importer. The UI template ships with
 * Chinese headers ("中文術語, 英文, 西班牙語, 泰文, 印地語, 越南文"); the old check only
 * recognized the English "sourceterm" and imported the Chinese header as a real entry.
 */
const GLOSSARY_HEADER_TOKENS = new Set([
  // English
  "sourceterm", "source", "englishterm", "english",
  "spanishterm", "thaiterm", "hinditerm", "vietnameseterm",
  // Chinese (UI template + common variants)
  "中文術語", "中文术语", "原文", "英文", "西班牙語", "西班牙语", "西文",
  "泰文", "泰语", "印地語", "印地语", "越南文", "越南语",
]);

function isGlossaryHeaderCell(value: string | undefined): boolean {
  if (!value) return false;
  return GLOSSARY_HEADER_TOKENS.has(value.trim().toLowerCase());
}

export const glossaryRouter = router({
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

  listBatches: glossaryProcedure.query(async () => {
    return listGlossaryBatches();
  }),

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

  deleteEntry: glossaryProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteGlossaryEntry(input.id);
      return { success: true };
    }),

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
        if (!sourceTerm) continue;
        // Skip header rows in either English or Chinese.
        if (isGlossaryHeaderCell(sourceTerm) || isGlossaryHeaderCell(englishTerm)) continue;
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
          message: "CSV 中未找到有效詞條",
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
