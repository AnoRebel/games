import { describe, it, expect } from "vitest";
import {
  applyMove,
  createRng,
  nextInt,
  replay,
  resolveSetup,
  type Player,
} from "@card-games/engine-core";
import {
  BOARD_SIZE,
  EMPTY,
  KING_0,
  KING_1,
  MAN_0,
  MAN_1,
  applyToBoard,
  checkersGame,
  generateMoves,
  isDark,
  moveNotation,
  positionKey,
  previewMove,
  type CheckersMove,
  type CheckersState,
  type CheckersVariant,
} from "../src/index";

const PLAYERS: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];

const create = (variant: CheckersVariant = "drafti", seed: string | number = 1) =>
  checkersGame.createInitialState({ variant }, PLAYERS, seed);

const PIECES: Record<string, number> = { w: MAN_0, W: KING_0, b: MAN_1, B: KING_1 };

/**
 * A crafted position from a list of `[row, col, piece]` (w/W = seat 0 man/king,
 * b/B = seat 1 man/king). Seat 0 moves up the board.
 */
function position(
  variant: CheckersVariant,
  pieces: [number, number, string][],
  opts: Partial<CheckersState> = {},
): CheckersState {
  const base = create(variant);
  const size = BOARD_SIZE[variant];
  const board = Array<number>(size * size).fill(EMPTY);
  for (const [r, c, p] of pieces) {
    const sq = r * size + c;
    if (!isDark(size, sq)) throw new Error(`(${r},${c}) is not a dark square`);
    board[sq] = PIECES[p]!;
  }
  const active = opts.activeSeat ?? 0;
  return {
    ...base,
    board,
    positionCounts: { [positionKey(board, active)]: 1 },
    ...opts,
  };
}

const sq = (variant: CheckersVariant, r: number, c: number) =>
  r * BOARD_SIZE[variant] + c;
const moves = (s: CheckersState) => checkersGame.getLegalMoves(s, s.activeSeat ?? 0);
const from = (s: CheckersState, square: number) =>
  moves(s).filter((m) => m.from === square);
const destinations = (ms: CheckersMove[]) => new Set(ms.map((m) => m.path.at(-1)));
const play = (s: CheckersState, m: CheckersMove) => {
  const r = applyMove(checkersGame, s, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const count = (s: CheckersState, piece: number) =>
  s.board.filter((v) => v === piece).length;

// ---- 3.1 setup ---------------------------------------------------------------

describe("Checkers — variants and setup", () => {
  it.each([
    ["drafti", 8, 12, 3],
    ["english", 8, 12, 3],
    ["international", 10, 20, 4],
  ] as const)(
    "%s starts on a %i×%i board with %i men a side",
    (variant, size, men, rows) => {
      const s = create(variant);
      expect(s.size).toBe(size);
      expect(s.board).toHaveLength(size * size);
      expect(count(s, MAN_0)).toBe(men);
      expect(count(s, MAN_1)).toBe(men);
      for (let i = 0; i < s.board.length; i++) {
        const row = Math.floor(i / size);
        if (s.board[i] !== EMPTY) expect(isDark(size, i)).toBe(true);
        if (row < rows) expect(s.board[i] === EMPTY || s.board[i] === MAN_1).toBe(true);
        if (row >= size - rows)
          expect(s.board[i] === EMPTY || s.board[i] === MAN_0).toBe(true);
        // The two middle rows are empty.
        if (row === size / 2 - 1 || row === size / 2) expect(s.board[i]).toBe(EMPTY);
      }
      expect(s.activeSeat).toBe(0);
      expect(s.variant).toBe(variant);
    },
  );

  it("defaults to Drafti and rejects unknown variants", () => {
    expect(resolveSetup(checkersGame, {}).config).toEqual({ variant: "drafti" });
    expect(() =>
      checkersGame.createInitialState({ variant: "pool" as CheckersVariant }, PLAYERS, 1),
    ).toThrow(/pool/);
  });

  it("allows exactly two seats", () => {
    expect(checkersGame.meta.supportedPlayerCounts).toEqual([2]);
    expect(checkersGame.meta.minPlayers).toBe(2);
    expect(checkersGame.meta.maxPlayers).toBe(2);
    expect(() =>
      checkersGame.createInitialState(
        { variant: "drafti" },
        [...PLAYERS, { id: "c", name: "C", seat: 2 }],
        1,
      ),
    ).toThrow();
  });
});

// ---- 3.2 movement --------------------------------------------------------------

describe("Checkers — man and king movement", () => {
  for (const variant of ["drafti", "english", "international"] as const) {
    it(`${variant}: men move one square diagonally forward only`, () => {
      const s = position(variant, [
        [5, 2, "w"],
        [0, 1, "b"],
      ]);
      expect(destinations(from(s, sq(variant, 5, 2)))).toEqual(
        new Set([sq(variant, 4, 1), sq(variant, 4, 3)]),
      );
    });
  }

  it("a blocked man has no move", () => {
    const s = position("drafti", [
      [7, 0, "w"],
      [5, 2, "w"],
      [6, 1, "b"],
      [0, 1, "b"],
    ]);
    expect(from(s, sq("drafti", 7, 0))).toEqual([]);
  });

  it.each(["drafti", "international"] as const)(
    "%s kings fly along a clear diagonal up to the first occupied square",
    (variant) => {
      const size = BOARD_SIZE[variant];
      const corner = size - 1;
      const s = position(variant, [
        [corner, 0, "W"],
        [corner - 4, 4, "w"],
        [0, size - 1 - (size === 10 ? 0 : 0), "b"],
      ]);
      const dest = destinations(from(s, sq(variant, corner, 0)));
      expect(dest).toEqual(new Set([1, 2, 3].map((k) => sq(variant, corner - k, k))));
    },
  );

  it("English kings move exactly one square", () => {
    const s = position("english", [
      [4, 3, "W"],
      [0, 1, "b"],
    ]);
    expect(destinations(from(s, sq("english", 4, 3)))).toEqual(
      new Set([
        sq("english", 3, 2),
        sq("english", 3, 4),
        sq("english", 5, 2),
        sq("english", 5, 4),
      ]),
    );
  });
});

// ---- 3.3 captures --------------------------------------------------------------

describe("Checkers — captures", () => {
  it("rejects a non-capturing move when a capture exists", () => {
    const s = position("drafti", [
      [5, 2, "w"],
      [4, 3, "b"],
    ]);
    expect(moves(s).every((m) => m.captures.length > 0)).toBe(true);
    const quiet: CheckersMove = {
      type: "move",
      seat: 0,
      from: sq("drafti", 5, 2),
      path: [sq("drafti", 4, 1)],
      captures: [],
      promotes: false,
    };
    expect(applyMove(checkersGame, s, quiet).ok).toBe(false);
  });

  const twoSequences: [number, number, string][] = [
    [5, 2, "w"],
    [6, 7, "w"],
    [4, 3, "b"],
    [2, 5, "b"],
    [5, 6, "b"],
  ];

  it("Drafti offers every capture sequence, including the shorter one", () => {
    const s = position("drafti", twoSequences);
    const lengths = moves(s)
      .map((m) => m.captures.length)
      .sort();
    expect(lengths).toEqual([1, 2]);
  });

  it("International keeps only the maximum capture", () => {
    const s = position("international", twoSequences);
    const all = moves(s);
    expect(all).toHaveLength(1);
    expect(all[0]!.captures).toHaveLength(2);
    expect(all[0]!.from).toBe(sq("international", 5, 2));
  });

  it("lets a man capture a king", () => {
    const s = position("drafti", [
      [5, 2, "w"],
      [4, 3, "B"],
      [0, 1, "b"],
    ]);
    const [m] = moves(s);
    expect(m!.captures).toEqual([{ square: sq("drafti", 4, 3), king: true }]);
  });

  it("Drafti men cannot capture backward; International men can", () => {
    const pieces: [number, number, string][] = [
      [3, 4, "w"],
      [4, 5, "b"],
      [0, 1, "b"],
    ];
    expect(moves(position("drafti", pieces)).every((m) => m.captures.length === 0)).toBe(
      true,
    );
    expect(moves(position("english", pieces)).every((m) => m.captures.length === 0)).toBe(
      true,
    );
    const intl = moves(position("international", pieces));
    expect(intl).toHaveLength(1);
    expect(intl[0]!.path).toEqual([sq("international", 5, 6)]);
  });

  it.each(["drafti", "international"] as const)(
    "%s kings capture at range and may land on any empty square beyond",
    (variant) => {
      const size = BOARD_SIZE[variant];
      const corner = size - 1;
      const s = position(variant, [
        [corner, 0, "W"],
        [corner - 3, 3, "b"],
        [0, 1, "b"],
      ]);
      const ks = from(s, sq(variant, corner, 0));
      const expected = [];
      for (let k = 4; corner - k >= 0; k++) expected.push(sq(variant, corner - k, k));
      expect(destinations(ks)).toEqual(new Set(expected));
      expect(ks.every((m) => m.captures.length === 1)).toBe(true);
    },
  );

  it("continues a sequence while another capture is available", () => {
    const s = position("drafti", twoSequences);
    const long = moves(s).find((m) => m.captures.length === 2)!;
    expect(long.path).toEqual([sq("drafti", 3, 4), sq("drafti", 1, 6)]);
    expect(long.captures.map((c) => c.square)).toEqual([
      sq("drafti", 4, 3),
      sq("drafti", 2, 5),
    ]);
  });

  it("requires the whole chosen sequence", () => {
    const s = position("drafti", twoSequences);
    const partial: CheckersMove = {
      type: "move",
      seat: 0,
      from: sq("drafti", 5, 2),
      path: [sq("drafti", 3, 4)],
      captures: [{ square: sq("drafti", 4, 3), king: false }],
      promotes: false,
    };
    expect(applyMove(checkersGame, s, partial).ok).toBe(false);
  });

  it("never jumps the same piece twice", () => {
    for (const variant of ["english", "international"] as const) {
      const s = position(variant, [
        [5, 2, "W"],
        [4, 3, "b"],
        [0, 1, "b"],
      ]);
      for (const m of from(s, sq(variant, 5, 2))) expect(m.captures).toHaveLength(1);
    }
    // Property: across random play no move lists a square twice.
    for (const variant of ["drafti", "english", "international"] as const) {
      let s = create(variant, "nodouble");
      let rng = createRng(`nd-${variant}`);
      for (let i = 0; i < 300 && !checkersGame.isTerminal(s); i++) {
        const all = moves(s);
        for (const m of all) {
          const squares = m.captures.map((c) => c.square);
          expect(new Set(squares).size).toBe(squares.length);
        }
        const r = nextInt(rng, all.length);
        rng = r.state;
        s = play(s, all[r.value]!);
      }
    }
  });

  it("keeps International jumped pieces on the board until the move ends", () => {
    // A king that takes one piece cannot turn back across its square to take a
    // second; with immediate removal (Drafti) it can.
    const pieces: [number, number, string][] = [
      [2, 3, "W"],
      [1, 2, "b"],
      [4, 5, "b"],
    ];
    const drafti = moves(position("drafti", pieces));
    expect(Math.max(...drafti.map((m) => m.captures.length))).toBe(2);
    const intl = moves(position("international", pieces));
    expect(intl.length).toBeGreaterThan(0);
    expect(intl.every((m) => m.captures.length === 1)).toBe(true);
  });

  it.each([
    ["drafti", [7, 49, 302, 1469, 7361]],
    ["english", [7, 49, 302, 1469, 7361]],
    ["international", [9, 81, 658, 4265]],
  ] as const)(
    "%s perft from the start matches the reference counts",
    (variant, counts) => {
      const perft = (
        s: Pick<CheckersState, "size" | "variant" | "board">,
        seat: number,
        d: number,
      ): number => {
        const ms = generateMoves(s, seat);
        if (d === 1) return ms.length;
        let n = 0;
        for (const m of ms)
          n += perft({ ...s, board: applyToBoard(s.board, m) }, 1 - seat, d - 1);
        return n;
      };
      const s = create(variant);
      counts.forEach((expected, i) => expect(perft(s, 0, i + 1)).toBe(expected));
    },
  );
});

// ---- 3.4 promotion ---------------------------------------------------------------

describe("Checkers — promotion timing", () => {
  const crowningCapture: [number, number, string][] = [
    [2, 1, "w"],
    [1, 2, "b"],
    [1, 4, "b"],
    [6, 7, "b"],
  ];

  it.each(["drafti", "english"] as const)(
    "%s: reaching the kings row ends the capture and crowns the man",
    (variant) => {
      const s = position(variant, crowningCapture);
      const all = moves(s);
      expect(all).toHaveLength(1);
      const m = all[0]!;
      expect(m.path).toEqual([sq(variant, 0, 3)]);
      expect(m.captures).toHaveLength(1);
      expect(m.promotes).toBe(true);
      expect(play(s, m).board[sq(variant, 0, 3)]).toBe(KING_0);
    },
  );

  it("International: passing over the kings row mid-capture leaves a man", () => {
    const s = position("international", crowningCapture);
    const all = moves(s);
    expect(all).toHaveLength(1);
    const m = all[0]!;
    expect(m.path).toEqual([sq("international", 0, 3), sq("international", 2, 5)]);
    expect(m.promotes).toBe(false);
    expect(play(s, m).board[sq("international", 2, 5)]).toBe(MAN_0);
  });

  it("International: a man promotes when its move stops on the kings row", () => {
    const s = position("international", [
      [2, 1, "w"],
      [1, 2, "b"],
      [6, 7, "b"],
    ]);
    const [m] = moves(s);
    expect(m!.promotes).toBe(true);
    expect(play(s, m!).board[sq("international", 0, 3)]).toBe(KING_0);
  });

  it.each(["drafti", "english", "international"] as const)(
    "%s: a quiet move onto the kings row promotes",
    (variant) => {
      const s = position(variant, [
        [1, 2, "w"],
        [6, 7, "b"],
      ]);
      const ms = from(s, sq(variant, 1, 2));
      expect(ms.every((m) => m.promotes)).toBe(true);
      expect(play(s, ms[0]!).board[ms[0]!.path[0]!]).toBe(KING_0);
    },
  );
});

// ---- 3.5 wins and draws ------------------------------------------------------------

describe("Checkers — wins and draws", () => {
  const expectDraw = (s: CheckersState, reason: string) => {
    expect(s.phase).toBe("finished");
    expect(s.drawn).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.endReason).toBe(reason);
    const scores = checkersGame.getScores(s);
    expect(scores.winners).toEqual([]);
    expect(scores.drawn).toBe(true);
  };

  it("wins when the opponent loses their last piece", () => {
    const s = position("drafti", [
      [5, 2, "w"],
      [4, 3, "b"],
    ]);
    const next = play(s, moves(s)[0]!);
    expect(next.winner).toBe(0);
    expect(next.endReason).toBe("no-pieces");
    expect(checkersGame.getScores(next).winners).toEqual([0]);
  });

  it("loses when starting a turn with pieces but no legal move", () => {
    const s = position("drafti", [
      [2, 1, "b"],
      [3, 0, "w"],
      [3, 2, "w"],
      [4, 3, "w"],
      [1, 0, "w"],
      [1, 2, "w"],
    ]);
    const m = from(s, sq("drafti", 1, 2))[0]!;
    const next = play(s, m);
    expect(next.winner).toBe(0);
    expect(next.endReason).toBe("no-legal-move");
  });

  it("Drafti: one king each is an immediate draw", () => {
    const s = position("drafti", [
      [7, 0, "W"],
      [0, 5, "B"],
    ]);
    expectDraw(play(s, moves(s)[0]!), "kings-equal");
  });

  it("Drafti: two kings each is an immediate draw", () => {
    const s = position("drafti", [
      [7, 0, "W"],
      [7, 2, "W"],
      [0, 5, "B"],
      [0, 7, "B"],
    ]);
    expectDraw(play(s, moves(s)[0]!), "kings-equal");
  });

  it("Drafti: three kings against one must win within 12 of their own moves", () => {
    let s = position("drafti", [
      [7, 0, "W"],
      [7, 2, "W"],
      [7, 4, "W"],
      [0, 5, "B"],
    ]);
    const seen = new Set<string>();
    let whiteMoves = 0;
    while (s.phase === "playing") {
      // Shuffle without capturing or repeating, to run the clock down.
      const quiet = moves(s).filter((m) => m.captures.length === 0);
      const fresh =
        quiet.find((m) => {
          const key = positionKey(applyToBoard(s.board, m), 1 - m.seat);
          return (
            !seen.has(key) &&
            generateMoves({ ...s, board: applyToBoard(s.board, m) }, 1 - m.seat).every(
              (r) => r.captures.length === 0,
            )
          );
        }) ?? quiet[0]!;
      if (fresh.seat === 0) whiteMoves++;
      s = play(s, fresh);
      seen.add(positionKey(s.board, s.activeSeat));
      if (whiteMoves < 12) expect(s.phase).toBe("playing");
    }
    expect(whiteMoves).toBe(12);
    expectDraw(s, "king-endgame");
  });

  it("Drafti: threefold repetition is a draw", () => {
    let s = position("drafti", [
      [7, 0, "w"],
      [6, 7, "W"],
      [0, 1, "b"],
      [0, 5, "B"],
    ]);
    const cycle: [number, number, number, number][] = [
      [6, 7, 7, 6],
      [0, 5, 1, 6],
      [7, 6, 6, 7],
      [1, 6, 0, 5],
    ];
    let plies = 0;
    for (let lap = 0; lap < 2; lap++) {
      for (const [r1, c1, r2, c2] of cycle) {
        expect(s.phase).toBe("playing");
        const m = moves(s).find(
          (x) => x.from === sq("drafti", r1, c1) && x.path[0] === sq("drafti", r2, c2),
        )!;
        s = play(s, m);
        plies++;
      }
    }
    expect(plies).toBe(8);
    expectDraw(s, "repetition");
  });

  it("English: threefold repetition is a draw", () => {
    let s = position("english", [
      [7, 0, "w"],
      [6, 7, "W"],
      [0, 1, "b"],
      [0, 5, "B"],
    ]);
    const cycle = [
      [6, 7, 7, 6],
      [0, 5, 1, 6],
      [7, 6, 6, 7],
      [1, 6, 0, 5],
    ];
    for (let i = 0; i < 8; i++) {
      const [r1, c1, r2, c2] = cycle[i % 4]!;
      s = play(
        s,
        moves(s).find(
          (x) =>
            x.from === sq("english", r1!, c1!) && x.path[0] === sq("english", r2!, c2!),
        )!,
      );
    }
    expectDraw(s, "repetition");
  });

  it("English: forty moves each without a capture or man move is a draw", () => {
    const pieces: [number, number, string][] = [
      [7, 0, "w"],
      [6, 7, "W"],
      [0, 1, "b"],
      [0, 5, "B"],
    ];
    const s = position("english", pieces, { quietPlies: 79 });
    const kingMove = from(s, sq("english", 6, 7))[0]!;
    expectDraw(play(s, kingMove), "no-progress");
    // A man move resets the count.
    const manMove = from(s, sq("english", 7, 0))[0]!;
    const after = play(s, manMove);
    expect(after.phase).toBe("playing");
    expect(after.quietPlies).toBe(0);
  });

  it("International: king against king is a draw", () => {
    const s = position("international", [
      [9, 0, "W"],
      [0, 7, "B"],
    ]);
    expectDraw(play(s, moves(s)[0]!), "kings-equal");
  });

  it("International: twenty-five king-only moves each is a draw", () => {
    const s = position(
      "international",
      [
        [9, 0, "W"],
        [9, 2, "w"],
        [0, 7, "B"],
        [0, 1, "b"],
      ],
      { quietPlies: 49 },
    );
    expectDraw(play(s, from(s, sq("international", 9, 0))[0]!), "no-progress");
  });

  it.each([
    ["three kings", ["W", "W", "W"]],
    ["two kings and a man", ["W", "W", "w"]],
    ["a king and two men", ["W", "w", "w"]],
  ] as const)(
    "International: %s against a lone king must win within 16 moves each",
    (_label, strong) => {
      const pieces: [number, number, string][] = [
        [9, 0, strong[0]],
        [9, 2, strong[1]],
        [9, 4, strong[2]],
        [0, 7, "B"],
      ];
      const fresh = position("international", pieces);
      const kingMove = from(fresh, sq("international", 9, 0))[0]!;
      // Fresh countdown: one move is nowhere near the limit.
      const early = play(fresh, kingMove);
      expect(early.phase).toBe("playing");
      expect(early.endgame?.plies).toBe(1);
      // With 31 plies already played in this material situation, the 32nd ends it.
      const key = early.endgame!.key;
      const late = position("international", pieces, {
        endgame: { key, plies: 31, strongerMoves: 15 },
      });
      expectDraw(play(late, kingMove), "king-endgame");
    },
  );

  it("records a draw for both seats", () => {
    const s = position("drafti", [
      [7, 0, "W"],
      [0, 5, "B"],
    ]);
    const end = play(s, moves(s)[0]!);
    const scores = checkersGame.getScores(end);
    expect(scores.drawn).toBe(true);
    expect(scores.winners).toEqual([]);
    expect(Object.keys(scores.bySeat)).toEqual(["0", "1"]);
  });
});

// ---- 3.6 move representation ---------------------------------------------------

describe("Checkers — move representation", () => {
  it("exposes every landing and captured square of a multi-capture, in order", () => {
    const s = position("drafti", [
      [5, 2, "w"],
      [6, 7, "w"],
      [4, 3, "b"],
      [2, 5, "b"],
      [5, 6, "b"],
    ]);
    const m = moves(s).find((x) => x.captures.length === 2)!;
    // Built from the move alone — no engine calls.
    const preview = previewMove(JSON.parse(JSON.stringify(m)) as CheckersMove);
    expect(preview).toEqual({
      origin: sq("drafti", 5, 2),
      landings: [sq("drafti", 3, 4), sq("drafti", 1, 6)],
      destination: sq("drafti", 1, 6),
      captured: [sq("drafti", 4, 3), sq("drafti", 2, 5)],
      legs: [
        { from: sq("drafti", 5, 2), to: sq("drafti", 3, 4) },
        { from: sq("drafti", 3, 4), to: sq("drafti", 1, 6) },
      ],
      promotes: false,
    });
    expect(moveNotation(8, m)).toBe("22x15x8");
  });

  it("flags a promoting move", () => {
    const s = position("english", [
      [1, 2, "w"],
      [6, 7, "b"],
    ]);
    const m = from(s, sq("english", 1, 2))[0]!;
    expect(m.promotes).toBe(true);
    expect(previewMove(m).promotes).toBe(true);
    expect(moveNotation(8, m)).toMatch(/K$/);
  });

  it("numbers the standard opening moves", () => {
    const notes = moves(create("english")).map((m) => moveNotation(8, m));
    expect(notes.sort()).toEqual([
      "21-17",
      "22-17",
      "22-18",
      "23-18",
      "23-19",
      "24-19",
      "24-20",
    ]);
  });
});

// ---- 3.7 determinism -----------------------------------------------------------

describe("Checkers — determinism, replay and illegal moves", () => {
  function randomGame(variant: CheckersVariant, seed: string, plies: number) {
    let s = create(variant, seed);
    let rng = createRng(seed);
    const log: CheckersMove[] = [];
    for (let i = 0; i < plies && !checkersGame.isTerminal(s); i++) {
      const all = moves(s);
      const r = nextInt(rng, all.length);
      rng = r.state;
      log.push(all[r.value]!);
      s = play(s, all[r.value]!);
    }
    return { log, final: s };
  }

  for (const variant of ["drafti", "english", "international"] as const) {
    it(`${variant}: identical seeds and moves replay to deeply equal states`, () => {
      const a = randomGame(variant, `replay-${variant}`, 120);
      const b = randomGame(variant, `replay-${variant}`, 120);
      expect(b.log).toEqual(a.log);
      expect(replay(checkersGame, create(variant, `replay-${variant}`), a.log)).toEqual(
        a.final,
      );
    });

    it(`${variant}: the variant survives serialization and governs later moves`, () => {
      const { final } = randomGame(variant, `ser-${variant}`, 30);
      const restored = JSON.parse(JSON.stringify(final)) as CheckersState;
      expect(restored.variant).toBe(variant);
      expect(checkersGame.getLegalMoves(restored, restored.activeSeat ?? 0)).toEqual(
        checkersGame.getLegalMoves(final, final.activeSeat ?? 0),
      );
    });

    it(`${variant}: an illegal move is rejected and leaves the state unchanged`, () => {
      const s = create(variant);
      const legal = moves(s)[0]!;
      const snapshot = JSON.stringify(s);
      const attempts: CheckersMove[] = [
        { ...legal, path: [legal.from] },
        { ...legal, seat: 1 },
        { ...legal, promotes: true },
        { ...legal, captures: [{ square: legal.path[0]!, king: false }] },
      ];
      for (const m of attempts) {
        expect(applyMove(checkersGame, s, m).ok).toBe(false);
        expect(checkersGame.reducer(s, m).ok).toBe(false);
      }
      expect(JSON.stringify(s)).toBe(snapshot);
    });

    it(`${variant}: random games end in a legal win or draw`, () => {
      for (let g = 0; g < 10; g++) {
        let s = create(variant, `end-${g}`);
        let rng = createRng(`end-${variant}-${g}`);
        for (let i = 0; i < 3000 && !checkersGame.isTerminal(s); i++) {
          const all = moves(s);
          const r = nextInt(rng, all.length);
          rng = r.state;
          s = play(s, all[r.value]!);
        }
        expect(checkersGame.isTerminal(s)).toBe(true);
        const scores = checkersGame.getScores(s);
        expect(scores.winners.length === 1 || scores.drawn === true).toBe(true);
      }
    });
  }
});
