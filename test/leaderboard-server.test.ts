/**
 * Global leaderboard storage: additive schema upgrade of an existing
 * database, provenance recorded from the room (never the client), bounded
 * history with legacy rows shown as unknown, idempotent inserts and
 * per-game experience-tier snapshots.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import type { BaseGameState, BaseMove } from "@games/engine-core";

const dir = mkdtempSync(join(tmpdir(), "games-lb-"));
const url = `file:${join(dir, "existing.db")}`;

// An existing database from before provenance was stored.
beforeAll(async () => {
  const c = createClient({ url });
  await c.batch(
    [
      `CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, match_id TEXT NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL, won INTEGER NOT NULL, score REAL NOT NULL, rank_metric REAL NOT NULL, played_at TEXT NOT NULL, UNIQUE(match_id, player_id))`,
      `INSERT INTO results (game_id, match_id, player_id, player_name, won, score, rank_metric, played_at) VALUES ('checkers', 'old-1', 'veteran', 'Old Timer', 1, 0, 1, '2026-01-01T00:00:00.000Z')`,
    ],
    "write",
  );
  c.close();
  process.env.NUXT_LIBSQL_URL = url;
});
afterAll(() => {
  delete process.env.NUXT_LIBSQL_URL;
  rmSync(dir, { recursive: true, force: true });
});

const db = () => import("../server/utils/db");

describe("global leaderboard storage", () => {
  it("adds the provenance columns to an existing database, keeping old rows", async () => {
    const { getDb } = await db();
    const c = await getDb();
    const cols = (await c.execute("PRAGMA table_info(results)")).rows.map((r) =>
      String(r.name),
    );
    expect(cols).toEqual(
      expect.arrayContaining(["variant", "difficulty", "drawn", "experience_tier"]),
    );
    expect(
      Number((await c.execute("SELECT COUNT(*) AS n FROM results")).rows[0]!.n),
    ).toBe(1);
  });

  it("returns standings plus history, legacy rows with unknown provenance", async () => {
    const { recordOnlineResults, globalLeaderboard } = await db();
    await recordOnlineResults([
      {
        gameId: "checkers",
        matchId: "new-1",
        playerId: "ana",
        playerName: "Ana",
        won: false,
        drawn: true,
        score: 2,
        rankMetric: 0.5,
        playedAt: "2026-10-01T00:00:00.000Z",
        variant: "international",
        difficulty: "none",
      },
    ]);
    const board = await globalLeaderboard("checkers");
    expect(board.metric).toBe("match-wins");
    expect(board.rows.map((r) => [r.playerId, r.wins, r.draws, r.losses])).toEqual([
      ["veteran", 1, 0, 0],
      ["ana", 0, 1, 0],
    ]);
    expect(board.history).toEqual([
      expect.objectContaining({
        playerId: "ana",
        variant: "international",
        difficulty: "none",
        result: "draw",
        tier: "new",
      }),
      expect.objectContaining({
        playerId: "veteran",
        variant: null,
        difficulty: null,
        result: "win",
        tier: null,
      }),
    ]);
  });

  it("ignores duplicate inserts and snapshots tiers per game at the boundaries", async () => {
    const { recordOnlineResults, getDb } = await db();
    for (let i = 1; i <= 50; i++) {
      const r = {
        gameId: "bao",
        matchId: `b${i}`,
        playerId: "kai",
        playerName: "Kai",
        won: true,
        score: 40,
        rankMetric: 1,
        playedAt: `2026-10-02T00:${String(i).padStart(2, "0")}:00.000Z`,
        variant: "bao-la-kiswahili",
        difficulty: "easy" as const,
      };
      await recordOnlineResults([r]);
      if (i === 10) await recordOnlineResults([r]); // duplicate
    }
    await recordOnlineResults([
      {
        gameId: "checkers",
        matchId: "k1",
        playerId: "kai",
        playerName: "Kai",
        won: true,
        score: 3,
        rankMetric: 1,
        playedAt: "2026-10-03T00:00:00.000Z",
        variant: "drafti",
        difficulty: "hard",
      },
    ]);
    const rows = (
      await (
        await getDb()
      ).execute(
        `SELECT game_id, match_id, experience_tier FROM results WHERE player_id = 'kai'`,
      )
    ).rows;
    const tier = (m: string) =>
      String(rows.find((r) => r.match_id === m)!.experience_tier);
    expect(rows.filter((r) => r.game_id === "bao")).toHaveLength(50);
    expect([tier("b9"), tier("b10"), tier("b49"), tier("b50"), tier("b1")]).toEqual([
      "new",
      "regular",
      "regular",
      "veteran",
      "new",
    ]);
    expect(tier("k1")).toBe("new"); // Checkers counted separately
  });

  it("records provenance from the room's own settings", async () => {
    const { RoomHub } = await import("../server/utils/roomHub");
    const { buildRoomConfig } = await import("../server/utils/roomConfig");
    const { requireGame } = await import("@games/engine-core");
    const { getDb } = await db();

    async function playOut(botSeats: number, difficulty: "easy" | "hard") {
      const hub = new RoomHub({ botDelayMs: 0 });
      const roomId = hub.createRoom(
        buildRoomConfig(
          requireGame("bao"),
          {
            gameId: "bao",
            variant: "bao-la-kujifunza",
            difficulty,
            botSeats,
            playerCount: 2,
          },
          "",
        ),
      );
      const peers = ["A", "B"].slice(0, 2 - botSeats).map((id) => {
        const sent: { t: string; state?: BaseGameState; legalMoves?: BaseMove[] }[] = [];
        const peer = {
          id,
          send: (d: string) => sent.push(JSON.parse(d)),
          subscribe() {},
          unsubscribe() {},
          publish() {},
        };
        hub.onMessage(
          peer,
          JSON.stringify({
            t: "join",
            roomId,
            playerId: `pid-${id}-${botSeats}`,
            name: id,
          }),
        );
        return { peer, sent };
      });
      hub.onMessage(peers[0]!.peer, JSON.stringify({ t: "start", roomId }));
      for (let i = 0; i < 2000; i++) {
        const state = [...peers[0]!.sent].reverse().find((m) => m.t === "state");
        if (state?.state?.phase === "finished") break;
        const mover = peers.find((p) => {
          const s = [...p.sent].reverse().find((m) => m.t === "state");
          return s?.legalMoves?.length;
        });
        if (mover) {
          const s = [...mover.sent].reverse().find((m) => m.t === "state")!;
          hub.onMessage(
            mover.peer,
            JSON.stringify({ t: "move", roomId, move: s.legalMoves![0] }),
          );
        } else {
          await new Promise((r) => setTimeout(r, 1));
        }
      }
      await new Promise((r) => setTimeout(r, 50)); // persistence is fire-and-forget
      hub.dispose();
    }

    await playOut(1, "hard");
    await playOut(0, "easy");
    const rows = (
      await (
        await getDb()
      ).execute(
        `SELECT player_id, variant, difficulty FROM results WHERE game_id = 'bao' AND player_id LIKE 'pid-%'`,
      )
    ).rows;
    expect(
      rows
        .map((r) => [String(r.player_id), String(r.variant), String(r.difficulty)])
        .sort(),
    ).toEqual([
      ["pid-A-0", "bao-la-kujifunza", "none"],
      ["pid-A-1", "bao-la-kujifunza", "hard"],
      ["pid-B-0", "bao-la-kujifunza", "none"],
    ]);
  });
});
