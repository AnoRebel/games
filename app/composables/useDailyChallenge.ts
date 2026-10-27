/**
 * Daily challenge: a fixed "seed of the day" so everyone plays the SAME deal,
 * plus a local play streak (how many days in a row you've played the daily).
 * The game itself is free — the engine is seed-deterministic — and the streak is
 * a strong, zero-infra habit hook. A shared daily leaderboard would need the
 * server datastore (see the global-leaderboard work); this is the local part.
 */
export interface DailyState {
  /** YYYY-MM-DD for the current day (local time). */
  dateKey: string;
  /** Deterministic seed shared by all players for today. */
  seed: string;
  /** Which game today's challenge uses (alternates by day). */
  gameId: string;
  /** Whether the local player has completed today's challenge. */
  playedToday: boolean;
  /** Current consecutive-day streak (up to and including today if played). */
  streak: number;
}

const DAILY_GAMES = ["last-card", "albastini"];

function todayKey(now: Date): string {
  // Local calendar date, not UTC — the "day" a player experiences.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seedFrom(dateKey: string): string {
  return `daily-${dateKey}`;
}

/** Day index since an epoch, to alternate the game deterministically. */
function dayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function useDailyChallenge() {
  // Persisted: last day completed + the streak count.
  const lastCompleted = useLocalStorage("games:daily-last", "");
  const streakCount = useLocalStorage("games:daily-streak", 0);

  const today = computed<DailyState>(() => {
    // new Date() is fine here — this is UI/session logic, not the engine.
    const key = todayKey(new Date());
    const idx = dayIndex(key);
    return {
      dateKey: key,
      seed: seedFrom(key),
      gameId: DAILY_GAMES[idx % DAILY_GAMES.length]!,
      playedToday: lastCompleted.value === key,
      streak: streakCount.value,
    };
  });

  /** Call when the player finishes today's daily to advance the streak. */
  function markPlayed() {
    const key = today.value.dateKey;
    if (lastCompleted.value === key) return; // already counted today
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    // Continue the streak if the last completion was yesterday, else restart.
    streakCount.value = lastCompleted.value === yesterday ? streakCount.value + 1 : 1;
    lastCompleted.value = key;
  }

  return { today, markPlayed };
}
