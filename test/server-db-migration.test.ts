/**
 * Server database migration from data/card-games.db to data/games.db:
 * old-only, new-only, both, interrupted retry, explicit connection, and WAL
 * contents carried over — with a verified copy and a kept backup.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import {
  DbMigrationConflict,
  migrateServerDatabase,
  readMigrationMarker,
} from "../server/utils/dbMigration";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "games-db-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string) => join(dir, name);

/** A legacy database with leaderboard rows and a room snapshot. */
async function seed(name: string, results = 3, { wal = false } = {}) {
  const c = createClient({ url: `file:${file(name)}` });
  if (wal) await c.execute("PRAGMA journal_mode = WAL");
  await c.batch(
    [
      `CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT, match_id TEXT, player_id TEXT, player_name TEXT, won INTEGER, score REAL, rank_metric REAL, played_at TEXT, UNIQUE(match_id, player_id))`,
      `CREATE TABLE room_snapshots (room_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      ...Array.from(
        { length: results },
        (_, i) =>
          `INSERT INTO results (game_id, match_id, player_id, player_name, won, score, rank_metric, played_at) VALUES ('last-card', 'm${i}', 'p${i}', 'P', 1, 1, -1, '2026-01-01')`,
      ),
      `INSERT INTO room_snapshots VALUES ('r1', '{}', '2026-01-01')`,
    ],
    "write",
  );
  return c; // left open so WAL contents stay uncheckpointed when requested
}

async function count(name: string, table: string) {
  const c = createClient({ url: `file:${file(name)}` });
  try {
    return Number((await c.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]!.n);
  } finally {
    c.close();
  }
}

describe("server database migration", () => {
  it("moves a legacy-only database into games.db with a verified copy and a backup", async () => {
    (await seed("card-games.db", 3)).close();
    const r = await migrateServerDatabase({
      dir,
      now: () => new Date("2026-10-27T00:00:00Z"),
    });
    expect(r).toMatchObject({
      status: "migrated",
      counts: { results: 3, room_snapshots: 1 },
    });
    expect(await count("games.db", "results")).toBe(3);
    expect(await count("games.db", "room_snapshots")).toBe(1);
    // The legacy database and its backup are kept.
    expect(await count("card-games.db", "results")).toBe(3);
    const backup = readdirSync(dir).find((f) => f.startsWith("card-games.db.backup-"))!;
    expect(await count(backup, "results")).toBe(3);
    expect(readMigrationMarker(dir)).toMatchObject({
      counts: { results: 3, room_snapshots: 1 },
    });
    expect(existsSync(file("games.db.tmp"))).toBe(false);
  });

  it("is a no-op once completed", async () => {
    (await seed("card-games.db", 2)).close();
    await migrateServerDatabase({ dir });
    expect(await migrateServerDatabase({ dir })).toEqual({ status: "completed-earlier" });
    expect(await count("games.db", "results")).toBe(2);
  });

  it("leaves a new-only or empty data directory alone", async () => {
    expect(await migrateServerDatabase({ dir })).toEqual({ status: "fresh" });
    expect(readdirSync(dir)).toEqual([]);
    (await seed("games.db", 1)).close();
    expect(await migrateServerDatabase({ dir })).toEqual({ status: "current" });
  });

  it("refuses to choose when both databases exist without a completed migration", async () => {
    (await seed("card-games.db", 2)).close();
    (await seed("games.db", 5)).close();
    await expect(migrateServerDatabase({ dir })).rejects.toBeInstanceOf(
      DbMigrationConflict,
    );
    expect(await count("card-games.db", "results")).toBe(2);
    expect(await count("games.db", "results")).toBe(5);
  });

  it("retries an interrupted migration from the legacy database", async () => {
    (await seed("card-games.db", 4)).close();
    // A crash left a partial copy and a marker, but nothing was moved into place.
    writeFileSync(file("games.db.tmp"), "partial");
    writeFileSync(file("games.db.migrated.json"), "{}");
    const r = await migrateServerDatabase({ dir });
    expect(r.status).toBe("migrated");
    expect(await count("games.db", "results")).toBe(4);
  });

  it("carries over rows still in the write-ahead log", async () => {
    const open = await seed("card-games.db", 6, { wal: true });
    expect(existsSync(file("card-games.db-wal"))).toBe(true);
    const r = await migrateServerDatabase({ dir });
    open.close();
    expect(r).toMatchObject({ status: "migrated", counts: { results: 6 } });
    expect(await count("games.db", "results")).toBe(6);
  });

  it("never touches an explicitly configured connection", async () => {
    (await seed("card-games.db", 1)).close();
    const r = await migrateServerDatabase({
      dir,
      explicitUrl: "libsql://games.example.turso.io",
    });
    expect(r).toEqual({ status: "explicit" });
    expect(existsSync(file("games.db"))).toBe(false);
  });
});
