import { eq } from "drizzle-orm";
import {
  adminAccounts,
  type AdminAccount,
  type InsertAdminAccount,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function getAdminByUsername(username: string): Promise<AdminAccount | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(adminAccounts).where(eq(adminAccounts.username, username)).limit(1);
    return result[0];
  });
}

export async function getAdminById(id: number): Promise<AdminAccount | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1);
    return result[0];
  });
}

export async function createAdminAccount(data: InsertAdminAccount): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(adminAccounts).values(data);
  return getInsertId(result);
}

export async function listAdminAccounts() {
  return withDb(async () => {
    const db = await getDb();
    return db!.select({
      id: adminAccounts.id,
      username: adminAccounts.username,
      displayName: adminAccounts.displayName,
      createdAt: adminAccounts.createdAt,
    }).from(adminAccounts).orderBy(adminAccounts.username);
  });
}
