/**
 * State of the one-time browser data migration (see utils/migrateLegacyData).
 * Gameplay and result recording wait for it, and a failure or conflict is
 * reported to the player instead of silently starting with empty data.
 */
import { useDb } from "~/db";
import {
  markMigrationComplete,
  migrateDatabase,
  migrationComplete,
  type DatabaseMigration,
} from "~/utils/migrateLegacyData";

export type DataMigrationState = "pending" | "ready" | "failed" | "conflict";

const state = ref<DataMigrationState>(import.meta.client ? "pending" : "ready");
const result = ref<DatabaseMigration | null>(null);
let running: Promise<void> | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Start (or restart) the database migration; resolves when it settles. */
export function startDataMigration(): Promise<void> {
  if (!import.meta.client) return Promise.resolve();
  const ls = storage();
  if (ls && migrationComplete(ls)) {
    state.value = "ready";
    return Promise.resolve();
  }
  state.value = "pending";
  running = migrateDatabase(useDb()).then((r) => {
    result.value = r;
    if (r.status === "none" || r.status === "done" || r.status === "already") {
      // Only now is the copy verified; record completion last.
      if (ls) markMigrationComplete(ls);
      state.value = "ready";
    } else {
      state.value = r.status === "conflict" ? "conflict" : "failed";
    }
  });
  return running;
}

export function useDataMigration() {
  return {
    state: readonly(state),
    result: readonly(result),
    /** Resolves once the migration has settled (successfully or not). */
    ready: () => running ?? Promise.resolve(),
    retry: () => startDataMigration(),
    /**
     * Keep the data already in the new database and stop importing; the
     * legacy database stays untouched as a recovery copy.
     */
    keepCurrent() {
      const ls = storage();
      if (ls) markMigrationComplete(ls);
      state.value = "ready";
    },
  };
}
