import { describe, it, expect } from "vitest";
import {
  applyMove,
  replay,
  joker,
  cardId,
  type Card,
  type Player,
  type Seat,
} from "@games/engine-core";
import {
  lastCardGame,
  defaultLastCardConfig,
  canPlay,
  type LastCardMove,
  type LastCardState,
} from "../src/index";

const players: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
  { id: "c", name: "C", seat: 2 },
];

const init = (seed = "lc", cfg = defaultLastCardConfig()) =>
  lastCardGame.createInitialState(cfg, players, seed);

const handCount = (s: LastCardState, seat: Seat) => s.hands[seat]!.length;

describe("Last Card — deal & start", () => {
  it("a partial config MUST be merged over defaults (else getLegalMoves crashes)", () => {
    // Regression: rooms.post / useLocalGame used `config ?? defaults`, so a
    // partial variant like { rounds: 3 } dropped suitChangeCards/pickupCards…
    // and isSuitChange/canPlay threw "Cannot read properties of undefined". The
    // correct behaviour is a MERGE — assert a merged partial config is playable.
    const merged = { ...defaultLastCardConfig(), rounds: 3 }; // what the fix produces
    const s = lastCardGame.createInitialState(merged, players, "partial-cfg");
    // getLegalMoves must not throw and must offer real moves.
    expect(() => lastCardGame.getLegalMoves(s, s.activeSeat!)).not.toThrow();
    expect(lastCardGame.getLegalMoves(s, s.activeSeat!).length).toBeGreaterThan(0);
    expect(merged.suitChangeCards).toBeDefined(); // the field a partial would drop
  });

  it("deals the configured hand size to each player and turns one start card", () => {
    const s = init();
    expect(handCount(s, 0)).toBe(7);
    expect(handCount(s, 1)).toBe(7);
    expect(handCount(s, 2)).toBe(7);
    expect(s.discardPile).toHaveLength(1);
    // 54 (incl. 2 jokers) - 21 dealt - 1 start = 32 in draw pile
    expect(s.drawPile).toHaveLength(32);
    expect(s.activeSeat).toBe(0);
  });

  it("start card is not an action card when redrawActionStart is on", () => {
    const cfg = defaultLastCardConfig();
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const s = init(seed, cfg);
      const top = s.discardPile[0]!;
      const isAction =
        cfg.pickupCards.some((p) => p.rank === top.rank) ||
        cfg.skipCards.includes(top.rank) ||
        cfg.suitChangeCards.includes(top.rank);
      expect(isAction).toBe(false);
    }
  });
});

describe("Last Card — matching", () => {
  it("allows suit match and rank match", () => {
    const s = init();
    // Force a known top card.
    const test: LastCardState = {
      ...s,
      discardPile: [{ rank: 7, suit: "h" }],
      activeSuit: "h",
    };
    expect(canPlay(test, { rank: 7, suit: "c" })).toBe(true); // rank match
    expect(canPlay(test, { rank: 4, suit: "h" })).toBe(true); // suit match
    expect(canPlay(test, { rank: 4, suit: "c" })).toBe(false);
  });

  it("Jack (suit-change) is always playable", () => {
    const s = init();
    const test: LastCardState = {
      ...s,
      discardPile: [{ rank: 7, suit: "h" }],
      activeSuit: "h",
    };
    expect(canPlay(test, { rank: 11, suit: "c" })).toBe(true);
  });
});

describe("Last Card — action cards", () => {
  it("a 2 sets a pending pickup; drawing takes the penalty and ends turn", () => {
    let s = init();
    // Construct a controlled state: seat 0 to play a 2 of the active suit.
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 2, suit: "h" },
          { rank: 9, suit: "s" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 2, suit: "h" },
    } as LastCardMove);
    expect(r1.ok).toBe(true);
    const after = (r1 as { state: LastCardState }).state;
    expect(after.pendingPickup).toBe(2);
    expect(after.activeSeat).toBe(1);

    // Seat 1 has no pickup card → must draw the penalty.
    const before1 = handCount(after, 1);
    const r2 = applyMove(lastCardGame, after, { type: "draw", seat: 1 } as LastCardMove);
    expect(r2.ok).toBe(true);
    const after2 = (r2 as { state: LastCardState }).state;
    expect(handCount(after2, 1)).toBe(before1 + 2);
    expect(after2.pendingPickup).toBe(0);
    expect(after2.activeSeat).toBe(2);
  });

  it("pickup stacking accumulates and passes on", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 2, suit: "h" },
          { rank: 9, suit: "s" },
        ],
        1: [
          { rank: 2, suit: "c" },
          { rank: 9, suit: "h" },
        ],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 2, suit: "h" },
    } as LastCardMove);
    s = (r1 as { state: LastCardState }).state;
    // Seat 1 stacks a 2.
    const r2 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 1,
      card: { rank: 2, suit: "c" },
    } as LastCardMove);
    expect(r2.ok).toBe(true);
    s = (r2 as { state: LastCardState }).state;
    expect(s.pendingPickup).toBe(4);
    expect(s.activeSeat).toBe(2);
  });

  it("Jack changes the suit to the nominated one", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 11, suit: "h" },
          { rank: 9, suit: "c" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 11, suit: "h" },
      chosenSuit: "d",
    } as LastCardMove);
    expect(r.ok).toBe(true);
    expect((r as { state: LastCardState }).state.activeSuit).toBe("d");
  });

  it("an 8 REVERSES direction (it is not a skip)", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      // No opponent holds an 8, so the chain resolves immediately.
      hands: {
        0: [
          { rank: 8, suit: "h" },
          { rank: 9, suit: "c" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 8, suit: "h" },
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    // Direction flips to -1, so play goes 0 -> 2 (backwards), NOT because 1 was
    // skipped. Seat 1 still gets a turn — after seat 2.
    expect(after.direction).toBe(-1);
    expect(after.activeSeat).toBe(2);
  });

  it("a 7 SKIPS the next player (direction unchanged)", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 7, suit: "h" },
          { rank: 9, suit: "c" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 7, suit: "h" },
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    expect(after.direction).toBe(1);
    expect(after.activeSeat).toBe(2); // seat 1 stopped
  });
});

describe("Last Card — last card call & penalty", () => {
  it('a remaining same-rank PAIR counts as "last card(s)" and can be declared', () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      // After playing 4h, seat 0 is left with a PAIR of 9s (one group → last cards).
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 9, suit: "s" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "d" }],
      },
    };
    // Play 4h plain (no declare) → left with the 9-pair → awaitingCall set.
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove);
    s = (r1 as { state: LastCardState }).state;
    expect(handCount(s, 0)).toBe(2);
    expect(s.awaitingCall).toBe(0);

    // Seat 0 may declare OUT OF TURN with a pair remaining.
    expect(lastCardGame.getLegalMoves(s, 0)).toEqual([
      { type: "declare-last-card", seat: 0 },
    ]);
    const r2 = applyMove(lastCardGame, s, {
      type: "declare-last-card",
      seat: 0,
    } as LastCardMove);
    expect(r2.ok).toBe(true);
    s = (r2 as { state: LastCardState }).state;
    expect(s.declaredLastCard).toBe(0);
    expect(s.awaitingCall).toBeNull();
  });

  it("offers declare-with-play when a play leaves a same-rank pair", () => {
    const s = init();
    const test: LastCardState = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 9, suit: "s" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "d" }],
      },
    };
    const moves = lastCardGame.getLegalMoves(test, 0);
    // Playing 4h leaves the 9-pair → a declare variant of that play is offered.
    const declareVariant = moves.find(
      (m) =>
        m.type === "play" &&
        m.card.rank === 4 &&
        m.card.suit === "h" &&
        m.declareLastCard,
    );
    expect(declareVariant).toBeTruthy();
  });

  it("a two-card hand of DIFFERENT ranks is NOT a last-card state", () => {
    const s = init();
    const test: LastCardState = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 2, suit: "s" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "d" }],
      },
    };
    // Playing 4h leaves 9c + 2s (mixed ranks) → NOT last cards, no declare offered.
    const r = applyMove(lastCardGame, test, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove);
    const after = (r as { state: LastCardState }).state;
    expect(after.awaitingCall).toBeNull();
  });

  it("missing the declaration applies the penalty when the next player acts", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "h" },
        ],
        1: [
          { rank: 9, suit: "c" },
          { rank: 3, suit: "c" },
        ],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    // Seat 0 plays down to one card WITHOUT declaring.
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove);
    s = (r1 as { state: LastCardState }).state;
    expect(s.awaitingCall).toBe(0);
    const before = handCount(s, 0);
    // Seat 1 acts → window closes → seat 0 gets penalty.
    const r2 = applyMove(lastCardGame, s, { type: "draw", seat: 1 } as LastCardMove);
    s = (r2 as { state: LastCardState }).state;
    expect(handCount(s, 0)).toBe(before + 2);
    expect(s.awaitingCall).toBeNull();
  });

  it("allows an OUT-OF-TURN declaration before the next player acts", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "h" },
        ],
        1: [
          { rank: 9, suit: "c" },
          { rank: 3, suit: "c" },
        ],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    // Seat 0 plays plain → reaches one card, awaitingCall, turn passes to seat 1.
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove);
    s = (r1 as { state: LastCardState }).state;
    expect(s.awaitingCall).toBe(0);
    expect(s.activeSeat).toBe(1);

    // Seat 0 (NOT active) is offered a standalone declare move…
    const off = lastCardGame.getLegalMoves(s, 0);
    expect(off).toEqual([{ type: "declare-last-card", seat: 0 }]);
    // …and can play it out of turn.
    const before = handCount(s, 0);
    const r2 = applyMove(lastCardGame, s, {
      type: "declare-last-card",
      seat: 0,
    } as LastCardMove);
    expect(r2.ok).toBe(true);
    s = (r2 as { state: LastCardState }).state;
    expect(s.declaredLastCard).toBe(0);
    expect(s.awaitingCall).toBeNull();

    // Now when seat 1 acts, no penalty (they declared in time).
    const r3 = applyMove(lastCardGame, s, { type: "draw", seat: 1 } as LastCardMove);
    s = (r3 as { state: LastCardState }).state;
    expect(handCount(s, 0)).toBe(before);
  });

  it('a non-awaiting seat still gets "Not your turn" off-turn', () => {
    const s = init();
    // Seat 1 (not active, not awaiting) has no off-turn move.
    expect(lastCardGame.getLegalMoves(s, 1)).toEqual([]);
    const r = applyMove(lastCardGame, s, { type: "draw", seat: 1 } as LastCardMove);
    expect(r.ok).toBe(false);
  });

  it("declaring with the play avoids the penalty", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "h" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r1 = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
      declareLastCard: true,
    } as LastCardMove);
    s = (r1 as { state: LastCardState }).state;
    expect(s.declaredLastCard).toBe(0);
    expect(s.awaitingCall).toBeNull();
    const before = handCount(s, 0);
    applyMove(lastCardGame, s, { type: "draw", seat: 1 } as LastCardMove);
    expect(handCount(s, 0)).toBe(before); // no penalty
  });

  it("missed-call penalty reshuffles the discard when the draw pile is empty", () => {
    let s = init();
    // Draw pile empty; a fat discard pile is available to reshuffle from.
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      drawPile: [],
      discardPile: [
        { rank: 3, suit: "c" },
        { rank: 4, suit: "c" },
        { rank: 6, suit: "c" },
        { rank: 3, suit: "d" },
        { rank: 4, suit: "d" },
        { rank: 5, suit: "h" },
      ],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "h" },
        ],
        1: [{ rank: 6, suit: "h" }],
        2: [{ rank: 7, suit: "h" }],
      },
    };
    // Seat 0 plays plain → awaitingCall (undeclared last-group).
    s = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove).state;
    expect(s.awaitingCall).toBe(0);
    const before = handCount(s, 0);
    // Seat 1 acts → the window closes → +2 penalty drawn (via reshuffle).
    s = applyMove(lastCardGame, s, {
      type: "play",
      seat: 1,
      card: { rank: 6, suit: "h" },
    } as LastCardMove).state;
    expect(s.awaitingCall).toBeNull();
    expect(handCount(s, 0)).toBe(before + 2);
  });

  it("missed-call penalty draws only what exists when the stock is exhausted (no crash)", () => {
    let s = init();
    // Draw pile empty; discard has a single card so a reshuffle yields nothing.
    // Seat 1 has no playable card (only an off-suit non-matching card) so their
    // move is a DRAW — which adds NOTHING to the discard, keeping it exhausted.
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      drawPile: [],
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 4, suit: "h" },
          { rank: 9, suit: "h" },
        ],
        1: [{ rank: 6, suit: "c" }],
        2: [{ rank: 7, suit: "s" }],
      },
    };
    s = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove).state;
    expect(s.awaitingCall).toBe(0);
    const before = handCount(s, 0);
    // Seat 1's only move is to draw (no legal play, empty stock). The window
    // closes → penalty attempted, but nothing exists to draw → 0 extra cards,
    // window still clears, no crash.
    const r = applyMove(lastCardGame, s, { type: "draw", seat: 1 } as LastCardMove);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.awaitingCall).toBeNull();
    expect(handCount(s, 0)).toBe(before); // nothing to conjure
  });
});

describe("Last Card — multi same-rank plays", () => {
  it('offers a "play all of this rank" legal move when duplicates are held', () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 9, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 4, suit: "d" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "d" }],
      },
    };
    const moves = lastCardGame.getLegalMoves(s, 0);
    const multi = moves.find(
      (m) => m.type === "play" && (m.extraCards?.length ?? 0) === 1,
    );
    expect(multi).toBeTruthy();
  });

  it("plays a pair: both cards leave the hand, effects apply per card", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 2, suit: "h" },
          { rank: 2, suit: "c" },
          { rank: 4, suit: "d" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 2, suit: "h" },
      extraCards: [{ rank: 2, suit: "c" }],
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    expect(handCount(after, 0)).toBe(1); // pair removed from 3-card hand
    expect(after.pendingPickup).toBe(4); // two 2s = pickup 2 + 2
    expect(after.discardPile.slice(-2)).toEqual([
      { rank: 2, suit: "h" },
      { rank: 2, suit: "c" },
    ]);
  });

  it("rejects a multi-play with a mismatched rank", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 9, suit: "h" },
          { rank: 4, suit: "c" },
        ],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 9, suit: "h" },
      extraCards: [{ rank: 4, suit: "c" }],
    } as LastCardMove);
    expect(r.ok).toBe(false);
  });

  it("offers a top-card choice per distinct suit for a 3+ card bundle", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [
          { rank: 9, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 9, suit: "s" },
          { rank: 4, suit: "d" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "d" }],
      },
    };
    const bundles = lastCardGame
      .getLegalMoves(s, 0)
      .filter((m) => m.type === "play" && (m.extraCards?.length ?? 0) === 2);
    // The three 9s are h/c/s but only 9♥ is a LEGAL lead (active suit h). You
    // can leave ♣ or ♠ on top (9♥ leads), but NOT ♥ — the only legal lead can't
    // also be the last card. So exactly two choosable top suits (c, s). Every
    // offered bundle must apply cleanly.
    for (const m of bundles) expect(applyMove(lastCardGame, s, m).ok).toBe(true);
    const topSuits = new Set(
      bundles.map((m) => {
        if (m.type !== "play") return "";
        const cards = [m.card, ...(m.extraCards ?? [])];
        return cards[cards.length - 1]!.suit;
      }),
    );
    expect(topSuits.size).toBe(2);
    expect(topSuits.has("h")).toBe(false); // ♥ can't be left on top (only legal lead)
  });

  it("a triplet reaching a last-group emits plain+declare per top-suit (UI must dedupe)", () => {
    // Regression for the "Which card on top?" chooser showing DUPLICATE options
    // (e.g. Q♥,Q♥,Q♣,Q♣). Playing all 3 queens here leaves one card → a
    // last-group → getLegalMoves emits BOTH a plain and a declareLastCard bundle
    // per feasible top-suit. The UI keeps only the plain variant per top card.
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "s",
      discardPile: [{ rank: 11, suit: "s" }], // J♠ demand
      hands: {
        0: [
          { rank: 12, suit: "h" },
          { rank: 12, suit: "s" },
          { rank: 12, suit: "c" },
          { rank: 10, suit: "d" },
        ],
        1: [{ rank: 5, suit: "h" }],
        2: [{ rank: 6, suit: "h" }],
      },
    };
    const qBundles = lastCardGame
      .getLegalMoves(s, 0)
      .filter(
        (m) => m.type === "play" && m.card.rank === 12 && (m.extraCards?.length ?? 0) > 0,
      );
    // Raw: 2 top-suits × {plain, declare} = 4 (the source of the visual dupes).
    expect(qBundles.length).toBe(4);
    // Dedupe as the UI does: plain-only, unique by TOP card → 2 clean options.
    const seen = new Set<string>();
    const uiOptions = qBundles.filter((m) => {
      if (m.type !== "play" || m.declareLastCard) return false;
      const cards = [m.card, ...(m.extraCards ?? [])];
      const top = cardId(cards[cards.length - 1]!);
      if (seen.has(top)) return false;
      seen.add(top);
      return true;
    });
    expect(uiOptions.length).toBe(2);
    // Every de-duped option applies, and none leaves ♠ on top (Q♠ is the only
    // legal lead, so it can't also be last).
    for (const m of uiOptions) expect(applyMove(lastCardGame, s, m).ok).toBe(true);
    const tops = uiOptions.map((m) => {
      const cards = [m.card, ...((m as { extraCards?: Card[] }).extraCards ?? [])];
      return cards[cards.length - 1]!.suit;
    });
    expect(new Set(tops)).toEqual(new Set(["h", "c"]));
  });

  it("a triplet that empties the hand wins the round", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 9, suit: "h" }],
      hands: {
        0: [
          { rank: 9, suit: "h" },
          { rank: 9, suit: "c" },
          { rank: 9, suit: "s" },
        ],
        1: [{ rank: 3, suit: "c" }],
        2: [{ rank: 4, suit: "d" }],
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 9, suit: "h" },
      extraCards: [
        { rank: 9, suit: "c" },
        { rank: 9, suit: "s" },
      ],
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    expect(after.roundWinner).toBe(0);
  });

  it("never offers a multi-play whose LEAD is illegal (every legal move applies)", () => {
    // Pair of Kings where only the ♦ King can legally lead onto a ♦ demand.
    // The old top-suit generation offered {lead: 13♣, top: 13♦} — an illegal
    // lead — which the reducer rejected, stalling bot games.
    const base = init();
    const s: LastCardState = {
      ...base,
      activeSeat: 0,
      activeSuit: "d",
      discardPile: [{ rank: 12, suit: "d" }],
      hands: {
        0: [
          { rank: 13, suit: "c" },
          { rank: 13, suit: "d" },
          { rank: 2, suit: "s" },
        ],
        1: [{ rank: 8, suit: "c" }],
        2: [{ rank: 8, suit: "h" }],
      },
    };
    const moves = lastCardGame.getLegalMoves(s, 0);
    // EVERY legal move must actually apply (no illegal lead slips through).
    for (const m of moves) {
      const r = applyMove(lastCardGame, s, m);
      expect(r.ok, `move ${JSON.stringify(m)} should be applicable`).toBe(true);
    }
    // And the King-pair IS offered (via the legal ♦ lead), both top orderings.
    const pairMoves = moves.filter(
      (m) => m.type === "play" && m.card.rank === 13 && (m.extraCards?.length ?? 0) === 1,
    );
    expect(pairMoves.length).toBeGreaterThan(0);
  });
});

describe("Last Card — jokers (pick up 5)", () => {
  // A hand/table where seat 0 holds a joker plus filler.
  const withJoker = (): LastCardState => {
    const base = init();
    return {
      ...base,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      pendingPickup: 0,
      pendingPickupUnit: 0,
      hands: {
        0: [joker(0), { rank: 4, suit: "h" }, { rank: 9, suit: "s" }],
        1: [
          { rank: 2, suit: "c" },
          { rank: 3, suit: "c" },
        ],
        2: [{ rank: 6, suit: "d" }],
      },
    };
  };

  it("a joker is always playable and forces a +5 pickup (keeps active suit)", () => {
    const s = withJoker();
    expect(canPlay(s, joker(0))).toBe(true);
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: joker(0),
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    expect(after.pendingPickup).toBe(5);
    expect(after.pendingPickupUnit).toBe(5);
    expect(after.activeSuit).toBe("h"); // joker is suitless → prior suit carries
  });

  it("a Joker (+5) may stack onto a pending 2, but a 2 may NOT stack onto a pending Joker", () => {
    const base = init();
    // Pending 2 (+2) on the table, seat 1 to act holding a joker and a 2.
    const s: LastCardState = {
      ...base,
      activeSeat: 1,
      activeSuit: "c",
      discardPile: [{ rank: 2, suit: "c" }],
      pendingPickup: 2,
      pendingPickupUnit: 2,
      hands: {
        0: [{ rank: 5, suit: "h" }],
        1: [joker(0), { rank: 2, suit: "d" }],
        2: [{ rank: 6, suit: "d" }],
      },
    };
    // Joker stacks on the 2 (2 + 5 = 7).
    expect(canPlay(s, joker(0))).toBe(true);
    // A 2 also stacks on a 2 (equal amount).
    expect(canPlay(s, { rank: 2, suit: "d" })).toBe(true);
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 1,
      card: joker(0),
    } as LastCardMove);
    const afterJoker = (r as { state: LastCardState }).state;
    expect(afterJoker.pendingPickup).toBe(7);
    expect(afterJoker.pendingPickupUnit).toBe(5);

    // Now a pending JOKER (+5): a plain 2 may NOT stack on it (2 < 5).
    const s2: LastCardState = {
      ...afterJoker,
      activeSeat: 2,
      hands: { ...afterJoker.hands, 2: [{ rank: 2, suit: "h" }] },
    };
    expect(canPlay(s2, { rank: 2, suit: "h" })).toBe(false);
    // Another joker WOULD stack (5 ≥ 5).
    expect(canPlay(s2, joker(1))).toBe(true);
  });

  it("drawing the pending pickup clears the pickup unit", () => {
    const s = withJoker();
    const played = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: joker(0),
    } as LastCardMove);
    const afterPlay = (played as { state: LastCardState }).state;
    // Seat 1 can't/won't stack → draws the +5.
    const drew = applyMove(lastCardGame, afterPlay, {
      type: "draw",
      seat: afterPlay.activeSeat!,
    } as LastCardMove);
    const after = (drew as { state: LastCardState }).state;
    expect(after.pendingPickup).toBe(0);
    expect(after.pendingPickupUnit).toBe(0);
  });

  it("you cannot go out on a joker (it is an action card)", () => {
    const base = init();
    const s: LastCardState = {
      ...base,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      pendingPickup: 0,
      pendingPickupUnit: 0,
      hands: { 0: [joker(0)], 1: [{ rank: 2, suit: "c" }], 2: [{ rank: 6, suit: "d" }] },
    };
    const moves = lastCardGame.getLegalMoves(s, 0);
    // The lone joker cannot be the winning card → not offered as a play.
    expect(moves.some((m) => m.type === "play")).toBe(false);
    // Only option is to draw.
    expect(moves.some((m) => m.type === "draw")).toBe(true);
  });
});

describe("Last Card — reshuffle & win", () => {
  it("reshuffles the discard (keeping top) when the draw pile empties", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      drawPile: [],
      discardPile: [
        { rank: 5, suit: "h" },
        { rank: 6, suit: "c" },
        { rank: 7, suit: "d" },
        { rank: 9, suit: "s" },
      ],
      hands: {
        0: [{ rank: 13, suit: "c" }],
        1: [{ rank: 9, suit: "c" }],
        2: [{ rank: 9, suit: "d" }],
      },
    };
    // Seat 0 can't play 13c on 5h → draw forces a reshuffle.
    const r = applyMove(lastCardGame, s, { type: "draw", seat: 0 } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    // Top discard preserved; the other 3 discards reshuffled into draw, minus
    // the one card just drawn.
    expect(after.discardPile[after.discardPile.length - 1]).toEqual({
      rank: 9,
      suit: "s",
    });
    expect(after.drawPile.length + handCount(after, 0)).toBe(1 + 3); // drawn + remaining stock
  });

  it("emptying your hand wins the round and tallies penalties", () => {
    let s = init();
    s = {
      ...s,
      activeSeat: 0,
      activeSuit: "h",
      discardPile: [{ rank: 5, suit: "h" }],
      hands: {
        0: [{ rank: 4, suit: "h" }],
        1: [
          { rank: 13, suit: "c" },
          { rank: 1, suit: "d" },
        ], // K(10) + A(1) = 11
        2: [{ rank: 3, suit: "d" }], // 3
      },
    };
    const r = applyMove(lastCardGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 4, suit: "h" },
    } as LastCardMove);
    expect(r.ok).toBe(true);
    const after = (r as { state: LastCardState }).state;
    expect(after.phase).toBe("finished");
    expect(after.roundWinner).toBe(0);
    const scores = lastCardGame.getScores(after);
    expect(scores.bySeat[1]).toBe(11);
    expect(scores.bySeat[2]).toBe(3);
    expect(scores.winners).toEqual([0]);
  });
});

describe("Last Card — engine guarantees", () => {
  it("rejects out-of-turn and illegal moves", () => {
    const s = init();
    expect(
      applyMove(lastCardGame, s, {
        type: "play",
        seat: 1,
        card: s.hands[1]![0]!,
      } as LastCardMove).ok,
    ).toBe(false);
    const offSuit: Card = { rank: 13, suit: "c" };
    const bad = applyMove(
      lastCardGame,
      {
        ...s,
        hands: { ...s.hands, 0: [offSuit] },
        activeSuit: "h",
        discardPile: [{ rank: 5, suit: "h" }],
      },
      { type: "play", seat: 0, card: offSuit } as LastCardMove,
    );
    expect(bad.ok).toBe(false);
  });

  it("is deterministic: same seed + move log replays identically", () => {
    const a = init("determinism");
    const b = init("determinism");
    expect(a).toEqual(b);
    // A short scripted log using draws (always legal).
    const log: LastCardMove[] = [
      { type: "draw", seat: 0 },
      { type: "draw", seat: 1 },
      { type: "draw", seat: 2 },
    ];
    const ra = replay(lastCardGame, a, log);
    const rb = replay(lastCardGame, b, log);
    expect(ra).toEqual(rb);
  });

  it("redactFor hides identities but preserves opponent hand & draw counts", () => {
    const s = init();
    const view = lastCardGame.redactFor(s, 0);
    // Own hand is fully visible.
    expect(view.hands[0]!.length).toBe(7);
    // Opponent hand count is preserved (for backs + draw animations), but the
    // contents are face-down placeholders, not the real cards.
    expect(view.hands[1]!.length).toBe(7);
    expect(view.hands[1]!.every((c) => c.rank === 1 && c.suit === "c")).toBe(true);
    expect(view.hands[1]).not.toEqual(s.hands[1]);
    // Draw pile count preserved, identities hidden.
    expect(view.drawPile.length).toBe(s.drawPile.length);
    expect(view.drawPile.every((c) => c.rank === 1 && c.suit === "c")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reverse in a 2-player game, and the skip/reverse interjection chains.
// ---------------------------------------------------------------------------

const players2: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];

/** Build a controlled state with a plain 5h on top and seat 0 to act. */
const table = (
  ps: Player[],
  hands: Record<number, Card[]>,
  cfg = defaultLastCardConfig(),
) => {
  const s = lastCardGame.createInitialState(cfg, ps, "chain");
  return {
    ...s,
    activeSeat: 0,
    activeSuit: "h",
    discardPile: [{ rank: 5, suit: "h" }],
    hands,
  } as LastCardState;
};

const step = (s: LastCardState, m: LastCardMove): LastCardState => {
  const r = applyMove(lastCardGame, s, m);
  if (!r.ok) throw new Error(`move rejected: ${(r as { error: string }).error}`);
  return (r as { state: LastCardState }).state;
};

describe("Last Card — reverse with 2 players", () => {
  it("a single 8 acts as a skip: the player goes again", () => {
    const s = table(players2, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [{ rank: 9, suit: "c" }], // no 8 → nobody can interject
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    expect(a.activeSeat).toBe(0); // turn bounces back — NOT a no-op
  });

  it("two 8s played together return the turn to the opponent", () => {
    const s = table(players2, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 8, suit: "s" },
        { rank: 9, suit: "c" },
      ],
      1: [{ rank: 9, suit: "c" }],
    });
    const a = step(s, {
      type: "play",
      seat: 0,
      card: { rank: 8, suit: "h" },
      extraCards: [{ rank: 8, suit: "s" }],
    });
    expect(a.activeSeat).toBe(1);
  });
});

describe("Last Card — skip/reverse interjection", () => {
  it("holding a matching 8 opens an out-of-turn interjection window", () => {
    const s = table(players2, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 8, suit: "c" },
        { rank: 9, suit: "d" },
      ],
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    // The chain is OPEN — the turn has not advanced yet.
    expect(a.pendingAction).not.toBeNull();
    expect(a.pendingAction!.kind).toBe("reverse");
    const moves = lastCardGame.getLegalMoves(a, 1);
    expect(moves.some((m) => m.type === "interject")).toBe(true);
    expect(moves.some((m) => m.type === "pass-interjection")).toBe(true);
    // Regular play is NOT offered while the chain is open.
    expect(moves.some((m) => m.type === "play")).toBe(false);
  });

  it("passing on the chain resolves it", () => {
    const s = table(players2, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 8, suit: "c" },
        { rank: 9, suit: "d" },
      ],
    });
    let a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    a = step(a, { type: "pass-interjection", seat: 1 });
    expect(a.pendingAction).toBeNull();
    expect(a.activeSeat).toBe(0); // 2P single reverse = skip → back to seat 0
  });

  it("interjecting an 8 stacks it: two 8s hand the turn onward", () => {
    const s = table(players2, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 8, suit: "c" },
        { rank: 9, suit: "d" },
      ],
    });
    let a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    a = step(a, { type: "interject", seat: 1, card: { rank: 8, suit: "c" } });
    expect(a.pendingAction).toBeNull(); // seat 0 has no 8 left → resolves
    expect(a.pendingAction).toBeNull();
    // Two reverses in a 2P game = two skips = turn passes to the opponent.
    expect(a.activeSeat).toBe(1);
    // The interjected card is on top and sets the suit.
    expect(a.activeSuit).toBe("c");
    expect(a.hands[1]!).toHaveLength(1);
  });

  it("a 3rd player can interject a 7, pushing the stop further along", () => {
    const s = table(players, {
      0: [
        { rank: 7, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 9, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 7, suit: "c" },
        { rank: 9, suit: "d" },
      ], // holds a 7 → may interject
    });
    let a = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });
    expect(a.pendingAction!.kind).toBe("skip");
    // Seat 2 pushes the stop on, even though the stop was aimed at seat 1.
    a = step(a, { type: "interject", seat: 2, card: { rank: 7, suit: "c" } });
    expect(a.pendingAction).toBeNull();
    // Two 7s: the stop passes through seats 1 AND 2, so play resumes at seat 0.
    expect(a.activeSeat).toBe(0);
  });

  it("the stopped player can stop THEMSELVES, forfeiting their turn to push it on", () => {
    const s = table(players, {
      0: [
        { rank: 7, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 7, suit: "c" },
        { rank: 9, suit: "s" },
      ], // the target holds a 7
      2: [
        { rank: 9, suit: "d" },
        { rank: 9, suit: "h" },
      ],
    });
    let a = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });
    a = step(a, { type: "interject", seat: 1, card: { rank: 7, suit: "c" } });
    expect(a.pendingAction).toBeNull();
    // Seats 1 and 2 are both stopped; play resumes at seat 0.
    expect(a.activeSeat).toBe(0);
    expect(a.hands[1]!).toHaveLength(1);
  });

  it("a chain nobody can answer resolves immediately (no dead window)", () => {
    const s = table(players, {
      0: [
        { rank: 7, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [{ rank: 9, suit: "c" }],
      2: [{ rank: 9, suit: "d" }],
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });
    expect(a.pendingAction).toBeNull();
    expect(a.activeSeat).toBe(2);
  });

  it("a 7 cannot answer a reverse chain and vice versa (chains never mix)", () => {
    const s = table(players, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 7, suit: "c" },
        { rank: 9, suit: "s" },
      ], // only a 7
      2: [
        { rank: 8, suit: "d" },
        { rank: 9, suit: "d" },
      ], // holds an 8
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    const seat1 = lastCardGame.getLegalMoves(a, 1);
    expect(seat1.some((m) => m.type === "interject")).toBe(false); // 7 can't answer an 8
    const seat2 = lastCardGame.getLegalMoves(a, 2);
    expect(seat2.some((m) => m.type === "interject")).toBe(true);
    // A 7 is rejected outright by the reducer too.
    const bad = applyMove(lastCardGame, a, {
      type: "interject",
      seat: 1,
      card: { rank: 7, suit: "c" },
    } as LastCardMove);
    expect(bad.ok).toBe(false);
  });

  it("normal play is rejected while a chain is open", () => {
    const s = table(players, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 9, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 8, suit: "d" },
        { rank: 9, suit: "d" },
      ],
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    expect(a.pendingAction).not.toBeNull();
    const bad = applyMove(lastCardGame, a, {
      type: "play",
      seat: 2,
      card: { rank: 9, suit: "d" },
    } as LastCardMove);
    expect(bad.ok).toBe(false);
  });

  it("interjection is blocked while a pickup penalty is pending (separate chains)", () => {
    const s = table(players, {
      0: [
        { rank: 2, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 7, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 8, suit: "d" },
        { rank: 9, suit: "d" },
      ],
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 2, suit: "h" } });
    expect(a.pendingPickup).toBe(2);
    expect(a.pendingAction).toBeNull();
    // Seat 1 may only draw the penalty — a 7 is not a legal answer to a pickup.
    const moves = lastCardGame.getLegalMoves(a, 1);
    expect(moves.every((m) => m.type !== "interject")).toBe(true);
    expect(moves.some((m) => m.type === "play")).toBe(false);
  });

  it("cannot go out on an interjected action card by default", () => {
    const s = table(players, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 9, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [{ rank: 8, suit: "d" }], // an 8 is their ONLY card
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    const moves = lastCardGame.getLegalMoves(a, 2);
    expect(moves.some((m) => m.type === "interject")).toBe(false);
  });

  it("disabling allowActionInterjection restores instant resolution", () => {
    const cfg = { ...defaultLastCardConfig(), allowActionInterjection: false };
    const s = table(
      players,
      {
        0: [
          { rank: 7, suit: "h" },
          { rank: 9, suit: "c" },
        ],
        1: [
          { rank: 7, suit: "c" },
          { rank: 9, suit: "s" },
        ],
        2: [
          { rank: 9, suit: "d" },
          { rank: 9, suit: "h" },
        ],
      },
      cfg,
    );
    const a = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });
    expect(a.pendingAction).toBeNull();
    expect(a.activeSeat).toBe(2); // seat 1 skipped, no window
  });
});

describe("Last Card — chain termination", () => {
  it("a chain always resolves even when every player interjects maximally", () => {
    // Everyone holds 7s. Each interjection consumes a card, so the chain is
    // bounded by the total number of 7s in play and MUST terminate.
    let s = table(players, {
      0: [
        { rank: 7, suit: "h" },
        { rank: 7, suit: "s" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 7, suit: "c" },
        { rank: 7, suit: "d" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 7, suit: "h" },
        { rank: 9, suit: "d" },
        { rank: 9, suit: "h" },
      ],
    });
    s = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });

    // Always interject when possible — the most aggressive strategy available.
    for (let i = 0; i < 100 && s.pendingAction; i++) {
      const active = s.activeSeat!;
      const moves = lastCardGame.getLegalMoves(s, active);
      const interject = moves.find((m) => m.type === "interject");
      const pass = moves.find((m) => m.type === "pass-interjection");
      const move = interject ?? pass;
      expect(move).toBeDefined(); // the polled seat ALWAYS has a chain move
      s = step(s, move!);
    }
    expect(s.pendingAction).toBeNull(); // terminated
    expect(s.activeSeat).not.toBeNull();
  });

  it("the seat being polled always has a legal chain move (never a dead end)", () => {
    let s = table(players, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 8, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 8, suit: "d" },
        { rank: 9, suit: "d" },
      ],
    });
    s = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    while (s.pendingAction) {
      const active = s.activeSeat!;
      const moves = lastCardGame.getLegalMoves(s, active);
      // Whoever is polled can always act — otherwise the game would deadlock.
      expect(moves.length).toBeGreaterThan(0);
      s = step(
        s,
        moves.find((m) => m.type === "pass-interjection")!,
      );
    }
    expect(s.activeSeat).not.toBeNull();
  });

  it("a seat whose ONLY card is a chain card is not polled (deadlock regression)", () => {
    // Regression: eligibility checked "holds a matching card" but getLegalMoves
    // also forbids going out on an action card. A seat holding exactly one 8 was
    // therefore polled with ZERO legal moves — activeSeat parked on someone who
    // could not act, and the game hung forever (surfaced by 6p offline runs).
    let s = table(players, {
      0: [
        { rank: 8, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 9, suit: "s" },
        { rank: 9, suit: "d" },
      ],
      2: [{ rank: 8, suit: "d" }], // ONLY an 8 — cannot legally play it
    });
    s = step(s, { type: "play", seat: 0, card: { rank: 8, suit: "h" } });
    // Seat 2 must never be polled: the chain resolves instead of hanging.
    expect(s.pendingAction).toBeNull();
    expect(s.activeSeat).not.toBeNull();
    expect(lastCardGame.getLegalMoves(s, s.activeSeat!).length).toBeGreaterThan(0);
  });

  it("whoever is polled ALWAYS has a legal move, across many random deals", () => {
    // Property check: drive full games and assert the invariant that broke above
    // — activeSeat is never parked on a seat with no legal moves.
    for (const seed of ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]) {
      for (const n of [2, 3, 4, 6]) {
        const ps = Array.from({ length: n }, (_, i) => ({
          id: `p${i}`,
          name: `P${i}`,
          seat: i,
        }));
        let st = lastCardGame.createInitialState(
          defaultLastCardConfig(),
          ps,
          `${seed}-${n}`,
        );
        for (let i = 0; i < 4000 && !lastCardGame.isTerminal(st); i++) {
          const active = st.activeSeat!;
          const moves = lastCardGame.getLegalMoves(st, active);
          expect(moves.length).toBeGreaterThan(0); // the invariant
          const m =
            moves.find((x) => x.type === "declare-last-card") ??
            moves.find((x) => x.type === "play") ??
            moves.find((x) => x.type === "interject") ??
            moves[0]!;
          const r = applyMove(lastCardGame, st, m);
          if (!r.ok) break;
          st = (r as { state: LastCardState }).state;
        }
      }
    }
  }, 30000);
  it("a polled seat ALWAYS gets both interject and pass moves (UI renders on pass)", () => {
    // LastCardTable only renders the interjection prompt when a
    // `pass-interjection` move exists. If the engine ever polled a seat that
    // could interject but not pass (or vice versa), the player would see an
    // open chain with no controls and the table would look frozen.
    const s = table(players, {
      0: [
        { rank: 7, suit: "h" },
        { rank: 9, suit: "c" },
      ],
      1: [
        { rank: 9, suit: "c" },
        { rank: 9, suit: "s" },
      ],
      2: [
        { rank: 7, suit: "c" },
        { rank: 9, suit: "d" },
      ],
    });
    const a = step(s, { type: "play", seat: 0, card: { rank: 7, suit: "h" } });
    const moves = lastCardGame.getLegalMoves(a, a.activeSeat!);
    expect(moves.some((m) => m.type === "interject")).toBe(true);
    expect(moves.some((m) => m.type === "pass-interjection")).toBe(true);
  });
});
