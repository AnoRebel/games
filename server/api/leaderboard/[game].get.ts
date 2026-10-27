/**
 * GET /api/leaderboard/:game — the GLOBAL leaderboard for a game, aggregated
 * from server-authoritative online match results (the only trustworthy source;
 * offline results are client-side and never persisted here).
 */
import { createError, defineEventHandler, getRouterParam } from "nuxt/server";
import { globalLeaderboard } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const game = getRouterParam(event, "game");
  if (!game) throw createError({ statusCode: 400, statusMessage: "game required" });
  try {
    const board = await globalLeaderboard(game, 50, 20);
    return { gameId: game, ...board };
  } catch (e) {
    // Datastore unavailable (e.g. no volume mounted) — degrade gracefully to an
    // empty board rather than 500ing the whole page.
    console.error("[leaderboard] query failed:", e);
    return { gameId: game, rows: [], history: [], unavailable: true };
  }
});
