// @card-games/game-last-card — Last Card game module.

import {
  type Card,
  type GameModule,
  type Player,
  type ScoreResult,
  type Seat,
  registerGame,
} from "@card-games/engine-core";
import { type LastCardConfig, defaultLastCardConfig } from "./config";
import type { LastCardMove, LastCardState } from "./state";
import { createInitialState, getLegalMoves, reducer } from "./rules";

export const LAST_CARD_ID = "last-card";

function getScores(state: LastCardState): ScoreResult {
  const bySeat = { ...state.cumulativeScores };
  // Lowest cumulative penalty wins.
  const min = Math.min(...Object.values(bySeat));
  const winners =
    state.phase === "finished"
      ? Object.entries(bySeat)
          .filter(([, v]) => v === min)
          .map(([s]) => Number(s))
      : [];
  return { bySeat, winners };
}

/**
 * Hide other seats' hand CONTENTS from a viewer, but PRESERVE the count by
 * replacing each hidden card with a face-down placeholder. The UI relies on the
 * count (to render opponent backs and to detect draws for animation); the card
 * identities are what must stay secret, not the size of the hand.
 */
function redactFor(state: LastCardState, viewer: Seat | null): LastCardState {
  const placeholder = (): Card => ({ rank: 1, suit: "c" });
  const hands: Record<Seat, (typeof state.hands)[number]> = {};
  for (const p of state.players) {
    hands[p.seat] =
      viewer === p.seat
        ? state.hands[p.seat]!
        : (state.hands[p.seat] ?? []).map(placeholder);
  }
  // Hide the draw pile contents too, preserving count via face-down placeholders.
  return {
    ...state,
    hands,
    drawPile: state.drawPile.map(placeholder) as typeof state.drawPile,
  };
}

export const lastCardGame: GameModule<LastCardState, LastCardMove, LastCardConfig> = {
  id: LAST_CARD_ID,
  meta: {
    id: LAST_CARD_ID,
    name: "Last Card",
    tagline: "Shed your hand first — and call your last card!",
    minPlayers: 2,
    maxPlayers: 6,
    supportedPlayerCounts: [2, 3, 4, 5, 6],
    difficulties: ["easy", "normal", "hard"],
    defaultDifficulty: "normal",
  },
  defaultConfig: defaultLastCardConfig,
  createInitialState(config: LastCardConfig, players: Player[], seed) {
    return createInitialState(config, players, seed);
  },
  reducer,
  getLegalMoves,
  isTerminal: (state) => state.phase === "finished",
  getScores,
  redactFor,
};

/** Register the Last Card game with the engine registry. */
export function registerLastCard(): void {
  registerGame(lastCardGame as unknown as GameModule);
}

export { defaultLastCardConfig, type LastCardConfig } from "./config";
export type { LastCardState, LastCardMove } from "./state";
export { canPlay } from "./rules";
export {
  lastCardRules,
  lastCardTutorial,
  lastCardRulesSw,
  lastCardTutorialSw,
} from "./content";
export type { RulesSection, TutorialStep } from "./content";
