/**
 * DELETE /api/admin/leaderboard — wipe persisted global leaderboard results.
 *
 * Disabled unless NUXT_ADMIN_TOKEN is set in the environment; the caller must
 * present the same value as a Bearer token. Optional `?gameId=` limits the wipe
 * to one game, otherwise every game's results are cleared. Room snapshots are
 * left alone (they're reaped on their own schedule).
 */
import { timingSafeEqual } from "node:crypto";
import { createError, defineEventHandler, getQuery, getRequestHeader } from "nuxt/server";
import { clearResults } from "../../utils/db";

/** Constant-time compare that doesn't leak length via early return. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default defineEventHandler(async (event) => {
  const expected = process.env.NUXT_ADMIN_TOKEN;
  // No token configured → the endpoint does not exist, as far as callers know.
  if (!expected) {
    throw createError({ statusCode: 404, statusMessage: "not found" });
  }

  const auth = getRequestHeader(event, "authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided || !tokenMatches(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: "unauthorized" });
  }

  const gameId = getQuery(event).gameId;
  const cleared = await clearResults(typeof gameId === "string" ? gameId : undefined);
  return { ok: true, cleared, gameId: gameId ?? "all" };
});
