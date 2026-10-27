/**
 * POST /api/rooms — create a room. Returns the room id and (for locked rooms)
 * the spectator passcode the host can bake into a spectator link.
 */
import { requireGame } from "@games/engine-core";
import {
  buildRoomConfig,
  GameConfigError,
  type CreateRoomBody,
} from "../utils/roomConfig";
import { createError, defineEventHandler, getRequestIP, readBody } from "nuxt/server";
import { getRoomHub } from "../utils/roomHub";
import type { SpectatorVisibility } from "../utils/roomTypes";

// Global room cap and a small per-IP create rate limit — a room lingers ≥60s
// even if never joined, so unbounded creation is a memory-exhaustion vector.
const MAX_ROOMS = 500;
const CREATE_WINDOW_MS = 60_000;
const CREATE_MAX_PER_WINDOW = 10;
const createHits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const hits = (createHits.get(ip) ?? []).filter((t) => now - t < CREATE_WINDOW_MS);
  if (hits.length >= CREATE_MAX_PER_WINDOW) {
    createHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  createHits.set(ip, hits);
  return false;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateRoomBody>(event);
  if (!body?.gameId) {
    throw createError({ statusCode: 400, statusMessage: "gameId required" });
  }

  // Touch the hub first so games are registered in this server runtime.
  const hub = getRoomHub();

  // Abuse guards: global cap + per-IP rate limit.
  if (hub.roomCount() >= MAX_ROOMS) {
    throw createError({ statusCode: 503, statusMessage: "server busy — too many rooms" });
  }
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (rateLimited(ip, Date.now())) {
    throw createError({
      statusCode: 429,
      statusMessage: "too many rooms created — slow down",
    });
  }

  let game;
  try {
    game = requireGame(body.gameId);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "unknown game" });
  }

  const visibility: SpectatorVisibility = body.spectatorVisibility ?? "public";
  // Generate a passcode for locked rooms when none supplied.
  const passcode =
    visibility === "locked"
      ? body.spectatorPasscode ||
        Math.abs(Date.now() % 1_000_000)
          .toString()
          .padStart(6, "0")
      : "";

  // Variant and difficulty are validated against the game's declaration; an
  // unsupported value is rejected by name rather than silently replaced.
  let config;
  try {
    config = buildRoomConfig(
      game,
      { ...body, spectatorVisibility: visibility },
      passcode,
    );
  } catch (e) {
    if (e instanceof GameConfigError) {
      throw createError({ statusCode: 400, statusMessage: e.message });
    }
    throw e;
  }

  const roomId = hub.createRoom(config, body.customId);
  return {
    roomId,
    spectatorVisibility: visibility,
    spectatorPasscode: passcode || undefined,
  };
});
