/**
 * POST /api/rooms — create a room. Returns the room id and (for locked rooms)
 * the spectator passcode the host can bake into a spectator link.
 */
import { requireGame } from "@card-games/engine-core";
import { createError, defineEventHandler, getRequestIP, readBody } from "nuxt/server";
import { getRoomHub } from "../utils/roomHub";
import type { RoomConfig, SpectatorVisibility } from "../utils/roomTypes";

interface CreateBody {
  gameId: string;
  gameConfig?: unknown;
  playerCount?: number;
  spectatorVisibility?: SpectatorVisibility;
  spectatorPasscode?: string;
  /** Optional memorable room id; sanitized server-side, falls back if taken. */
  customId?: string;
  /** Optional per-turn time limit (ms); auto-plays an idle seat on expiry. */
  turnTimeoutMs?: number;
  /** Keep the room alive while empty. Off by default — empty rooms are reaped. */
  persist?: boolean;
  /** Spectator cap. Omit/0 from the client = unlimited; -1 = none allowed. */
  maxSpectators?: number;
}

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
  const body = await readBody<CreateBody>(event);
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

  const maxPlayers = Math.min(
    body.playerCount ?? game.meta.maxPlayers,
    game.meta.maxPlayers,
  );

  // MERGE the client's (possibly partial) variant config OVER the full engine
  // defaults — a partial like { rounds: 3 } must not drop suitChangeCards etc.,
  // or getLegalMoves crashes on the missing fields.
  const gameConfig =
    body.gameConfig && typeof body.gameConfig === "object"
      ? { ...(game.defaultConfig() as object), ...(body.gameConfig as object) }
      : game.defaultConfig();

  const config: RoomConfig = {
    gameId: body.gameId,
    gameConfig,
    maxPlayers,
    minPlayers: game.meta.minPlayers,
    spectatorVisibility: visibility,
    spectatorPasscode: passcode,
    // Clamp to a sane range (5s–120s) if a limit was requested.
    turnTimeoutMs:
      body.turnTimeoutMs && body.turnTimeoutMs > 0
        ? Math.min(120_000, Math.max(5_000, body.turnTimeoutMs))
        : undefined,
    persist: body.persist === true,
    // The client sends -1 for "no spectators" and omits the field for unlimited
    // (0 would be ambiguous with "none"). Normalize to: undefined = unlimited,
    // 0 = none, n>0 = cap. Clamp to a sane ceiling.
    maxSpectators:
      typeof body.maxSpectators === "number" && body.maxSpectators !== 0
        ? Math.min(500, Math.max(0, body.maxSpectators === -1 ? 0 : body.maxSpectators))
        : undefined,
  };

  const roomId = hub.createRoom(config, body.customId);
  return {
    roomId,
    spectatorVisibility: visibility,
    spectatorPasscode: passcode || undefined,
  };
});
