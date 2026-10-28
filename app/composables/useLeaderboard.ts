/**
 * Per-game leaderboard from this device's results (Dexie), using the same
 * ranking rules as the global board: standings per the game's metric, plus
 * a per-play history with game, variant, difficulty and experience tier.
 */
import { useDb, type GameResult } from "~/db";
import {
  recentHistory,
  resultOf,
  standings,
  tierFor,
  type HistoryEntry,
  type Standing,
} from "#shared/leaderboard";

export type LeaderboardRow = Standing;

export type LeaderboardScope = "all" | "public" | "private" | "offline";

/** A stored result as a history row; legacy rows have unknown provenance. */
export function historyEntry(r: GameResult): HistoryEntry {
  const legacy = r.difficulty === undefined;
  return {
    playerId: r.playerId,
    playerName: r.playerName,
    gameId: r.gameId,
    variant: legacy ? null : (r.variant ?? null),
    difficulty: legacy ? null : r.difficulty!,
    result: resultOf(r),
    tier: r.experienceTier ?? null,
    playedAt: r.playedAt,
  };
}

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

  const rows = computed<LeaderboardRow[]>(() => standings(gid.value, results.value));
  const history = computed<HistoryEntry[]>(() =>
    recentHistory(results.value).map(historyEntry),
  );

  return { rows, results, history };
}

/**
 * Record results for a finished match, one entry per human participant.
 * Idempotent per match and player: recording the same match twice changes
 * nothing. Each new row snapshots the player's experience tier for that game
 * after counting this play.
 */
export async function recordResults(
  entries: Omit<GameResult, "id" | "experienceTier">[],
) {
  if (!import.meta.client) return;
  // Never write into the new database before older results have been moved
  // into it; an unresolved migration is reported by DataMigrationNotice.
  const migration = useDataMigration();
  await migration.ready();
  if (migration.state.value !== "ready") return;
  await writeResults(useDb(), entries);
}

/** The transactional write behind recordResults (exported for tests). */
export async function writeResults(
  db: ReturnType<typeof useDb>,
  entries: Omit<GameResult, "id" | "experienceTier">[],
) {
  await db.transaction("rw", db.results, async () => {
    for (const e of entries) {
      const dup = await db.results
        .where("[matchId+playerId]")
        .equals([e.matchId, e.playerId])
        .first();
      if (dup) continue;
      const before = await db.results
        .where("[gameId+playerId]")
        .equals([e.gameId, e.playerId])
        .count();
      await db.results.add({ ...e, experienceTier: tierFor(before + 1) });
    }
  });
}
