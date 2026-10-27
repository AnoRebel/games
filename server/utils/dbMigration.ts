/**
 * Pre-start migration of the default server database from
 * `data/card-games.db` to `data/games.db`.
 *
 * Runs before anything opens the database (getDb waits for it), so no writer
 * is active. Steps: back up the legacy database with a consistent snapshot
 * (`VACUUM INTO` reads committed WAL contents too), copy it to a temporary
 * file, verify integrity and per-table row counts, record a completion
 * marker, and only then move the copy into place. The legacy database and the
 * backup are kept.
 *
 *  - Explicit `NUXT_LIBSQL_URL` connections (remote or file) are never touched.
 *  - A completed migration is a no-op on later starts.
 *  - If both databases exist without a completion marker, startup reports a
 *    conflict instead of replacing either one.
 *  - An interrupted run is retried from the legacy database on next start.
 */
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

export const LEGACY_DB_FILE = "card-games.db";
export const DB_FILE = "games.db";
/** Tables whose row counts must survive the copy. */
const VERIFIED_TABLES = ["results", "room_snapshots"];

export class DbMigrationConflict extends Error {
  constructor(legacy: string, current: string) {
    super(
      `Both ${legacy} and ${current} exist and no completed migration is recorded. ` +
        `Refusing to replace either database — keep the one you want and move the other aside.`,
    );
    this.name = "DbMigrationConflict";
  }
}

export type ServerDbMigration =
  | { status: "explicit" } // NUXT_LIBSQL_URL set — not ours to move
  | { status: "fresh" } // neither database exists yet
  | { status: "current" } // only the new database exists
  | { status: "completed-earlier" }
  | { status: "migrated"; backup: string; counts: Record<string, number> };

export interface MigrationOptions {
  /** Directory holding the default database files. */
  dir?: string;
  /** Explicit connection URL (NUXT_LIBSQL_URL); when set nothing is migrated. */
  explicitUrl?: string;
  now?: () => Date;
}

const sqlString = (path: string) => `'${path.replaceAll("'", "''")}'`;

async function tableCounts(file: string): Promise<Record<string, number>> {
  const c = createClient({ url: `file:${file}` });
  try {
    const rs = await c.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    const names = new Set(rs.rows.map((r) => String(r.name)));
    const counts: Record<string, number> = {};
    for (const t of VERIFIED_TABLES) {
      if (!names.has(t)) continue;
      const n = await c.execute(`SELECT COUNT(*) AS n FROM ${t}`);
      counts[t] = Number(n.rows[0]!.n);
    }
    return counts;
  } finally {
    c.close();
  }
}

export async function migrateServerDatabase(
  opts: MigrationOptions = {},
): Promise<ServerDbMigration> {
  if (opts.explicitUrl) return { status: "explicit" };
  const dir = opts.dir ?? "./data";
  const legacy = join(dir, LEGACY_DB_FILE);
  const current = join(dir, DB_FILE);
  const tmp = `${current}.tmp`;
  const marker = `${current}.migrated.json`;

  const hasLegacy = existsSync(legacy);
  const hasCurrent = existsSync(current);
  const hasMarker = existsSync(marker);

  if (hasCurrent && hasMarker) return { status: "completed-earlier" };
  if (hasCurrent && !hasLegacy) return { status: "current" };
  if (!hasCurrent && !hasLegacy) return { status: "fresh" };
  if (hasCurrent && hasLegacy) throw new DbMigrationConflict(legacy, current);

  // Legacy only (possibly after an interrupted attempt): copy it over.
  mkdirSync(dir, { recursive: true });
  rmSync(tmp, { force: true });
  rmSync(marker, { force: true });
  const stamp = (opts.now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const backup = join(dir, `${LEGACY_DB_FILE}.backup-${stamp}`);

  const expected = await tableCounts(legacy);
  const src = createClient({ url: `file:${legacy}` });
  try {
    await src.execute(`VACUUM INTO ${sqlString(backup)}`);
    await src.execute(`VACUUM INTO ${sqlString(tmp)}`);
  } finally {
    src.close();
  }

  const copy = createClient({ url: `file:${tmp}` });
  try {
    const check = await copy.execute("PRAGMA integrity_check");
    if (String(check.rows[0]?.[0]) !== "ok") {
      throw new Error(
        `Copied database failed its integrity check: ${String(check.rows[0]?.[0])}`,
      );
    }
  } finally {
    copy.close();
  }
  const counts = await tableCounts(tmp);
  for (const [table, n] of Object.entries(expected)) {
    if (counts[table] !== n) {
      throw new Error(`Copied ${table} has ${counts[table] ?? 0} rows, expected ${n}`);
    }
  }

  // Record completion, then move the verified copy into place (atomic rename).
  writeFileSync(
    marker,
    JSON.stringify(
      { from: legacy, backup, counts, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  renameSync(tmp, current);
  return { status: "migrated", backup, counts };
}

/** The recorded result of a completed migration, if any. */
export function readMigrationMarker(dir = "./data"): unknown {
  const marker = join(dir, `${DB_FILE}.migrated.json`);
  return existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
}

let pending: Promise<ServerDbMigration> | null = null;

/** Run the migration once per process; every database user awaits this. */
export function ensureServerDatabaseMigrated(): Promise<ServerDbMigration> {
  pending ??= migrateServerDatabase({
    explicitUrl: process.env.NUXT_LIBSQL_URL || undefined,
  });
  return pending;
}
