import { describe, it, expect } from "vitest";
import {
  applyMove,
  createRng,
  nextInt,
  type BaseGameState,
  type BaseMove,
  type Difficulty,
  type GameModule,
  type Player,
} from "@card-games/engine-core";
import { baoGame } from "@card-games/game-bao";
import {
  BOARD_SIZE,
  EMPTY,
  KING_0,
  KING_1,
  MAN_0,
  MAN_1,
  checkersGame,
  positionKey,
  type CheckersState,
  type CheckersVariant,
} from "@card-games/game-checkers";
import { SEARCH_LIMITS, chooseBotMove, easyChoice, searchDecision } from "../src/index";

const PLAYERS: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1, bot: true },
];

const GAMES: [GameModule<BaseGameState, BaseMove, unknown>, string][] = [
  [baoGame as never, "bao-la-kiswahili"],
  [baoGame as never, "bao-la-kujifunza"],
  [checkersGame as never, "drafti"],
  [checkersGame as never, "english"],
  [checkersGame as never, "international"],
];

/** Reachable states: random play from the start, sampled every few plies. */
function reachable(
  game: GameModule<BaseGameState, BaseMove, unknown>,
  variant: string,
  seed: string,
  every = 7,
) {
  const out: BaseGameState[] = [];
  let s = game.createInitialState({ variant }, PLAYERS, seed);
  let rng = createRng(seed);
  for (let ply = 0; ply < 120 && !game.isTerminal(s); ply++) {
    if (ply % every === 3) out.push(s);
    const moves = game.getLegalMoves(s, s.activeSeat!);
    const r = nextInt(rng, moves.length);
    rng = r.state;
    s = (applyMove(game, s, moves[r.value]!) as { state: BaseGameState }).state;
  }
  out.push(s);
  return out;
}

const PIECES: Record<string, number> = { w: MAN_0, W: KING_0, b: MAN_1, B: KING_1 };
function checkersPosition(
  variant: CheckersVariant,
  pieces: [number, number, string][],
): CheckersState {
  const base = checkersGame.createInitialState({ variant }, PLAYERS, 1);
  const size = BOARD_SIZE[variant];
  const board = Array<number>(size * size).fill(EMPTY);
  for (const [r, c, p] of pieces) board[r * size + c] = PIECES[p]!;
  return { ...base, board, positionCounts: { [positionKey(board, 0)]: 1 } };
}
const sq = (variant: CheckersVariant, r: number, c: number) =>
  r * BOARD_SIZE[variant] + c;

describe("bot policies — legality", () => {
  for (const [game, variant] of GAMES) {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      it(`${variant} @ ${difficulty}: always returns a legal move`, () => {
        const states = reachable(
          game,
          variant,
          `legal-${variant}`,
          difficulty === "hard" ? 17 : 5,
        );
        for (const s of states) {
          const seat = s.activeSeat;
          if (seat === null) {
            expect(chooseBotMove(game, s, 0, difficulty)).toBeNull();
            continue;
          }
          const legal = game.getLegalMoves(s, seat).map((m) => JSON.stringify(m));
          const m = chooseBotMove(game, s, seat, difficulty);
          expect(m).not.toBeNull();
          expect(legal).toContain(JSON.stringify(m));
        }
      });
    }
  }

  it("returns no move when the game is over or the seat has no move", () => {
    let s = baoGame.createInitialState({ variant: "bao-la-kujifunza" }, PLAYERS, 1);
    // Off-turn seat: nothing to do.
    expect(chooseBotMove(baoGame, s, 1, "hard")).toBeNull();
    for (let i = 0; i < 500 && !baoGame.isTerminal(s); i++) {
      s = (
        applyMove(baoGame, s, chooseBotMove(baoGame, s, s.activeSeat!, "easy")!) as {
          state: typeof s;
        }
      ).state;
    }
    expect(baoGame.isTerminal(s)).toBe(true);
    for (const d of ["easy", "normal", "hard"] as const) {
      expect(chooseBotMove(baoGame, s, 0, d)).toBeNull();
      expect(chooseBotMove(baoGame, s, 1, d)).toBeNull();
    }
  });
});

describe("bot policies — determinism", () => {
  for (const [game, variant] of GAMES) {
    it(`${variant}: the same decision is computed twice`, () => {
      for (const s of reachable(game, variant, `det-${variant}`, 11)) {
        if (s.activeSeat === null) continue;
        for (const d of ["easy", "normal", "hard"] as Difficulty[]) {
          const a = chooseBotMove(game, s, s.activeSeat, d);
          const b = chooseBotMove(game, structuredClone(s), s.activeSeat, d);
          expect(b).toEqual(a);
        }
      }
    });
  }

  it("replays a whole bot game identically", () => {
    const play = () => {
      let s = checkersGame.createInitialState({ variant: "drafti" }, PLAYERS, "replay");
      const log: unknown[] = [];
      for (let i = 0; i < 60 && !checkersGame.isTerminal(s); i++) {
        const m = chooseBotMove(
          checkersGame,
          s,
          s.activeSeat!,
          i % 2 ? "hard" : "normal",
        )!;
        log.push(m);
        s = (applyMove(checkersGame, s, m) as { state: typeof s }).state;
      }
      return { log, s };
    };
    expect(play()).toEqual(play());
  });

  it("easy picks uniformly with the seeded PRNG, choosing differently across positions", () => {
    const s = checkersGame.createInitialState({ variant: "drafti" }, PLAYERS, 1);
    const legal = checkersGame.getLegalMoves(s, 0);
    const picks = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const m = easyChoice({ ...s, rng: { seed } }, legal);
      picks.add(JSON.stringify(m));
    }
    expect(picks.size).toBeGreaterThan(1);
    expect(easyChoice(s, legal)).toEqual(easyChoice(s, legal));
  });
});

describe("bot policies — search budgets and depth", () => {
  it("never exceeds the node budget and still returns a legal move", () => {
    for (const [game, variant] of GAMES) {
      const s = reachable(game, variant, `budget-${variant}`, 9).find(
        (x) => x.activeSeat !== null,
      )!;
      for (const budget of [1, 5, 40, 500]) {
        const r = searchDecision(s, s.activeSeat!, "hard", {
          ...SEARCH_LIMITS.hard,
          nodeBudget: budget,
        });
        expect(r.nodes).toBeLessThanOrEqual(budget);
        const legal = game.getLegalMoves(s, s.activeSeat!).map((m) => JSON.stringify(m));
        expect(legal).toContain(JSON.stringify(r.move));
      }
    }
  });

  it("keeps normal and hard within their declared budgets", () => {
    for (const [game, variant] of GAMES) {
      for (const s of reachable(game, variant, `within-${variant}`, 13)) {
        if (s.activeSeat === null) continue;
        expect(searchDecision(s, s.activeSeat, "normal").nodes).toBeLessThanOrEqual(
          SEARCH_LIMITS.normal.nodeBudget,
        );
        expect(searchDecision(s, s.activeSeat, "hard").nodes).toBeLessThanOrEqual(
          SEARCH_LIMITS.hard.nodeBudget,
        );
      }
    }
  });

  it("hard completes at least four plies and searches deeper than normal", () => {
    for (const [game, variant] of GAMES) {
      const s = reachable(game, variant, `deeper-${variant}`, 6)
        .filter(
          (x) => x.activeSeat !== null && game.getLegalMoves(x, x.activeSeat).length > 2,
        )
        .at(0);
      if (!s) continue;
      const normal = searchDecision(s, s.activeSeat!, "normal");
      const hard = searchDecision(s, s.activeSeat!, "hard");
      if (Math.abs(hard.score) > 500_000) continue; // a forced result ends the search early
      expect(normal.completedDepth).toBeLessThanOrEqual(2);
      expect(hard.completedDepth).toBeGreaterThanOrEqual(4);
      expect(hard.completedDepth).toBeGreaterThan(normal.completedDepth);
    }
  });
});

describe("bot policies — tactics", () => {
  it("normal takes the free capture and avoids the one that is recaptured", () => {
    const s = checkersPosition("drafti", [
      [5, 2, "w"],
      [6, 5, "w"],
      [6, 1, "w"],
      [4, 3, "b"],
      [2, 5, "b"],
      [1, 6, "b"],
      [5, 6, "b"],
    ]);
    const legal = checkersGame.getLegalMoves(s, 0);
    expect(legal.every((m) => m.captures.length > 0)).toBe(true);
    expect(legal.length).toBe(2);
    const m = chooseBotMove(checkersGame, s, 0, "normal")!;
    expect(m.from).toBe(sq("drafti", 6, 5));
  });

  it("hard finds a sacrifice that wins two plies deeper than normal looks", () => {
    // White gives up a man; Black must take it and lands where White's next
    // man double-jumps both Black men.
    const s = checkersPosition("english", [
      [4, 5, "w"],
      [4, 3, "w"],
      [5, 6, "w"],
      [6, 7, "w"],
      [2, 3, "b"],
      [2, 5, "b"],
    ]);
    const sacrifice = (m: { from: number; path: number[] } | null) =>
      m?.from === sq("english", 4, 5) && m.path[0] === sq("english", 3, 4);
    expect(sacrifice(chooseBotMove(checkersGame, s, 0, "hard"))).toBe(true);
    expect(sacrifice(chooseBotMove(checkersGame, s, 0, "normal"))).toBe(false);
  });

  it("Bao normal takes a capture that wins seeds", () => {
    const base = baoGame.createInitialState({ variant: "bao-la-kujifunza" }, PLAYERS, 1);
    const own = Array(16).fill(0);
    const opp = Array(16).fill(0);
    own.splice(0, 8, 0, 0, 2, 0, 1, 0, 0, 0);
    own[9] = 2;
    opp.splice(0, 8, 2, 0, 0, 5, 0, 0, 0, 1);
    opp[8] = 3;
    const s = { ...base, pits: { 0: own, 1: opp } };
    const m = chooseBotMove(baoGame, s, 0, "normal")!;
    expect(m.kind).toBe("capture");
    expect(m.captures.reduce((n, c) => n + c.seeds, 0)).toBeGreaterThan(0);
  });
});
