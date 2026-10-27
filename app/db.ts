/**
 * Dexie (IndexedDB) database — the structured, persistent client storage tier.
 *
 * Holds data that must persist AND is structured/large: leaderboard results,
 * saved offline games, and user-uploaded theme blobs. Scalar prefs live in
 * localStorage; live per-tab session state lives in sessionStorage (see design
 * D5b). Reactive reads use `liveQuery` via the `useLiveQuery` composable.
 */
import Dexie, { type EntityTable } from "dexie";
import type { ExperienceTier, PlayDifficulty } from "#shared/leaderboard";

/** One finished-game result, used to build per-game leaderboards. */
export interface GameResult {
  id?: number;
  gameId: string;
  /** Stable player id (from localStorage identity). */
  playerId: string;
  playerName: string;
  /** Did this player/team win the match. */
  won: boolean;
  /** Game-appropriate score (Last Card: lower better; Albastini: VP). */
  score: number;
  /** Higher-is-better metric for ranking (e.g. VP, or -penalty). */
  rankMetric: number;
  /** ISO timestamp (computed with date-fns at the call site). */
  playedAt: string;
  /** Room/match id for grouping. */
  matchId: string;
  /** Where the match was played — separates public/private/offline boards. */
  visibility?: "public" | "private" | "offline";
  /**
   * Provenance, recorded from v3 on. Rows written earlier lack these fields
   * and are shown with unknown provenance.
   */
  /** Rule variant id; null for games without variants. */
  variant?: string | null;
  /** Bot strength in the match; `none` when no seat was a bot. */
  difficulty?: PlayDifficulty;
  /** The match ended in a draw. */
  drawn?: boolean;
  /** The player's per-game experience tier right after this play. */
  experienceTier?: ExperienceTier;
}

/** A user-uploaded theme asset (card back or background image). */
export interface ThemeAsset {
  id?: number;
  kind: "card-back" | "background";
  name: string;
  blob: Blob;
  createdAt: string;
}

/** A saved offline game (explicit "save game" slot). */
export interface SavedGame {
  id?: number;
  gameId: string;
  name: string;
  /** Serialized engine state + move log (JSON-safe). */
  snapshot: unknown;
  savedAt: string;
}

export class GamesDB extends Dexie {
  results!: EntityTable<GameResult, "id">;
  themeAssets!: EntityTable<ThemeAsset, "id">;
  savedGames!: EntityTable<SavedGame, "id">;

  constructor() {
    super("games");
    this.version(1).stores({
      // Only indexed fields are listed.
      results: "++id, gameId, playerId, matchId, playedAt, rankMetric",
      themeAssets: "++id, kind, createdAt",
      savedGames: "++id, gameId, savedAt",
    });
    // v2 adds the visibility index for public/private leaderboard separation.
    this.version(2).stores({
      results:
        "++id, gameId, playerId, matchId, playedAt, rankMetric, [gameId+visibility]",
    });
    // v3 adds provenance fields (unindexed) plus indexes for idempotent
    // recording and per-game play counts. Older rows stay readable as-is.
    this.version(3).stores({
      results:
        "++id, gameId, playerId, matchId, playedAt, rankMetric, [gameId+visibility], [gameId+playerId], [matchId+playerId]",
    });
  }
}

let _db: GamesDB | null = null;

/** Lazily create the DB (client-only; IndexedDB is unavailable during SSR). */
export function useDb(): GamesDB {
  if (!_db) _db = new GamesDB();
  return _db;
}
