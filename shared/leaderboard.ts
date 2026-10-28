/**
 * Leaderboard rules shared by the browser (local history) and the server
 * (global board): each game's ranking metric, result attribution, standings
 * order, and per-game experience tiers.
 *
 *  - Last Card ranks by lowest cumulative penalty (stored as -penalty).
 *  - Albastini ranks by victory points.
 *  - Bao and Checkers rank by match wins: 1 for a win, ½ for a draw, 0 for a
 *    loss. All rule variants of a game share one board.
 *  - Bot difficulty is recorded for display and never changes a standing.
 *  - Experience tiers count completed plays per game (New 0–9, Regular
 *    10–49, Veteran 50+). They describe experience, not skill, and never
 *    affect ranking.
 */

export type RankingMetric = "penalty" | "victory-points" | "match-wins";

/** How each game ranks its players. Unknown games rank by match wins. */
export const RANKING_METRIC: Record<string, RankingMetric> = {
  "last-card": "penalty",
  albastini: "victory-points",
  bao: "match-wins",
  checkers: "match-wins",
};

export const rankingMetric = (gameId: string): RankingMetric =>
  RANKING_METRIC[gameId] ?? "match-wins";

export type ExperienceTier = "new" | "regular" | "veteran";

/** The tier a player holds after `plays` completed plays of a game. */
export function tierFor(plays: number): ExperienceTier {
  if (plays >= 50) return "veteran";
  if (plays >= 10) return "regular";
  return "new";
}

/** Bot strength in a played match; `none` when no seat was a bot. */
export type PlayDifficulty = "easy" | "normal" | "hard" | "none";

export interface MatchScores {
  bySeat: Record<number, number>;
  victoryBySeat?: Record<number, number>;
  winners: number[];
  drawn?: boolean;
}

/** One seat's result: did it win, was it a draw, and its higher-is-better metric. */
export function seatResult(gameId: string, scores: MatchScores, seat: number) {
  const won = scores.winners.includes(seat);
  const drawn = !!scores.drawn && !won;
  const raw = scores.bySeat[seat] ?? 0;
  let rankMetric: number;
  switch (rankingMetric(gameId)) {
    case "penalty":
      rankMetric = -raw;
      break;
    case "victory-points":
      rankMetric = scores.victoryBySeat?.[seat] ?? raw;
      break;
    default:
      rankMetric = won ? 1 : drawn ? 0.5 : 0;
  }
  return { won, drawn, score: raw, rankMetric };
}

/** The fields standings need from one recorded play. */
export interface PlayRecord {
  playerId: string;
  playerName: string;
  won: boolean;
  drawn?: boolean;
  rankMetric: number;
  playedAt: string;
}

export interface Standing {
  playerId: string;
  playerName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** (wins + draws / 2) / played. */
  winRate: number;
  best: number;
  totalMetric: number;
  /** Current per-game experience tier. */
  tier: ExperienceTier;
}

/** Aggregate plays into one row per player. */
export function aggregate(plays: readonly PlayRecord[]): Standing[] {
  const by = new Map<string, Standing & { lastAt: string }>();
  for (const p of plays) {
    const row = by.get(p.playerId) ?? {
      playerId: p.playerId,
      playerName: p.playerName,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      best: -Infinity,
      totalMetric: 0,
      tier: "new" as ExperienceTier,
      lastAt: "",
    };
    row.played += 1;
    if (p.won) row.wins += 1;
    else if (p.drawn) row.draws += 1;
    else row.losses += 1;
    row.best = Math.max(row.best, p.rankMetric);
    row.totalMetric += p.rankMetric;
    // Show the name used most recently.
    if (p.playedAt >= row.lastAt) {
      row.playerName = p.playerName;
      row.lastAt = p.playedAt;
    }
    by.set(p.playerId, row);
  }
  return [...by.values()].map(({ lastAt: _lastAt, ...row }) => ({
    ...row,
    winRate: row.played ? (row.wins + row.draws / 2) / row.played : 0,
    tier: tierFor(row.played),
  }));
}

/**
 * Order standings for a game. Win-based games: wins, then win rate, then
 * fewer games played, then name. Card games keep their established order:
 * wins, then their own metric (total locally, best on the global board),
 * then name for a stable display.
 */
export function orderStandings(
  gameId: string,
  rows: Standing[],
  { metric = "total" }: { metric?: "total" | "best" } = {},
): Standing[] {
  const byName = (a: Standing, b: Standing) => a.playerName.localeCompare(b.playerName);
  const sorted = [...rows];
  if (rankingMetric(gameId) === "match-wins") {
    sorted.sort(
      (a, b) =>
        b.wins - a.wins || b.winRate - a.winRate || a.played - b.played || byName(a, b),
    );
  } else {
    const m = (r: Standing) => (metric === "best" ? r.best : r.totalMetric);
    sorted.sort((a, b) => b.wins - a.wins || m(b) - m(a) || byName(a, b));
  }
  return sorted;
}

/** Standings for one game's plays, aggregated and ordered. */
export function standings(
  gameId: string,
  plays: readonly PlayRecord[],
  opts?: { metric?: "total" | "best" },
): Standing[] {
  return orderStandings(gameId, aggregate(plays), opts);
}

/** A row of the per-play history shown beside the standings. */
export interface HistoryEntry {
  playerId: string;
  playerName: string;
  gameId: string;
  /** null = recorded before variants were stored (unknown). */
  variant: string | null;
  /** null = unknown (legacy); `none` = no bot seats. */
  difficulty: PlayDifficulty | null;
  result: "win" | "draw" | "loss";
  /** Tier snapshot taken when the play was recorded; null = unknown (legacy). */
  tier: ExperienceTier | null;
  playedAt: string;
}

export const resultOf = (p: {
  won: boolean;
  drawn?: boolean | null;
}): HistoryEntry["result"] => (p.won ? "win" : p.drawn ? "draw" : "loss");

/** Most recent plays first, bounded. */
export function recentHistory<T extends { playedAt: string }>(
  plays: readonly T[],
  limit = 20,
): T[] {
  return [...plays].sort((a, b) => b.playedAt.localeCompare(a.playedAt)).slice(0, limit);
}
