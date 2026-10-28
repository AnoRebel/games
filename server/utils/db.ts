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
import { ensureServerDatabaseMigrated } from "./dbMigration";
import {
  recentHistory,
  orderStandings,
  tierFor,
  type ExperienceTier,
  type HistoryEntry,
  type PlayDifficulty,
  type RankingMetric,
  type Standing,
  rankingMetric,
} from "../../shared/leaderboard";

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
  // Additive provenance columns. Existing rows keep NULL variant/difficulty/
  // tier (shown as unknown) and count as not drawn.
  const info = await c.execute(`PRAGMA table_info(results)`);
  const have = new Set(info.rows.map((r) => String(r.name)));
  const added: [string, string][] = [
    ["variant", "TEXT"],
    ["difficulty", "TEXT"],
    ["drawn", "INTEGER NOT NULL DEFAULT 0"],
    ["experience_tier", "TEXT"],
  ];
  for (const [col, type] of added) {
    if (!have.has(col)) await c.execute(`ALTER TABLE results ADD COLUMN ${col} ${type}`);
  }
  await c.execute(
    `CREATE INDEX IF NOT EXISTS idx_results_game_player ON results(game_id, player_id)`,
  );
}

/** Lazily create + migrate the client. Safe to call repeatedly. */
export async function getDb(): Promise<Client> {
  if (client) {
    if (initPromise) await initPromise;
    return client;
  }
  // Move a legacy database into place before anything opens (and so creates)
  // the new one. A failure surfaces here instead of serving an empty database.
  await ensureServerDatabaseMigrated();
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
  /** The match ended in a draw. */
  drawn?: boolean;
  score: number;
  rankMetric: number;
  playedAt: string;
  /** From the room's config: rule variant (null if the game has none). */
  variant?: string | null;
  /** From the room's config: bot strength, or `none` with no bot seats. */
  difficulty?: PlayDifficulty;
}

/**
 * Record online match results (one row per human seat). Idempotent per match
 * and player: a repeat insert changes nothing. A new row snapshots the
 * player's per-game experience tier after counting this play, in the same
 * transaction.
 */
export async function recordOnlineResults(rows: OnlineResult[]): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  const tx = await db.transaction("write");
  try {
    for (const r of rows) {
      const inserted = await tx.execute({
        sql: `INSERT OR IGNORE INTO results
          (game_id, match_id, player_id, player_name, won, drawn, score, rank_metric,
           played_at, variant, difficulty)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.gameId,
          r.matchId,
          r.playerId,
          r.playerName,
          r.won ? 1 : 0,
          r.drawn ? 1 : 0,
          r.score,
          r.rankMetric,
          r.playedAt,
          r.variant ?? null,
          r.difficulty ?? null,
        ],
      });
      if (inserted.rowsAffected === 0) continue; // already recorded
      const n = await tx.execute({
        sql: `SELECT COUNT(*) AS n FROM results WHERE game_id = ? AND player_id = ?`,
        args: [r.gameId, r.playerId],
      });
      await tx.execute({
        sql: `UPDATE results SET experience_tier = ? WHERE match_id = ? AND player_id = ?`,
        args: [tierFor(Number(n.rows[0]!.n)), r.matchId, r.playerId],
      });
    }
    await tx.commit();
  } finally {
    tx.close();
  }
}

export interface LeaderboardEntry extends Standing {
  /** Kept for older clients: the best single-match metric. */
  bestMetric: number;
}

export interface GlobalLeaderboard {
  metric: RankingMetric;
  rows: LeaderboardEntry[];
  /** Most recent plays, newest first. */
  history: HistoryEntry[];
}

/**
 * Global leaderboard for a game — aggregated across all persisted online
 * play, ordered by the game's ranking metric, with a bounded per-play history.
 */
export async function globalLeaderboard(
  gameId: string,
  limit = 50,
  historyLimit = 20,
): Promise<GlobalLeaderboard> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT player_id,
                 (SELECT player_name FROM results r2
                   WHERE r2.game_id = results.game_id AND r2.player_id = results.player_id
                   ORDER BY played_at DESC LIMIT 1) AS player_name,
                 COUNT(*)          AS played,
                 SUM(won)          AS wins,
                 SUM(drawn)        AS draws,
                 MAX(rank_metric)  AS best,
                 SUM(rank_metric)  AS total
          FROM results
          WHERE game_id = ?
          GROUP BY player_id`,
    args: [gameId],
  });
  const standingsRows: Standing[] = rs.rows.map((row) => {
    const played = Number(row.played);
    const wins = Number(row.wins);
    const draws = Number(row.draws ?? 0);
    return {
      playerId: String(row.player_id),
      playerName: String(row.player_name),
      played,
      wins,
      draws,
      losses: played - wins - draws,
      winRate: played ? (wins + draws / 2) / played : 0,
      best: Number(row.best),
      totalMetric: Number(row.total),
      tier: tierFor(played),
    };
  });
  // The global board keeps its established card-game order (wins, best).
  const rows = orderStandings(gameId, standingsRows, { metric: "best" })
    .slice(0, limit)
    .map((r) => ({ ...r, bestMetric: r.best }));

  const recent = await db.execute({
    sql: `SELECT player_id, player_name, game_id, variant, difficulty, won, drawn,
                 experience_tier, played_at
          FROM results WHERE game_id = ?
          ORDER BY played_at DESC LIMIT ?`,
    args: [gameId, historyLimit],
  });
  const history: HistoryEntry[] = recentHistory(
    recent.rows.map((row) => {
      // Rows recorded before provenance existed have no difficulty at all.
      const legacy = row.difficulty === null;
      return {
        playerId: String(row.player_id),
        playerName: String(row.player_name),
        gameId: String(row.game_id),
        variant: legacy || row.variant === null ? null : String(row.variant),
        difficulty: legacy ? null : (String(row.difficulty) as PlayDifficulty),
        result: Number(row.won) ? "win" : Number(row.drawn) ? "draw" : "loss",
        tier:
          row.experience_tier === null
            ? null
            : (String(row.experience_tier) as ExperienceTier),
        playedAt: String(row.played_at),
      } satisfies HistoryEntry;
    }),
    historyLimit,
  );
  return { metric: rankingMetric(gameId), rows, history };
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
