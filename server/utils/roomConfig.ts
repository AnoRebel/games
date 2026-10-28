/**
 * Build a room's config from a create request: merge the client's (possibly
 * partial) engine config over the game's defaults, and validate the rule
 * variant and bot difficulty against the game's declaration. Unsupported
 * values throw a GameConfigError naming them; nothing is created.
 */
import {
  type GameModule,
  type Difficulty,
  GameConfigError,
  resolveSetup,
} from "@games/engine-core";
import type { RoomConfig, SpectatorVisibility } from "./roomTypes";

export interface CreateRoomBody {
  gameId: string;
  gameConfig?: unknown;
  /** Rule variant id; may also ride on `gameConfig.variant`. */
  variant?: string;
  /** Strength of bot-filled seats. */
  difficulty?: Difficulty;
  /** Seats the server fills with bots at start. */
  botSeats?: number;
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

export { GameConfigError };

export function buildRoomConfig(
  game: Pick<GameModule, "meta" | "defaultConfig">,
  body: CreateRoomBody,
  passcode: string,
): RoomConfig {
  const partial =
    body.gameConfig && typeof body.gameConfig === "object"
      ? { ...(body.gameConfig as Record<string, unknown>) }
      : {};
  if (body.variant !== undefined) partial.variant = body.variant;
  partial.difficulty = body.difficulty;
  const { config, difficulty } = resolveSetup(game, partial);

  const maxPlayers = Math.max(
    game.meta.minPlayers,
    Math.min(body.playerCount ?? game.meta.maxPlayers, game.meta.maxPlayers),
  );
  const botSeats =
    typeof body.botSeats === "number" && body.botSeats > 0
      ? Math.min(Math.floor(body.botSeats), maxPlayers - 1)
      : 0;
  const visibility: SpectatorVisibility = body.spectatorVisibility ?? "public";

  return {
    gameId: body.gameId,
    gameConfig: config,
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
    botSeats,
    difficulty,
  };
}

/** The rule variant a room's config selects, if the game has variants. */
export function roomVariant(config: RoomConfig): string | null {
  const v = (config.gameConfig as { variant?: unknown } | null)?.variant;
  return typeof v === "string" ? v : null;
}
