import { desc, eq } from "drizzle-orm";
import {
  glossaryBatches,
  glossaryEntries,
  type GlossaryEntry,
  type InsertGlossaryEntry,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function createGlossaryEntry(data: InsertGlossaryEntry): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(glossaryEntries).values(data);
  return getInsertId(result);
}

export async function bulkCreateGlossaryEntries(entries: InsertGlossaryEntry[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  if (!entries.length) return;
  await db.insert(glossaryEntries).values(entries);
}

export async function listGlossaryEntries(): Promise<GlossaryEntry[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(glossaryEntries).orderBy(glossaryEntries.sourceTerm);
  });
}

export async function deleteGlossaryEntry(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.delete(glossaryEntries).where(eq(glossaryEntries.id, id));
}

export async function createGlossaryBatch(data: {
  filename: string;
  s3Key: string;
  entriesCount: number;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.insert(glossaryBatches).values(data);
}

export async function listGlossaryBatches() {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(glossaryBatches).orderBy(desc(glossaryBatches.createdAt));
  });
}

/**
 * Get glossary terms for a specific target language.
 * Returns array of { sourceTerm, targetTerm } for use in translation engine.
 */
export async function getGlossaryForLanguage(
  targetLanguage: string
): Promise<Array<{ sourceTerm: string; englishTerm: string; targetTerm: string }>> {
  return withDb(async () => {
    const db = await getDb();
    const entries = await db!.select().from(glossaryEntries);
    return entries
      .map((e: any) => {
        let targetTerm = e.englishTerm; // fallback to English
        if (targetLanguage === "es" && e.spanishTerm) targetTerm = e.spanishTerm;
        else if (targetLanguage === "th" && e.thaiTerm) targetTerm = e.thaiTerm;
        else if (targetLanguage === "hi" && e.hindiTerm) targetTerm = e.hindiTerm;
        else if (targetLanguage === "vi" && e.vietnameseTerm) targetTerm = e.vietnameseTerm;
        return { sourceTerm: e.sourceTerm, englishTerm: e.englishTerm, targetTerm };
      })
      .filter((e: any) => e.targetTerm);
  });
}
