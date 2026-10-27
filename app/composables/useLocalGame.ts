/**
 * Build a LocalTransport for an offline game from the engine registry.
 *
 * Per-tab game session metadata (which game, seats) is the kind of state that
 * lives in sessionStorage when persisted, but the live transport itself is
 * held in component scope (recreated on reload).
 */
import {
  requireGame,
  resolveSetup,
  type BaseGameState,
  type BaseMove,
  type Player,
} from "@games/engine-core";
import { LocalTransport } from "~/transports/LocalTransport";

export interface LocalGameSetup {
  gameId: string;
  /** Number of seats; remaining (non-human) seats become bots. */
  totalPlayers: number;
  humanCount: number;
  /** Display names for human seats (seat 0..humanCount-1). */
  humanNames?: string[];
  /**
   * Stable player ids for human seats (seat 0..humanCount-1). Seat 0 should be
   * the device owner's persistent identity (usePlayerIdentity) so leaderboard
   * results are keyed to the person, not a seat number. Falls back to a
   * per-seat id when absent.
   */
  humanIds?: string[];
  seed?: string;
  config?: unknown;
  /** Pause before a bot moves (ms); defaults to the transport's pacing. */
  botDelayMs?: number;
}

let seedCounter = 0;

export function createLocalTransport(setup: LocalGameSetup) {
  const game = requireGame(setup.gameId);

  const players: Player[] = [];
  for (let seat = 0; seat < setup.totalPlayers; seat++) {
    const isHuman = seat < setup.humanCount;
    players.push({
      // Humans use their stable identity id (leaderboard keys to the person);
      // hotseat seats 1+ fall back to a per-seat id. Bots are never persisted.
      id: isHuman ? (setup.humanIds?.[seat] ?? `you-${seat}`) : `bot-${seat}`,
      name: isHuman
        ? (setup.humanNames?.[seat] ?? `Player ${seat + 1}`)
        : `Bot ${seat + 1}`,
      seat,
      bot: !isHuman,
    });
  }

  const humanSeats = players.filter((p) => !p.bot).map((p) => p.seat);
  // `difficulty` rides on the setup config for the bot policy but is NOT an
  // engine config field. resolveSetup strips it, validates it and any rule
  // variant against the game's declaration, and MERGES the (partial) setup
  // config over the full engine defaults — the setup modal only sends the
  // exposed knobs, so a bare object would drop the rest of the config
  // (pickupCards/suitChangeCards/…) and crash getLegalMoves.
  const { config, difficulty } = resolveSetup<Record<string, unknown>>(
    game,
    (setup.config ?? null) as Record<string, unknown> | null,
  );

  // Team assignment: for a teamMode config, group seats round-robin so partners
  // sit opposite (seat % teamCount). Individual mode leaves team undefined.
  const teamMode = (config as { teamMode?: string } | null)?.teamMode;
  if (teamMode === "teams-of-two" || teamMode === "teams-of-three") {
    const teamCount = teamMode === "teams-of-two" ? 2 : 3;
    for (const p of players) p.team = p.seat % teamCount;
  }
  // Seeds vary per launch without ambient RNG in engine code: a UI-side counter
  // combined with the chosen seed keeps deals fresh yet reproducible per launch.
  const seed = setup.seed ?? `local-${setup.gameId}-${seedCounter++}`;

  return new LocalTransport<BaseGameState, BaseMove, unknown>({
    game,
    players,
    config,
    seed,
    humanSeats,
    difficulty,
    botDelayMs: setup.botDelayMs,
  });
}
