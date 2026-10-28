/**
 * Last Card variant configuration.
 *
 * The rules of Last Card vary widely by source, so action cards are modelled as
 * toggleable config rather than hardcoded. Defaults reflect this project's
 * ruleset (54-card deck incl. 2 jokers, 7-card hands, 2 = pick up 2, Joker =
 * pick up 5, 7 = skip, 8 = reverse, Jack = suit-change wild).
 *
 * NB: the Joker is represented as rank 0 in `pickupCards` — jokers carry
 * `rank: 0` (see engine-core `joker`/`isJoker`), so a `{ rank: 0, amount }`
 * entry targets them.
 */

import type { Card, Rank } from "@games/engine-core";
import { isJoker } from "@games/engine-core";

export interface LastCardConfig {
  /** Cards dealt to each player at the start of a round. */
  handSize: number;
  /**
   * If the turned starting card is an action card, re-draw a plain card to
   * start instead of applying its effect.
   */
  redrawActionStart: boolean;

  /**
   * Ranks that force the next player to pick up, with the pickup amount.
   * Rank 0 targets the Joker (a suitless wild pick-up card). Any pickup card may
   * stack on any other when `allowPickupStacking` is on (e.g. a Joker's +5 on a
   * 2's +2 → +7), since the pending penalty just accumulates.
   */
  pickupCards: { rank: Rank | 0; amount: number }[];
  /** Allow stacking pickup cards to pass on an accumulating penalty. */
  allowPickupStacking: boolean;

  /** Ranks that skip the next player's turn. */
  skipCards: Rank[];
  /** Ranks that reverse play direction. */
  reverseCards: Rank[];

  /**
   * Allow ANY player holding a matching skip/reverse card to interject it onto a
   * pending skip/reverse chain, out of turn. Each interjected skip pushes the
   * stop one seat further (and stops everyone it passes through); each
   * interjected reverse flips the direction again. The seat the stop currently
   * rests on may interject too — "stopping themselves" to forfeit their own turn
   * and send the stop onward.
   *
   * Skip/reverse chains are SEPARATE from the pickup chain: neither may be
   * played onto a pending pickup, and pickups may not be played onto them.
   */
  allowActionInterjection: boolean;
  /**
   * Milliseconds the interjection window stays open before the chain resolves
   * automatically. 0 = no timer: the window stays open until every eligible
   * player has passed (host preference).
   */
  interjectionWindowMs: number;
  /** Ranks that let the player nominate the next suit (wild). */
  suitChangeCards: Rank[];

  /** Require declaring "Last Card" when reducing to one card. */
  requireLastCardCall: boolean;
  /** Penalty cards drawn for a missed "Last Card" call. */
  missedCallPenalty: number;
  /**
   * Whether an action card (pickup/skip/reverse/suit-change) may be the final
   * card played to win. The common rule is `false`: you must go out on a plain
   * card, so an action card cannot be your last.
   */
  allowActionCardFinish: boolean;

  /**
   * Allow playing several cards of the SAME RANK in one turn (pairs, triplets,
   * quadruplets…). The first (lead) card must be a legal play; the rest stack on
   * top. Action effects (pickup/skip) apply per card played.
   */
  allowMultiSameRank: boolean;

  /** Number of rounds; 1 = single round, >1 = cumulative lowest score wins. */
  rounds: number;
}

export function defaultLastCardConfig(): LastCardConfig {
  return {
    handSize: 7,
    redrawActionStart: true,
    // 2 = pick up 2, Joker (rank 0) = pick up 5; both stack (2 + Joker = +7).
    pickupCards: [
      { rank: 2, amount: 2 },
      { rank: 0, amount: 5 },
    ],
    allowPickupStacking: true,
    skipCards: [7],
    reverseCards: [8],
    allowActionInterjection: true,
    interjectionWindowMs: 0,
    suitChangeCards: [11], // Jack
    requireLastCardCall: true,
    missedCallPenalty: 2,
    allowActionCardFinish: false,
    allowMultiSameRank: true,
    rounds: 1,
  };
}

/** Penalty point value of a card left in hand at round end. */
export function cardPenaltyValue(card: Card): number {
  if (isJoker(card)) return 15; // Joker — the heaviest card to be caught holding
  const rank = card.rank;
  if (rank === 1) return 1; // Ace
  if (rank >= 11) return 10; // J/Q/K
  return rank; // pip value
}
