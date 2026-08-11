import { desc, eq, sql } from "drizzle-orm";
import { users, type InsertUser } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserLanguage(userId: number, language: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));
}

export async function listUsers(page = 1, pageSize = 30) {
  return withDb(async () => {
    const db = await getDb();
    const offset = (page - 1) * pageSize;
    const items = await db!
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.lastSignedIn))
      .limit(pageSize)
      .offset(offset);
    const countResult = await db!.select({ count: sql<number>`count(*)` }).from(users);
    return { items, total: countResult[0]?.count ?? 0 };
  });
}

// ─── Local Auth (email + password) ─────────────────────────────────────────
export async function getUserByEmail(email: string) {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  });
}

export async function createLocalUser(data: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(users).values({
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name || null,
    loginMethod: "local",
    role: "user",
    preferredLanguage: "zh",
    openId: null,
  });
  return getInsertId(result);
}

export async function updatePassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
