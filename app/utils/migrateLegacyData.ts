/**
 * One-time migration of a returning player's browser data from the legacy
 * `card-games` identifiers to `games`.
 *
 *  - Storage keys `cg:*` are copied to `games:*` only where the new key is
 *    absent, so newer values are never overwritten. Legacy keys stay as a
 *    recovery copy.
 *  - The locale cookie `cg-locale` is copied to `games-locale` the same way.
 *  - The legacy IndexedDB database (results, uploads, saved games) is copied
 *    into the new one in a single atomic transaction, then verified record by
 *    record before the migration is marked complete. The legacy database is
 *    kept, and is never created just to check whether it exists.
 *
 * Re-running is safe: a completed migration is a no-op, an interrupted one
 * either wrote nothing (the transaction aborted) or wrote everything (only the
 * completion mark is missing, which verification detects), so records are
 * never duplicated. A destination that already holds different data is
 * reported as a conflict instead of being merged.
 */
import Dexie from "dexie";

export const LEGACY_KEY_PREFIX = "cg:";
export const KEY_PREFIX = "games:";
export const LEGACY_LOCALE_COOKIE = "cg-locale";
export const LOCALE_COOKIE = "games-locale";
export const LEGACY_DB_NAME = "card-games";
/** Local-storage flag written only after the database copy is verified. */
export const MIGRATION_FLAG = "games:migration";
export const MIGRATION_DONE = "complete";

/** Tables copied from the legacy database. */
export const MIGRATED_TABLES = ["results", "themeAssets", "savedGames"] as const;
export type MigratedTable = (typeof MIGRATED_TABLES)[number];

/** The subset of `Storage` the key copy needs. */
export interface EnumerableStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Copy `cg:*` keys to `games:*` where the destination is still empty. */
export function migrateStorageKeys(storage: EnumerableStorage): {
  copied: string[];
  kept: string[];
} {
  const copied: string[] = [];
  const kept: string[] = [];
  const legacy: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LEGACY_KEY_PREFIX)) legacy.push(key);
  }
  for (const key of legacy) {
    const target = KEY_PREFIX + key.slice(LEGACY_KEY_PREFIX.length);
    if (storage.getItem(target) !== null) {
      kept.push(target);
      continue;
    }
    const value = storage.getItem(key);
    if (value !== null) {
      storage.setItem(target, value);
      copied.push(target);
    }
  }
  return { copied, kept };
}

/** Copy the legacy locale cookie when the new one is absent; returns the value carried over. */
export function migrateLocaleCookie(doc: { cookie: string }): string | null {
  const read = (name: string) =>
    doc.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null;
  if (read(LOCALE_COOKIE) !== null) return null;
  const legacy = read(LEGACY_LOCALE_COOKIE);
  if (legacy === null) return null;
  doc.cookie = `${LOCALE_COOKIE}=${legacy}; path=/; max-age=31536000; samesite=lax`;
  return decodeURIComponent(legacy);
}

// ---- database ------------------------------------------------------------------

export type Rows = Record<MigratedTable, Record<string, unknown>[]>;

export type DatabaseMigration =
  | { status: "none" } // no legacy database
  | { status: "done"; counts: Record<MigratedTable, number> }
  | { status: "already"; counts: Record<MigratedTable, number> }
  | { status: "conflict"; counts: Record<MigratedTable, number> }
  | { status: "failed"; reason: "quota" | "verify" | "error"; message: string };

/** A target database exposing the migrated tables (the app's GamesDB). */
export interface MigrationTarget {
  tables: Dexie["tables"];
  table(name: string): Dexie.Table;
  transaction: Dexie["transaction"];
}

const idOf = (row: Record<string, unknown>) => row.id as number;
const sameRows = (a: Record<string, unknown>[], b: Record<string, unknown>[]) => {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((r) => [idOf(r), r]));
  return a.every((r) => {
    const other = byId.get(idOf(r));
    if (!other) return false;
    // Compare everything but binary payloads, which are compared by size.
    return Object.keys(r).every((k) =>
      r[k] instanceof Blob
        ? other[k] instanceof Blob && (other[k] as Blob).size === (r[k] as Blob).size
        : JSON.stringify(r[k]) === JSON.stringify(other[k]),
    );
  });
};

async function readAll(db: Pick<MigrationTarget, "tables" | "table">): Promise<Rows> {
  const names = new Set(db.tables.map((t) => t.name));
  const out = {} as Rows;
  for (const name of MIGRATED_TABLES) {
    out[name] = names.has(name)
      ? ((await db.table(name).toArray()) as Record<string, unknown>[])
      : [];
  }
  return out;
}

const countsOf = (rows: Rows) =>
  Object.fromEntries(MIGRATED_TABLES.map((t) => [t, rows[t].length])) as Record<
    MigratedTable,
    number
  >;

function isQuota(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } } | null;
  return err?.name === "QuotaExceededError" || err?.inner?.name === "QuotaExceededError";
}

/**
 * Copy the legacy database into `target`. `legacyName` and `dexie` are
 * injectable for tests. Completion is reported only after verification.
 */
export async function migrateDatabase(
  target: MigrationTarget,
  {
    legacyName = LEGACY_DB_NAME,
    dexie = Dexie,
  }: { legacyName?: string; dexie?: typeof Dexie } = {},
): Promise<DatabaseMigration> {
  try {
    // Checks for the database without creating it.
    if (!(await dexie.exists(legacyName))) return { status: "none" };
    const legacy = new dexie(legacyName);
    await legacy.open(); // opens the existing schema as-is
    let source: Rows;
    try {
      source = await readAll(legacy);
    } finally {
      legacy.close();
    }
    const counts = countsOf(source);

    const existing = await readAll(target);
    const destEmpty = MIGRATED_TABLES.every((t) => existing[t].length === 0);
    if (!destEmpty) {
      // A previous run that wrote everything but stopped before marking done.
      const identical = MIGRATED_TABLES.every((t) => sameRows(source[t], existing[t]));
      return identical ? { status: "already", counts } : { status: "conflict", counts };
    }

    const tables = MIGRATED_TABLES.map((t) => target.table(t));
    await target.transaction("rw", tables, async () => {
      for (const t of MIGRATED_TABLES) {
        if (source[t].length) await target.table(t).bulkAdd(source[t]);
      }
    });

    const written = await readAll(target);
    if (!MIGRATED_TABLES.every((t) => sameRows(source[t], written[t]))) {
      return { status: "failed", reason: "verify", message: "copied data did not match" };
    }
    return { status: "done", counts };
  } catch (e) {
    return {
      status: "failed",
      reason: isQuota(e) ? "quota" : "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Whether this browser already finished the migration. */
export const migrationComplete = (storage: Pick<Storage, "getItem">) =>
  storage.getItem(MIGRATION_FLAG) === JSON.stringify(MIGRATION_DONE) ||
  storage.getItem(MIGRATION_FLAG) === MIGRATION_DONE;

/** Mark the migration finished (after a verified copy, or nothing to copy). */
export function markMigrationComplete(storage: Pick<Storage, "setItem">) {
  storage.setItem(MIGRATION_FLAG, MIGRATION_DONE);
}
