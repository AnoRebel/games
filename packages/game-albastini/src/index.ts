// @games/game-albastini — Albastini game module.

import {
  type GameModule,
  type Player,
  type Seat,
  registerGame,
} from "@games/engine-core";
import { type AlbastiniConfig, SUPPORTED_COUNTS, defaultAlbastiniConfig } from "./config";
import type { AlbastiniMove, AlbastiniState } from "./state";
import { createInitialState, getLegalMoves, getScores, reducer } from "./rules";

export const ALBASTINI_ID = "albastini";

/**
 * Hide other seats' hand CONTENTS and the undealt stock identities, but PRESERVE
 * counts via face-down placeholders. The UI needs opponent hand sizes (to render
 * backs and animate plays/draws); only the card identities must stay secret.
 */
function redactFor(state: AlbastiniState, viewer: Seat | null): AlbastiniState {
  const placeholder = () => ({ rank: 3 as const, suit: "c" as const });
  const hands: Record<Seat, AlbastiniState["hands"][number]> = {};
  for (const p of state.players) {
    hands[p.seat] =
      viewer === p.seat
        ? state.hands[p.seat]!
        : (state.hands[p.seat] ?? []).map(placeholder);
  }
  return {
    ...state,
    hands,
    // Preserve stock count but hide identities (face-down placeholders).
    stock: state.stock.map(placeholder) as typeof state.stock,
  };
}

export const albastiniGame: GameModule<AlbastiniState, AlbastiniMove, AlbastiniConfig> = {
  id: ALBASTINI_ID,
  meta: {
    id: ALBASTINI_ID,
    name: "Albastini",
    tagline: "Trick-taking with trumps, bidding and the mighty seven.",
    minPlayers: 2,
    maxPlayers: 6,
    supportedPlayerCounts: SUPPORTED_COUNTS,
    difficulties: ["easy", "normal", "hard"],
    defaultDifficulty: "normal",
  },
  defaultConfig: defaultAlbastiniConfig,
  createInitialState(config: AlbastiniConfig, players: Player[], seed) {
    return createInitialState(config, players, seed);
  },
  reducer,
  getLegalMoves,
  isTerminal: (state) => state.phase === "finished",
  getScores,
  redactFor,
};

/** Register the Albastini game with the engine registry. */
export function registerAlbastini(): void {
  registerGame(albastiniGame as unknown as GameModule);
}

export {
  defaultAlbastiniConfig,
  type AlbastiniConfig,
  pointValue,
  trickStrength,
  HAND_SIZE,
  SUPPORTED_COUNTS,
} from "./config";
export type { AlbastiniState, AlbastiniMove } from "./state";
export {
  albastiniRules,
  albastiniTutorial,
  albastiniRulesSw,
  albastiniTutorialSw,
} from "./content";
export type { RulesSection, TutorialStep } from "./content";
