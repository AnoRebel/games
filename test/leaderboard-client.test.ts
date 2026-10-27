/**
 * Local results: the v2 → v3 schema upgrade keeps old rows readable (shown
 * with unknown provenance), and recording is idempotent per match and player
 * with an experience-tier snapshot per game.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { GamesDB, type GameResult } from "../app/db";
import { historyEntry, writeResults } from "../app/composables/useLeaderboard";
import { standings } from "../shared/leaderboard";

let db: GamesDB;
beforeEach(async () => {
  await Dexie.delete("games");
  db = new GamesDB();
  await db.open();
});

const entry = (
  over: Partial<GameResult> = {},
): Omit<GameResult, "id" | "experienceTier"> => ({
  gameId: "checkers",
  playerId: "p1",
  playerName: "Ana",
  won: true,
  drawn: false,
  score: 3,
  rankMetric: 1,
  playedAt: "2026-10-01T10:00:00.000Z",
  matchId: "m",
  visibility: "offline",
  variant: "drafti",
  difficulty: "hard",
  ...over,
});

describe("schema upgrade", () => {
  it("opens a v2 database at v3 with old rows intact and unknown provenance", async () => {
    db.close();
    await Dexie.delete("games");
    const v2 = new Dexie("games");
    v2.version(1).stores({
      results: "++id, gameId, playerId, matchId, playedAt, rankMetric",
      themeAssets: "++id, kind, createdAt",
      savedGames: "++id, gameId, savedAt",
    });
    v2.version(2).stores({
      results:
        "++id, gameId, playerId, matchId, playedAt, rankMetric, [gameId+visibility]",
    });
    await v2.open();
    await v2.table("results").add({
      gameId: "last-card",
      playerId: "old",
      playerName: "Old",
      won: true,
      score: 4,
      rankMetric: -4,
      playedAt: "2026-01-01",
      matchId: "legacy",
    });
    v2.close();

    db = new GamesDB();
    await db.open();
    expect(db.verno).toBe(3);
    const rows = await db.results.toArray();
    expect(rows).toHaveLength(1);
    expect(historyEntry(rows[0]!)).toMatchObject({
      variant: null,
      difficulty: null,
      tier: null,
      result: "win",
    });
    // Legacy rows still count in the standings.
    expect(standings("last-card", rows)).toEqual([
      expect.objectContaining({ playerId: "old", wins: 1 }),
    ]);
  });
});

describe("recording results", () => {
  it("stores variant, difficulty and draws, read back as history", async () => {
    await writeResults(db, [
      entry({ matchId: "a", won: false, drawn: true, rankMetric: 0.5 }),
    ]);
    const [row] = await db.results.toArray();
    expect(historyEntry(row!)).toMatchObject({
      gameId: "checkers",
      variant: "drafti",
      difficulty: "hard",
      result: "draw",
      tier: "new",
    });
  });

  it("records a human-only play's difficulty as none", async () => {
    await writeResults(db, [entry({ matchId: "h", difficulty: "none" })]);
    expect(historyEntry((await db.results.toArray())[0]!).difficulty).toBe("none");
  });

  it("ignores a duplicate insertion of the same match and player", async () => {
    await writeResults(db, [entry({ matchId: "dup" })]);
    await writeResults(db, [entry({ matchId: "dup", playerName: "Changed" })]);
    expect(await db.results.count()).toBe(1);
    expect((await db.results.toArray())[0]!.playerName).toBe("Ana");
  });

  it("snapshots tiers at the 9/10 and 49/50 boundaries, per game, and never rewrites them", async () => {
    for (let i = 1; i <= 50; i++) {
      await writeResults(db, [
        entry({
          matchId: `c${i}`,
          playedAt: `2026-10-01T10:${String(i).padStart(2, "0")}:00.000Z`,
        }),
      ]);
    }
    // A Bao play is counted separately.
    await writeResults(db, [
      entry({ gameId: "bao", matchId: "b1", variant: "bao-la-kiswahili" }),
    ]);
    const byMatch = new Map(
      (await db.results.toArray()).map((r) => [r.matchId, r.experienceTier]),
    );
    expect(byMatch.get("c9")).toBe("new");
    expect(byMatch.get("c10")).toBe("regular");
    expect(byMatch.get("c49")).toBe("regular");
    expect(byMatch.get("c50")).toBe("veteran");
    expect(byMatch.get("b1")).toBe("new");
    // Earlier snapshots stay as recorded.
    expect(byMatch.get("c1")).toBe("new");
  });
});
