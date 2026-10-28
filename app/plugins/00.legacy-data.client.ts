/**
 * Runs before anything reads storage: copies a returning player's legacy
 * keys and locale cookie to the new names (synchronously, so identity and
 * preferences are in place before components initialise them), then starts
 * the database copy, which gameplay and result recording wait for.
 */
import { migrateLocaleCookie, migrateStorageKeys } from "~/utils/migrateLegacyData";

export default defineNuxtPlugin({
  name: "legacy-data-migration",
  enforce: "pre",
  setup(nuxtApp) {
    for (const area of ["localStorage", "sessionStorage"] as const) {
      try {
        migrateStorageKeys(window[area]);
      } catch {
        /* storage unavailable (private mode) — nothing to migrate */
      }
    }
    const locale = migrateLocaleCookie(document);
    void startDataMigration();
    if (locale) {
      // The server rendered with the default locale; switch to the player's.
      nuxtApp.hook("app:mounted", () => {
        const app = nuxtApp as unknown as {
          $getLocale?: () => string;
          $switchLocale?: (code: string) => void;
        };
        if (app.$getLocale?.() !== locale) app.$switchLocale?.(locale);
      });
    }
  },
});
