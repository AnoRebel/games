import { describe, it, expect } from "vitest";
import { applyMove, type Player } from "@games/engine-core";
import {
  albastiniGame,
  defaultAlbastiniConfig,
  pointValue,
  trickStrength,
  type AlbastiniConfig,
  type AlbastiniMove,
  type AlbastiniState,
} from "../src/index";

const players4: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
  { id: "c", name: "C", seat: 2 },
  { id: "d", name: "D", seat: 3 },
];

const init = (seed = "al", cfg?: Partial<AlbastiniConfig>) =>
  albastiniGame.createInitialState(
    { ...defaultAlbastiniConfig(), ...cfg },
    players4,
    seed,
  );

describe("Albastini — deck & ranking", () => {
  it("uses a 36-card deck with no 2/8/9/10", () => {
    const s = init("x", { enableBidding: false });
    // The trump indicator lives IN the stock (bottom, drawn last), so all cards
    // are just hands + stock — no separate out-of-play trump card.
    const all = [...Object.values(s.hands).flat(), ...s.stock];
    expect(all).toHaveLength(36);
    expect(all.some((c) => [2, 8, 9, 10].includes(c.rank))).toBe(false);
  });

  it("the 7 beats the King in trick strength", () => {
    expect(trickStrength(7)).toBeGreaterThan(trickStrength(13));
    expect(trickStrength(1)).toBeGreaterThan(trickStrength(7)); // Ace highest
  });

  it("point values total 120 across the deck", () => {
    const s = init("x", { enableBidding: false });
    const all = [...Object.values(s.hands).flat(), ...s.stock];
    const total = all.reduce((sum, c) => sum + pointValue(c.rank), 0);
    expect(total).toBe(120);
  });
});

describe("Albastini — deal & trump", () => {
  it("deals 5 cards to each of 4 players", () => {
    const s = init("x", { enableBidding: false });
    for (const p of players4) expect(s.hands[p.seat]).toHaveLength(5);
  });

  it("without bidding, trump is set from the turned stock card", () => {
    const s = init("seed-trump", { enableBidding: false });
    expect(s.phase).toBe("playing");
    expect(s.trump).not.toBeNull();
  });
});

describe("Albastini — bidding (otea)", () => {
  it("bid suits must be distinct", () => {
    const s = init("bidseed");
    expect(s.phase).toBe("bidding");
    const seat = s.activeSeat!;
    const moves = albastiniGame.getLegalMoves(s, seat);
    const bidMoves = moves.filter((m) => m.type === "bid") as Extract<
      AlbastiniMove,
      { type: "bid" }
    >[];
    if (bidMoves.length) {
      const r = applyMove(albastiniGame, s, bidMoves[0]!);
      expect(r.ok).toBe(true);
      const next = (r as { state: AlbastiniState }).state;
      const bidSuit = bidMoves[0]!.card.suit;
      if (next.phase === "bidding" && next.activeSeat !== null) {
        const nextMoves = albastiniGame.getLegalMoves(next, next.activeSeat);
        const sameSuit = nextMoves
          .filter((m) => m.type === "bid")
          .some((m) => (m as { card: { suit: string } }).card.suit === bidSuit);
        expect(sameSuit).toBe(false);
      }
    }
  });

  it("the dealer cannot bid", () => {
    const s = init("bidseed");
    // dealer is seat 0; force activeSeat to dealer and check legal moves.
    const forced: AlbastiniState = { ...s, activeSeat: 0 };
    const moves = albastiniGame.getLegalMoves(forced, 0);
    expect(moves.every((m) => m.type !== "bid")).toBe(true);
  });
});

describe("Albastini — trick play", () => {
  it("no follow-suit: any card is legal during play", () => {
    const s = init("p", { enableBidding: false });
    const seat = s.activeSeat!;
    const moves = albastiniGame.getLegalMoves(s, seat);
    expect(moves).toHaveLength(s.hands[seat]!.length);
    expect(moves.every((m) => m.type === "play")).toBe(true);
  });

  it("highest trump wins; with none, highest of led suit wins", () => {
    // Construct a controlled 2-player trick.
    const players2: Player[] = [
      { id: "a", name: "A", seat: 0 },
      { id: "b", name: "B", seat: 1 },
    ];
    let s = albastiniGame.createInitialState(
      { ...defaultAlbastiniConfig(), enableBidding: false },
      players2,
      "trickseed",
    );
    s = {
      ...s,
      phase: "playing",
      trump: "c",
      trumpCard: null,
      stock: [],
      ledSuit: null,
      currentTrick: [],
      activeSeat: 0,
      hands: {
        0: [{ rank: 13, suit: "h" }], // King of hearts (leads hearts)
        1: [{ rank: 3, suit: "c" }], // low club = trump
      },
    } as AlbastiniState;
    const r1 = applyMove(albastiniGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 13, suit: "h" },
    } as AlbastiniMove);
    s = (r1 as { state: AlbastiniState }).state;
    const r2 = applyMove(albastiniGame, s, {
      type: "play",
      seat: 1,
      card: { rank: 3, suit: "c" },
    } as AlbastiniMove);
    s = (r2 as { state: AlbastiniState }).state;
    // Seat 1's trump beats the King; seat 1 ate both cards.
    expect(s.taken[1]).toHaveLength(2);
    expect(s.taken[0]).toHaveLength(0);
  });

  it("seven beats king within the led suit when no trump played", () => {
    const players2: Player[] = [
      { id: "a", name: "A", seat: 0 },
      { id: "b", name: "B", seat: 1 },
    ];
    let s = albastiniGame.createInitialState(
      { ...defaultAlbastiniConfig(), enableBidding: false },
      players2,
      "sevenseed",
    );
    s = {
      ...s,
      phase: "playing",
      trump: "c",
      trumpCard: null,
      stock: [],
      ledSuit: null,
      currentTrick: [],
      activeSeat: 0,
      hands: {
        0: [{ rank: 13, suit: "h" }], // King hearts (led)
        1: [{ rank: 7, suit: "h" }], // Seven hearts (same suit, beats King)
      },
    } as AlbastiniState;
    let r = applyMove(albastiniGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 13, suit: "h" },
    } as AlbastiniMove);
    s = (r as { state: AlbastiniState }).state;
    r = applyMove(albastiniGame, s, {
      type: "play",
      seat: 1,
      card: { rank: 7, suit: "h" },
    } as AlbastiniMove);
    s = (r as { state: AlbastiniState }).state;
    expect(s.taken[1]).toHaveLength(2);
  });
});

describe("Albastini — scoring & victory points", () => {
  it("individual: top scorer gets 2 VP if someone ate < 10", () => {
    const players2: Player[] = [
      { id: "a", name: "A", seat: 0 },
      { id: "b", name: "B", seat: 1 },
    ];
    let s = albastiniGame.createInitialState(
      { ...defaultAlbastiniConfig(), enableBidding: false, hands: 1 },
      players2,
      "scoreseed",
    );
    // Final trick of the hand: seat 0 takes the Ace (11), seat 1 has nothing.
    s = {
      ...s,
      phase: "playing",
      trump: "c",
      trumpCard: null,
      stock: [],
      ledSuit: null,
      currentTrick: [],
      activeSeat: 0,
      taken: { 0: [], 1: [] },
      hands: {
        0: [{ rank: 1, suit: "c" }], // Ace trump
        1: [{ rank: 3, suit: "h" }],
      },
    } as AlbastiniState;
    let r = applyMove(albastiniGame, s, {
      type: "play",
      seat: 0,
      card: { rank: 1, suit: "c" },
    } as AlbastiniMove);
    s = (r as { state: AlbastiniState }).state;
    r = applyMove(albastiniGame, s, {
      type: "play",
      seat: 1,
      card: { rank: 3, suit: "h" },
    } as AlbastiniMove);
    s = (r as { state: AlbastiniState }).state;
    expect(s.phase).toBe("finished");
    const scores = albastiniGame.getScores(s);
    // Seat 0 ate 11, seat 1 ate 0 (<10) → 2 VP to seat 0.
    expect(scores.victoryBySeat![0]).toBe(2);
    expect(scores.winners).toEqual([0]);
  });

  it("a tie awards no victory points", () => {
    const s = init("tie", { enableBidding: false });
    // Fabricate a finished, tied hand.
    const finished: AlbastiniState = {
      ...s,
      phase: "finished",
      activeSeat: null,
      victoryPoints: { 0: 0, 1: 0, 2: 0, 3: 0 },
    };
    const scores = albastiniGame.getScores(finished);
    expect(scores.winners).toEqual([]);
  });
});

describe("Albastini — engine guarantees", () => {
  it("same seed deals identically; redactFor hides others", () => {
    const a = init("same", { enableBidding: false });
    const b = init("same", { enableBidding: false });
    expect(a).toEqual(b);
    const view = albastiniGame.redactFor(a, 0);
    expect(view.hands[0]!.length).toBe(5);
    // Opponent hand count preserved (backs + animations); identities hidden.
    expect(view.hands[1]!.length).toBe(5);
    expect(view.hands[1]).not.toEqual(a.hands[1]);
  });

  it("rejects out-of-turn play", () => {
    const s = init("oot", { enableBidding: false });
    const notActive = (s.activeSeat! + 1) % 4;
    const move = {
      type: "play",
      seat: notActive,
      card: s.hands[notActive]![0]!,
    } as AlbastiniMove;
    expect(applyMove(albastiniGame, s, move).ok).toBe(false);
  });
});

// Play a full hand to `finished`, always taking the first legal move.
function playHand(s0: AlbastiniState): AlbastiniState {
  let s = s0;
  for (let i = 0; i < 500 && s.phase !== "finished"; i++) {
    const moves = albastiniGame.getLegalMoves(s, s.activeSeat!);
    if (!moves.length) break;
    const r = applyMove(albastiniGame, s, moves[0]!);
    if (!r.ok) throw new Error(`move rejected: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe("Albastini — point conservation (trump card stays in play)", () => {
  // Regression: the turned trump indicator used to be dropped from play, so a
  // played-out hand's captured points summed to <120 whenever the trump was a
  // point card. It must now ALWAYS total 120.
  for (const bidding of [false, true]) {
    for (const seed of ["pc-a", "pc-b", "pc-c"]) {
      it(`4p bidding=${bidding} seed=${seed} → captured points total 120`, () => {
        const end = playHand(init(seed, { enableBidding: bidding }));
        expect(end.phase).toBe("finished");
        const captured = players4.reduce(
          (sum, p) =>
            sum + (end.taken[p.seat] ?? []).reduce((t, c) => t + pointValue(c.rank), 0),
          0,
        );
        expect(captured).toBe(120);
      });
    }
  }

  it("a successful bidder still holds exactly 5 cards after trump reveal", () => {
    // Search seeds for a hand where a bid matches the turned trump, then assert
    // the bidder did not end up with 6 cards.
    for (const seed of ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"]) {
      let s = init(seed, { enableBidding: true });
      // Drive the bidding phase to completion.
      for (let i = 0; i < 20 && s.phase === "bidding"; i++) {
        const moves = albastiniGame.getLegalMoves(s, s.activeSeat!);
        // Prefer an actual bid (to exercise the exchange) when available.
        const pick = moves.find((m) => m.type === "bid") ?? moves[0]!;
        s = applyMove(albastiniGame, s, pick).state;
      }
      // Every hand must be exactly 5 after the reveal (no free extra card).
      for (const p of players4) expect(s.hands[p.seat]!.length).toBe(5);
    }
  });
});

describe("Albastini — dealer follows the hand winner", () => {
  // The deal is deterministic per seed, so hand 1 plays identically in a 1-hand
  // and a 2-hand game (same seed, same first-legal-move policy). Run the 1-hand
  // game to read hand 1's final scores, then run the 2-hand game just past hand
  // 1 and assert its new dealer is that hand's sole winner (or unchanged on tie).
  const playToHand1End = (hands: number, seed: string) => {
    let s = init(seed, { enableBidding: false, hands });
    for (let i = 0; i < 500 && s.hand === 0 && s.phase !== "finished"; i++) {
      const moves = albastiniGame.getLegalMoves(s, s.activeSeat!);
      if (!moves.length) break;
      s = applyMove(albastiniGame, s, moves[0]!).state;
    }
    return s;
  };

  for (const seed of ["dr-a", "dr-b", "dr-c", "dr-d", "dr-e"]) {
    it(`seed=${seed}: next dealer is hand 1's winner (or unchanged on a tie)`, () => {
      const dealer0 = init(seed, { enableBidding: false, hands: 2 }).dealer;
      const oneHand = playToHand1End(1, seed); // finishes hand 1
      const pts = players4.map((p) => ({
        seat: p.seat,
        points: (oneHand.taken[p.seat] ?? []).reduce((a, c) => a + pointValue(c.rank), 0),
      }));
      const max = Math.max(...pts.map((x) => x.points));
      const top = pts.filter((x) => x.points === max).map((x) => x.seat);

      const twoHand = playToHand1End(2, seed); // now dealing hand 2
      expect(twoHand.hand).toBe(1);
      if (top.length === 1) {
        expect(twoHand.dealer).toBe(top[0]); // sole winner deals next
      } else {
        expect(twoHand.dealer).toBe(dealer0); // tie → same dealer re-deals
      }
    });
  }
});

describe("Albastini — teams-of-two scoring shares VP", () => {
  it("both members of the winning team receive the victory points", () => {
    // seats 0&2 = team 0, seats 1&3 = team 1
    const teamed = players4.map((p) => ({ ...p, team: p.seat % 2 }));
    const cfg: AlbastiniConfig = {
      ...defaultAlbastiniConfig(),
      teamMode: "teams-of-two",
      enableBidding: false,
      hands: 1,
    };
    let s = albastiniGame.createInitialState(cfg, teamed, "teamcfg");
    for (let i = 0; i < 500 && s.phase !== "finished"; i++) {
      const moves = albastiniGame.getLegalMoves(s, s.activeSeat!);
      if (!moves.length) break;
      s = applyMove(albastiniGame, s, moves[0]!).state;
    }
    expect(s.phase).toBe("finished");
    const sc = albastiniGame.getScores(s);
    if (sc.winners.length) {
      // Winners come in whole teams: if seat X won, its partner (X±2) won too.
      const winnerTeams = new Set(sc.winners.map((seat) => seat % 2));
      for (const seat of teamed.map((p) => p.seat)) {
        const won = sc.winners.includes(seat);
        expect(won).toBe(winnerTeams.has(seat % 2));
        // Every winning seat has the same nonzero VP as its teammate.
        if (won) expect(sc.victoryBySeat![seat]).toBe(sc.victoryBySeat![(seat + 2) % 4]);
      }
    }
  });
});
