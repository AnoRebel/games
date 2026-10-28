/**
 * Albastini configuration, deck composition, and card valuation.
 *
 * 36-card deck (standard 52 minus 2s, 8s, 9s, 10s). Unusual trick ranking:
 * Ace > 7 > King > Jack > Queen > 6 > 5 > 4 > 3. Point values total 120.
 */

import type { Rank } from "@games/engine-core";

export type TeamMode = "individual" | "teams-of-two" | "teams-of-three";

export interface AlbastiniConfig {
  /** How seats are grouped for scoring. */
  teamMode: TeamMode;
  /** Allow opponents to bid (otea) before trump is revealed. */
  enableBidding: boolean;
  /** Number of hands to play; victory points accumulate across hands. */
  hands: number;
}

export function defaultAlbastiniConfig(): AlbastiniConfig {
  return {
    teamMode: "individual",
    enableBidding: true,
    hands: 1,
  };
}

/** Ranks removed from the standard deck for Albastini. */
export const STRIPPED_RANKS: readonly Rank[] = [2, 8, 9, 10];

/** Trick-rank strength: higher number beats lower (within a suit). */
const TRICK_STRENGTH: Record<Rank, number> = {
  1: 9, // Ace (highest)
  7: 8,
  13: 7, // King
  11: 6, // Jack
  12: 5, // Queen
  6: 4,
  5: 3,
  4: 2,
  3: 1,
  // Stripped ranks never appear; give them 0 for totality.
  2: 0,
  8: 0,
  9: 0,
  10: 0,
};

export function trickStrength(rank: Rank): number {
  return TRICK_STRENGTH[rank];
}

/** Point value captured in tricks. */
const POINT_VALUE: Record<Rank, number> = {
  1: 11, // Ace (Dume)
  7: 10, // Seven (Jike)
  13: 4, // King (Mzungu)
  11: 3, // Jack
  12: 2, // Queen
  6: 0,
  5: 0,
  4: 0,
  3: 0,
  2: 0,
  8: 0,
  9: 0,
  10: 0,
};

export function pointValue(rank: Rank): number {
  return POINT_VALUE[rank];
}

/** Cards dealt to each player. */
export const HAND_SIZE = 5;

/** Supported player counts. */
export const SUPPORTED_COUNTS = [2, 3, 4, 6];
