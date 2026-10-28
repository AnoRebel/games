/**
 * Derives a structured move log from successive game states. The engine doesn't
 * emit events, so we diff key fields between renders and append entries.
 */
import type { BaseGameState } from "@games/engine-core";

export interface LogEntry {
  id: number;
  /** Who made the move. */
  who: string;
  /** Short action verb, e.g. "played", "drew", "ate". */
  action: string;
  /** Optional card short label, e.g. "7♥". */
  card?: string;
  icon: string;
}

export function useMoveLog<S extends BaseGameState>(
  describe: (prev: S | null, next: S) => Omit<LogEntry, "id"> | null,
) {
  const entries = ref<LogEntry[]>([]);
  let prev: S | null = null;
  let counter = 0;

  function push(next: S) {
    const d = describe(prev, next);
    prev = next;
    if (!d) return;
    entries.value = [{ id: counter++, ...d }, ...entries.value].slice(0, 50);
  }

  function reset() {
    entries.value = [];
    prev = null;
  }

  return { entries, push, reset };
}
