/**
 * Per-game leaderboard, backed by Dexie (results table).
 *
 * Records a finished match's results and aggregates per player for a game:
 * games played, wins, and a game-appropriate rank metric (higher is better).
 */
import { useDb, type GameResult } from "~/db";

export interface LeaderboardRow {
  playerId: string;
  playerName: string;
  played: number;
  wins: number;
  best: number;
  totalMetric: number;
}

export type LeaderboardScope = "all" | "public" | "private" | "offline";

export function useLeaderboard(
  gameId: MaybeRefOrGetter<string>,
  scope: MaybeRefOrGetter<LeaderboardScope> = "all",
) {
  const db = useDb();
  const gid = computed(() => toValue(gameId));
  const sc = computed(() => toValue(scope));

  const results = useLiveQuery<GameResult[]>(
    () =>
      db.results
        .where("gameId")
        .equals(gid.value)
        .toArray()
        .then((rows) =>
          sc.value === "all"
            ? rows
            : rows.filter((r) => (r.visibility ?? "offline") === sc.value),
        ),
    [],
  );

  const rows = computed<LeaderboardRow[]>(() => {
    const byPlayer = new Map<string, LeaderboardRow>();
    for (const r of results.value) {
      const row = byPlayer.get(r.playerId) ?? {
        playerId: r.playerId,
        playerName: r.playerName,
        played: 0,
        wins: 0,
        best: -Infinity,
        totalMetric: 0,
      };
      row.played += 1;
      if (r.won) row.wins += 1;
      row.best = Math.max(row.best, r.rankMetric);
      row.totalMetric += r.rankMetric;
      row.playerName = r.playerName; // keep latest name
      byPlayer.set(r.playerId, row);
    }
    return [...byPlayer.values()].sort(
      (a, b) => b.wins - a.wins || b.totalMetric - a.totalMetric,
    );
  });

  return { rows, results };
}

/**
 * Record results for a finished match. Called once per participant. `rankMetric`
 * is higher-is-better (e.g. Albastini victory points, or -penalty for Last Card).
 */
export async function recordResults(entries: Omit<GameResult, "id">[]) {
  if (!import.meta.client) return;
  // Never write into the new database before older results have been moved
  // into it; an unresolved migration is reported by DataMigrationNotice.
  const migration = useDataMigration();
  await migration.ready();
  if (migration.state.value !== "ready") return;
  const db = useDb();
  await db.results.bulkAdd(entries);
}
