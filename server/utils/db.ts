/**
 * Server-side persistence via LibSQL (SQLite-compatible). Embedded file by
 * default (a persistent volume on the VPS), or a remote Turso URL via env —
 * so it moves off the single VPS later with no code change.
 *
 * Persists two things:
 *  - global leaderboard results — ONLY server-authoritative online matches are
 *    written here (offline results are client-side and forgeable, so they never
 *    reach this table).
 *  - live room snapshots — so in-progress games survive a server restart/redeploy.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

function makeClient(): Client {
  // NUXT_LIBSQL_URL can be a remote Turso URL (libsql://…) with an auth token,
  // else fall back to a local file. The dir must be a persistent mount in prod.
  const url = process.env.NUXT_LIBSQL_URL || "file:./data/games.db";
  const authToken = process.env.NUXT_LIBSQL_AUTH_TOKEN || undefined;
  // LibSQL won't create the parent dir for a local file — ensure it exists.
  if (url.startsWith("file:")) {
    const path = url.slice("file:".length);
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      /* exists / not creatable */
    }
  }
  return createClient({ url, authToken });
}

async function ensureSchema(c: Client): Promise<void> {
  await c.batch(
    [
      `CREATE TABLE IF NOT EXISTS results (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id     TEXT NOT NULL,
        match_id    TEXT NOT NULL,
        player_id   TEXT NOT NULL,
        player_name TEXT NOT NULL,
        won         INTEGER NOT NULL,
        score       REAL NOT NULL,
        rank_metric REAL NOT NULL,
        played_at   TEXT NOT NULL,
        UNIQUE(match_id, player_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_results_game ON results(game_id)`,
      `CREATE INDEX IF NOT EXISTS idx_results_player ON results(player_id)`,
      `CREATE TABLE IF NOT EXISTS room_snapshots (
        room_id    TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
    "write",
  );
}

/** Lazily create + migrate the client. Safe to call repeatedly. */
export async function getDb(): Promise<Client> {
  if (client) {
    if (initPromise) await initPromise;
    return client;
  }
  client = makeClient();
  initPromise = ensureSchema(client).catch((e) => {
    // If schema init fails, surface it once and null the client so a later call
    // can retry rather than serving a half-initialized db.
    console.error("[db] schema init failed:", e);
    client = null;
    initPromise = null;
    throw e;
  });
  await initPromise;
  return client;
}

export interface OnlineResult {
  gameId: string;
  matchId: string;
  playerId: string;
  playerName: string;
  won: boolean;
  score: number;
  rankMetric: number;
  playedAt: string;
}

/** Record online match results (one row per human seat). Idempotent per match. */
export async function recordOnlineResults(rows: OnlineResult[]): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  await db.batch(
    rows.map((r) => ({
      sql: `INSERT OR IGNORE INTO results
        (game_id, match_id, player_id, player_name, won, score, rank_metric, played_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.gameId,
        r.matchId,
        r.playerId,
        r.playerName,
        r.won ? 1 : 0,
        r.score,
        r.rankMetric,
        r.playedAt,
      ],
    })),
    "write",
  );
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  played: number;
  wins: number;
  bestMetric: number;
}

/** Global leaderboard for a game — aggregated across all persisted online play. */
export async function globalLeaderboard(
  gameId: string,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT player_id,
                 MAX(player_name) AS player_name,
                 COUNT(*)        AS played,
                 SUM(won)        AS wins,
                 MAX(rank_metric) AS best
          FROM results
          WHERE game_id = ?
          GROUP BY player_id
          ORDER BY wins DESC, best DESC
          LIMIT ?`,
    args: [gameId, limit],
  });
  return rs.rows.map((row) => ({
    playerId: String(row.player_id),
    playerName: String(row.player_name),
    played: Number(row.played),
    wins: Number(row.wins),
    bestMetric: Number(row.best),
  }));
}

/**
 * Delete persisted leaderboard results — all games, or just one. Returns the
 * number of rows removed. Used by the admin reset endpoint to clear test data.
 */
export async function clearResults(gameId?: string): Promise<number> {
  const db = await getDb();
  const rs = gameId
    ? await db.execute({ sql: `DELETE FROM results WHERE game_id = ?`, args: [gameId] })
    : await db.execute(`DELETE FROM results`);
  return rs.rowsAffected;
}

// --- room snapshots (survive restarts) -------------------------------------

export async function saveRoomSnapshot(roomId: string, data: unknown): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO room_snapshots (room_id, data, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(room_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [roomId, JSON.stringify(data), new Date().toISOString()],
  });
}

export async function deleteRoomSnapshot(roomId: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `DELETE FROM room_snapshots WHERE room_id = ?`,
    args: [roomId],
  });
}

export async function loadRoomSnapshots(): Promise<{ roomId: string; data: unknown }[]> {
  const db = await getDb();
  const rs = await db.execute(`SELECT room_id, data FROM room_snapshots`);
  return rs.rows.map((row) => ({
    roomId: String(row.room_id),
    data: JSON.parse(String(row.data)),
  }));
}
