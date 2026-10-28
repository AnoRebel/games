/**
 * Nitro plugin: start the server database migration at boot, before any
 * request opens the database (every database user waits for it — see
 * utils/db). Its outcome, including a refused conflict, is logged once here.
 */
import { consola } from "consola";
import { defineNitroPlugin } from "nitropack/runtime";
import { ensureServerDatabaseMigrated } from "../utils/dbMigration";

const log = consola.withTag("db-migration");

export default defineNitroPlugin(() => {
  if (import.meta.prerender) return;
  ensureServerDatabaseMigrated().then(
    (r) => {
      if (r.status === "migrated") {
        log.success(`moved the database to games.db (backup: ${r.backup})`, r.counts);
      }
    },
    (e: unknown) => log.error(`database unavailable until resolved: ${String(e)}`),
  );
});
