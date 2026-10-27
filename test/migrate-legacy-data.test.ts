/**
 * Browser data migration from the legacy `card-games` identifiers: storage
 * keys and the locale cookie copy without overwriting, and the IndexedDB copy
 * is atomic, verified, idempotent, and refuses to merge into different data.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Dexie from "dexie";
import { GamesDB } from "../app/db";
import {
  LEGACY_DB_NAME,
  MIGRATION_FLAG,
  markMigrationComplete,
  migrateDatabase,
  migrateLocaleCookie,
  migrateStorageKeys,
  migrationComplete,
} from "../app/utils/migrateLegacyData";

/** A Map-backed Storage. */
class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

/** Build a legacy database at schema v2 holding some data. */
async function seedLegacy(name: string) {
  const legacy = new Dexie(name);
  legacy.version(1).stores({
    results: "++id, gameId, playerId, matchId, playedAt, rankMetric",
    themeAssets: "++id, kind, createdAt",
    savedGames: "++id, gameId, savedAt",
  });
  legacy.version(2).stores({
    results: "++id, gameId, playerId, matchId, playedAt, rankMetric, [gameId+visibility]",
  });
  await legacy.open();
  await legacy.table("results").bulkAdd([
    {
      gameId: "last-card",
      playerId: "p1",
      playerName: "Ana",
      won: true,
      score: 3,
      rankMetric: -3,
      playedAt: "2026-01-01",
      matchId: "m1",
      visibility: "offline",
    },
    {
      gameId: "albastini",
      playerId: "p1",
      playerName: "Ana",
      won: false,
      score: 1,
      rankMetric: 1,
      playedAt: "2026-01-02",
      matchId: "m2",
    },
  ]);
  await legacy.table("themeAssets").add({
    kind: "background",
    name: "beach.png",
    blob: new Blob([new Uint8Array(512)], { type: "image/png" }),
    createdAt: "2026-01-03",
  });
  await legacy.table("savedGames").add({
    gameId: "last-card",
    name: "Slot 1",
    snapshot: { v: 1 },
    savedAt: "2026-01-04",
  });
  legacy.close();
}

let n = 0;
let legacyName: string;
let target: GamesDB;
beforeEach(async () => {
  n++;
  legacyName = `legacy-${n}`;
  // Each test gets a fresh destination database.
  target = new GamesDB();
  await target.delete();
  target = new GamesDB();
  await target.open();
});

const counts = async (db: Dexie) => ({
  results: await db.table("results").count(),
  themeAssets: await db.table("themeAssets").count(),
  savedGames: await db.table("savedGames").count(),
});

describe("storage keys and cookie", () => {
  it("copies legacy keys to games:* without overwriting newer values, keeping the legacy copy", () => {
    const s = new MemStorage();
    s.setItem("cg:player-id", '"abc"');
    s.setItem("cg:player-name", '"Ana"');
    s.setItem("games:player-name", '"Ana B"'); // newer value
    s.setItem("unrelated", "1");
    const r = migrateStorageKeys(s);
    expect(r.copied).toEqual(["games:player-id"]);
    expect(r.kept).toEqual(["games:player-name"]);
    expect(s.getItem("games:player-id")).toBe('"abc"');
    expect(s.getItem("games:player-name")).toBe('"Ana B"');
    expect(s.getItem("cg:player-id")).toBe('"abc"'); // recovery copy
    // Idempotent.
    expect(migrateStorageKeys(s).copied).toEqual([]);
  });

  it("carries the locale cookie over once", () => {
    let jar = "cg-locale=sw; other=1";
    const doc = {
      get cookie() {
        return jar;
      },
      set cookie(v: string) {
        jar += `; ${v.split(";")[0]}`;
      },
    };
    expect(migrateLocaleCookie(doc)).toBe("sw");
    expect(jar).toContain("games-locale=sw");
    expect(migrateLocaleCookie(doc)).toBeNull();
  });

  it("marks completion explicitly", () => {
    const s = new MemStorage();
    expect(migrationComplete(s)).toBe(false);
    markMigrationComplete(s);
    expect(s.getItem(MIGRATION_FLAG)).toBe("complete");
    expect(migrationComplete(s)).toBe(true);
  });
});

describe("database copy", () => {
  it("does nothing, and creates nothing, when there is no legacy database", async () => {
    expect(await migrateDatabase(target, { legacyName })).toEqual({ status: "none" });
    expect(await Dexie.exists(legacyName)).toBe(false);
  });

  it("copies results, uploads and saved games, verified, keeping the legacy database", async () => {
    await seedLegacy(legacyName);
    const r = await migrateDatabase(target, { legacyName });
    expect(r).toEqual({
      status: "done",
      counts: { results: 2, themeAssets: 1, savedGames: 1 },
    });
    expect(await counts(target)).toEqual({ results: 2, themeAssets: 1, savedGames: 1 });
    const asset = await target.themeAssets.toArray();
    expect(asset[0]!.blob.size).toBe(512);
    expect((await target.results.toArray()).map((x) => x.matchId)).toEqual(["m1", "m2"]);
    expect(await Dexie.exists(legacyName)).toBe(true);
  });

  it("is idempotent: a rerun or an interrupted retry never duplicates records", async () => {
    await seedLegacy(legacyName);
    await migrateDatabase(target, { legacyName });
    // The completion flag was never written (interrupted before it): retry.
    const again = await migrateDatabase(target, { legacyName });
    expect(again.status).toBe("already");
    expect(await counts(target)).toEqual({ results: 2, themeAssets: 1, savedGames: 1 });
  });

  it("reports a conflicting destination instead of merging", async () => {
    await seedLegacy(legacyName);
    await target.results.add({
      gameId: "bao",
      playerId: "p9",
      playerName: "Other",
      won: true,
      score: 1,
      rankMetric: 1,
      playedAt: "2026-02-01",
      matchId: "new",
    });
    const r = await migrateDatabase(target, { legacyName });
    expect(r.status).toBe("conflict");
    expect(await counts(target)).toEqual({ results: 1, themeAssets: 0, savedGames: 0 });
  });

  it("writes nothing when storage runs out, and reports it", async () => {
    await seedLegacy(legacyName);
    const spy = vi.spyOn(target.table("savedGames"), "bulkAdd").mockImplementation(() => {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      return Promise.reject(e) as never;
    });
    const r = await migrateDatabase(target, { legacyName });
    expect(r).toMatchObject({ status: "failed", reason: "quota" });
    // The transaction aborted: nothing half-copied.
    expect(await counts(target)).toEqual({ results: 0, themeAssets: 0, savedGames: 0 });
    spy.mockRestore();
    // A later retry succeeds.
    expect((await migrateDatabase(target, { legacyName })).status).toBe("done");
  });

  it("uses the legacy database name by default", () => {
    expect(LEGACY_DB_NAME).toBe("card-games");
  });
});
