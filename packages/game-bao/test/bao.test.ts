import { describe, it, expect } from "vitest";
import {
  applyMove,
  createRng,
  nextInt,
  replay,
  resolveSetup,
  type Player,
} from "@games/engine-core";
import {
  INFINITE_CUTOFF,
  KICHWA,
  KIMBI,
  NYUMBA,
  TOTAL_SEEDS,
  baoGame,
  cellPit,
  opposite,
  pitCell,
  seedsOf,
  simulate,
  type BaoMove,
  type BaoState,
  type BaoVariant,
} from "../src/index";

const PLAYERS: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];

const create = (variant: BaoVariant = "bao-la-kiswahili", seed: string | number = 1) =>
  baoGame.createInitialState({ variant }, PLAYERS, seed);

/** Pad a front-row spec (and optional back row) into a 16-pit ring. */
const ring = (front: number[], back: number[] = []): number[] => {
  const pits = Array<number>(16).fill(0);
  front.forEach((n, i) => (pits[i] = n));
  back.forEach((n, i) => (pits[8 + i] = n));
  return pits;
};

/** A crafted position for seat 0 to move. */
function position(opts: {
  own: number[];
  opp: number[];
  reserves?: [number, number];
  nyumba?: [boolean, boolean];
  active?: 0 | 1;
}): BaoState {
  const reserves = opts.reserves ?? [0, 0];
  const base = create(
    reserves[0] || reserves[1] ? "bao-la-kiswahili" : "bao-la-kujifunza",
  );
  return {
    ...base,
    phase: reserves[0] || reserves[1] ? "kunamua" : "mtaji",
    pits: { 0: opts.own, 1: opts.opp },
    reserves: { 0: reserves[0], 1: reserves[1] },
    nyumba: { 0: opts.nyumba?.[0] ?? false, 1: opts.nyumba?.[1] ?? false },
    activeSeat: opts.active ?? 0,
  };
}

const moves = (s: BaoState, seat = s.activeSeat ?? 0) => baoGame.getLegalMoves(s, seat);
const play = (s: BaoState, m: BaoMove) => {
  const r = applyMove(baoGame, s, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const front = (s: BaoState, seat: number) => s.pits[seat]!.slice(0, 8);
const find = (s: BaoState, pred: (m: BaoMove) => boolean) => {
  const m = moves(s).find(pred);
  if (!m) throw new Error("expected move not found");
  return m;
};

// ---- 2.1 board and setup ----------------------------------------------------

describe("Bao — board, seating and setup", () => {
  it("is a 4×8 board where each player owns 16 pits in a front and back row", () => {
    const cells = new Set<string>();
    for (const seat of [0, 1]) {
      const rows = new Set<number>();
      for (let r = 0; r < 16; r++) {
        const { row, col } = pitCell(seat, r);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(4);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(8);
        cells.add(`${row}:${col}`);
        rows.add(row);
        expect(cellPit(row, col)).toEqual({ seat, ring: r });
      }
      expect(rows.size).toBe(2);
    }
    expect(cells.size).toBe(32);
    const s = create();
    expect(s.pits[0]).toHaveLength(16);
    expect(s.pits[1]).toHaveLength(16);
  });

  it("places the nyumba fifth from each player's left, and pairs opposite front pits", () => {
    expect(NYUMBA).toBe(4);
    expect(KICHWA).toEqual([0, 7]);
    expect(KIMBI).toEqual([1, 6]);
    // Seat 0's left is column 0; seat 1 faces the other way, so its left is column 7.
    expect(pitCell(0, NYUMBA).col).toBe(4);
    expect(pitCell(1, NYUMBA).col).toBe(3);
    for (let i = 0; i < 8; i++) {
      const mine = pitCell(0, i);
      const theirs = pitCell(1, opposite(i));
      expect(theirs.col).toBe(mine.col);
      expect(Math.abs(theirs.row - mine.row)).toBe(1);
    }
  });

  it("seeds the standard position: 6 in the nyumba, 2+2 to its right, 22 in reserve", () => {
    const s = create();
    for (const seat of [0, 1]) {
      expect(front(s, seat)).toEqual([0, 0, 0, 0, 6, 2, 2, 0]);
      expect(s.pits[seat]!.slice(8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(s.reserves[seat]).toBe(22);
      expect(s.nyumba[seat]).toBe(true);
    }
    expect(s.activeSeat).toBe(0);
    expect(s.phase).toBe("kunamua");
  });

  it("conserves exactly 64 seeds", () => {
    const s = create();
    expect(seedsOf(s, 0) + seedsOf(s, 1)).toBe(TOTAL_SEEDS);
  });
});

// ---- 2.2 sowing, relay, captures --------------------------------------------

describe("Bao — sowing, relay and captures", () => {
  it("ends the turn when the last seed lands in an empty pit", () => {
    const s = position({ own: ring([0, 0, 0, 2]), opp: ring([2]) });
    const m = find(s, (x) => x.start === 3 && x.direction === 1);
    expect(m.kind).toBe("kutakata");
    expect(m.path).toEqual([{ source: "pit", from: 3, pits: [4, 5] }]);
    const next = play(s, m);
    expect(front(next, 0)).toEqual([0, 0, 0, 0, 1, 1, 0, 0]);
    expect(next.activeSeat).toBe(1);
  });

  it("relays from an occupied pit in the same direction", () => {
    const s = position({ own: ring([0, 0, 2, 0, 1]), opp: ring([2]) });
    const m = find(s, (x) => x.start === 2 && x.direction === 1);
    expect(m.path).toEqual([
      { source: "pit", from: 2, pits: [3, 4] },
      { source: "pit", from: 4, pits: [5, 6] },
    ]);
    expect(front(play(s, m), 0)).toEqual([0, 0, 0, 1, 0, 1, 1, 0]);
  });

  it("only ever sows into the sowing player's own pits", () => {
    const s = position({ own: ring([0, 0, 2, 0, 1]), opp: ring([2], [3]) });
    for (const m of moves(s)) {
      const next = play(s, m);
      expect(next.pits[1]![8]).toBe(3); // the opponent's back row is untouched
    }
  });

  it("captures the opposite pit and sows the seeds from a kichwa", () => {
    const s = position({
      own: ring([0, 0, 2, 0, 1]),
      opp: ring([0, 0, 0, 3, 0, 0, 0, 2]),
    });
    const all = moves(s);
    expect(all).toHaveLength(1);
    const m = all[0]!;
    expect(m.kind).toBe("capture");
    expect(m.captures).toEqual([{ by: 4, pit: 3, seeds: 3 }]);
    // Direction was clockwise, so the seeds enter at the left kichwa.
    expect(m.path[1]).toEqual({ source: "capture", from: 0, pits: [0, 1, 2] });
    const next = play(s, m);
    expect(front(next, 0)).toEqual([1, 1, 1, 1, 2, 0, 0, 0]);
    expect(next.pits[1]![3]).toBe(0);
  });

  it("makes capture compulsory: no non-capturing move is offered", () => {
    const s = position({
      own: ring([0, 0, 2, 0, 1, 2]),
      opp: ring([0, 0, 0, 3, 0, 0, 0, 2]),
    });
    const all = moves(s);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => m.kind === "capture")).toBe(true);
    const kutakata: BaoMove = { ...all[0]!, kind: "kutakata", captures: [] };
    expect(applyMove(baoGame, s, kutakata).ok).toBe(false);
  });

  it("sows a kimbi capture from the kichwa on that same side", () => {
    const s = position({
      own: ring([0, 0, 0, 0, 2, 0, 1]),
      opp: ring([0, 2, 0, 0, 0, 0, 0, 1]),
    });
    const all = moves(s);
    expect(all).toHaveLength(1);
    const m = all[0]!;
    expect(m.captures).toEqual([{ by: 6, pit: 1, seeds: 2 }]);
    // The turn was clockwise, but a kimbi capture enters at its own (right) kichwa.
    expect(m.path[1]).toEqual({ source: "capture", from: 7, pits: [7, 6] });
    expect(m.path[2]).toEqual({ source: "pit", from: 6, pits: [5, 4, 3] });
    expect(front(play(s, m), 0)).toEqual([0, 0, 0, 1, 1, 2, 0, 1]);
  });

  it("offers both kichwa when the first capture of a turn has no direction", () => {
    const s = position({
      own: ring([0, 0, 0, 1]),
      opp: ring([0, 0, 0, 0, 2, 0, 0, 1]),
      reserves: [5, 5],
    });
    const all = moves(s);
    expect(all.map((m) => m.entry).sort()).toEqual([0, 7]);
    expect(all.every((m) => m.fromReserve && m.kind === "capture")).toBe(true);
    const left = all.find((m) => m.entry === 0)!;
    expect(left.path[1]).toEqual({ source: "capture", from: 0, pits: [0, 1] });
    const right = all.find((m) => m.entry === 7)!;
    expect(right.path[1]).toEqual({ source: "capture", from: 7, pits: [7, 6] });
  });

  it("keeps the established direction for repeated captures", () => {
    const s = position({
      own: ring([0, 0, 1, 1]),
      opp: ring([0, 0, 0, 0, 3, 2, 0, 1]),
      reserves: [5, 5],
    });
    const m = find(s, (x) => x.start === 3 && x.entry === 0);
    expect(m.captures.map((c) => c.pit)).toEqual([4, 5]);
    const captureLegs = m.path.filter((p) => p.source === "capture");
    expect(captureLegs.map((p) => p.from)).toEqual([0, 0]);
    // Seeds are conserved through repeated captures.
    const next = play(s, m);
    expect(seedsOf(next, 0) + seedsOf(next, 1)).toBe(seedsOf(s, 0) + seedsOf(s, 1));
  });
});

// ---- 2.3 kunamua --------------------------------------------------------------

describe("Bao — kunamua (namua) turns", () => {
  it("exposes exactly 4 legal opening turns", () => {
    const s = create();
    const all = moves(s);
    expect(all).toHaveLength(4);
    expect(all.every((m) => m.fromReserve && m.kind === "kutakata")).toBe(true);
    // The working nyumba (6 seeds) cannot start a kutakata turn.
    expect(new Set(all.map((m) => m.start))).toEqual(new Set([5, 6]));
  });

  it("starts every turn by placing exactly one reserve seed into a nonempty front pit", () => {
    const s = create();
    for (const m of moves(s)) {
      expect(m.path[0]).toEqual({ source: "reserve", from: m.start, pits: [m.start] });
      expect(s.pits[0]![m.start]).toBeGreaterThan(0);
      expect(play(s, m).reserves[0]).toBe(21);
    }
  });

  it("forces a capturing placement when one exists", () => {
    const s = position({
      own: ring([0, 0, 2, 1, 0, 2]),
      opp: ring([0, 0, 0, 0, 2]),
      reserves: [5, 5],
    });
    const all = moves(s);
    expect(all.every((m) => m.kind === "capture" && m.start === 3)).toBe(true);
    expect(all.length).toBe(2); // both kichwa entries
  });

  it("chooses kutakata starts only from occupied front pits that are not a working nyumba", () => {
    const s = position({
      own: ring([1, 0, 0, 0, 6, 0, 2], [3]),
      opp: ring([0, 0, 2]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    const starts = new Set(moves(s).map((m) => m.start));
    expect(starts).toEqual(new Set([0, 6]));
  });

  it("has no legal move — and loses — when only a working nyumba is occupied", () => {
    const stuck = position({
      own: ring([0, 0, 0, 0, 6]),
      opp: ring([2]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    expect(moves(stuck)).toEqual([]);

    // Reach it through play: seat 1 sows away, leaving seat 0 with no move.
    const before = { ...stuck, activeSeat: 1 as const };
    const m = find(before, (x) => x.start === 0 && x.direction === -1);
    const after = play(before, m);
    expect(after.phase).toBe("finished");
    expect(after.winner).toBe(1);
    expect(after.endReason).toBe("no-legal-move");
  });

  it("switches to mtaji once the last reserve seed has been played", () => {
    let reached = 0;
    for (let g = 0; g < 30; g++) {
      let s = create("bao-la-kiswahili", `namua-${g}`);
      let rng = createRng(`namua-pick-${g}`);
      while (s.phase === "kunamua") {
        // Both reserves are still in play right up to seat 1's last placement.
        expect(s.reserves[0]! + s.reserves[1]!).toBeGreaterThan(0);
        const all = moves(s);
        const r = nextInt(rng, all.length);
        rng = r.state;
        s = play(s, all[r.value]!);
      }
      if (s.phase === "mtaji") {
        reached++;
        expect(s.reserves).toEqual({ 0: 0, 1: 0 });
        expect(s.turn).toBe(44);
        expect(moves(s).every((m) => !m.fromReserve)).toBe(true);
      }
    }
    expect(reached).toBeGreaterThan(0);
  });
});

// ---- 2.4 nyumba ----------------------------------------------------------------

describe("Bao — nyumba rules", () => {
  it("stops a kutakata relay in a working nyumba", () => {
    const s = position({
      own: ring([0, 0, 1, 0, 6]),
      opp: ring([2]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    const m = find(s, (x) => x.start === 2 && x.direction === 1);
    expect(m.path.at(-1)).toEqual({ source: "pit", from: 2, pits: [3, 4] });
    const next = play(s, m);
    expect(front(next, 0)).toEqual([0, 0, 0, 1, 7, 0, 0, 0]);
    expect(next.nyumba[0]).toBe(true);
  });

  it("offers stop and safari when a capturing turn ends in a working nyumba", () => {
    const s = position({
      own: ring([0, 0, 1, 0, 6]),
      opp: ring([0, 0, 0, 0, 0, 5, 0, 1]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    const viaLeft = moves(s).filter((m) => m.start === 2 && m.entry === 0);
    expect(viaLeft.map((m) => m.safari).sort()).toEqual([false, true]);

    const stop = viaLeft.find((m) => m.safari === false)!;
    const afterStop = play(s, stop);
    expect(afterStop.pits[0]![NYUMBA]).toBe(7);
    expect(afterStop.nyumba[0]).toBe(true);

    const safari = viaLeft.find((m) => m.safari === true)!;
    expect(safari.path.at(-1)).toEqual({
      source: "pit",
      from: NYUMBA,
      pits: [5, 6, 7, 8, 9, 10, 11],
    });
    const afterSafari = play(s, safari);
    expect(afterSafari.pits[0]![NYUMBA]).toBe(0);
    expect(afterSafari.nyumba[0]).toBe(false);
  });

  it("lets a capture from the nyumba take precedence over stop or safari", () => {
    const s = position({
      own: ring([0, 0, 1, 0, 6]),
      opp: ring([0, 0, 0, 1, 0, 5, 0, 1]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    const viaLeft = moves(s).filter((m) => m.start === 2 && m.entry === 0);
    expect(viaLeft).toHaveLength(1);
    expect(viaLeft[0]!.safari).toBeNull();
    // The nyumba captures, and the chain carries on to the left kichwa.
    expect(viaLeft[0]!.captures.map((c) => c.by)).toEqual([2, 4, 0]);
  });

  it("loses house status permanently when the nyumba's contents are captured", () => {
    const s = position({
      own: ring([0, 0, 0, 1]),
      opp: ring([0, 0, 0, 0, 6, 0, 0, 1]),
      reserves: [5, 5],
      nyumba: [true, true],
    });
    const next = play(s, moves(s)[0]!);
    expect(next.nyumba[1]).toBe(false);
    expect(next.pits[1]![NYUMBA]).toBe(0);
  });

  it("treats the nyumba as an ordinary pit during mtaji", () => {
    const s = position({
      own: ring([0, 0, 2, 0, 6]),
      opp: ring([2]),
      nyumba: [true, true],
    });
    // Nyumba can start a turn...
    expect(moves(s).some((m) => m.start === NYUMBA)).toBe(true);
    // ...and a relay that lands in it picks it up rather than stopping.
    const m = find(s, (x) => x.start === 2 && x.direction === 1);
    expect(m.path.map((p) => p.from)).toEqual([2, NYUMBA]);
    expect(m.safari).toBeNull();
  });
});

// ---- 2.5 mtaji -----------------------------------------------------------------

describe("Bao — mtaji turns and game end", () => {
  it("never captures from a pit of 16 or more seeds", () => {
    const s = position({ own: ring([17]), opp: ring([2, 0, 0, 0, 0, 0, 3]) });
    const all = moves(s);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => m.kind === "kutakata" && m.captures.length === 0)).toBe(true);
  });

  it("allows only capturing turns when a 2..15 pit can capture", () => {
    const s = position({
      own: ring([0, 0, 2, 0, 1, 3], [4]),
      opp: ring([0, 0, 0, 3, 0, 0, 0, 2]),
    });
    const all = moves(s);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => m.kind === "capture")).toBe(true);
  });

  it("prefers the front row for non-capturing turns", () => {
    const s = position({ own: ring([0, 0, 2], [5, 4]), opp: ring([2]) });
    const all = moves(s);
    expect(all.length).toBe(2);
    expect(all.every((m) => m.start < 8)).toBe(true);
  });

  it("uses the back row only when no front pit holds two seeds", () => {
    const s = position({ own: ring([0, 0, 1], [5, 1, 2]), opp: ring([2]) });
    expect(new Set(moves(s).map((m) => m.start))).toEqual(new Set([8, 10]));
  });

  it("sows a sole occupied kichwa toward the centre", () => {
    const s = position({ own: ring([0, 0, 0, 0, 0, 0, 0, 3], [2]), opp: ring([2]) });
    const all = moves(s);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ start: 7, direction: -1 });
  });

  it("rejects a relay that would pick up a back-row pit with the front row empty", () => {
    const s = position({ own: ring([0, 0, 0, 0, 0, 0, 0, 2], [0, 1]), opp: ring([2]) });
    const r = simulate(
      s,
      0,
      { kind: "kutakata", start: 7, direction: 1, fromReserve: false },
      { entry: null, safari: null },
    );
    expect(r.status).toBe("illegal");
  });

  it("ends the game when a turn empties the opponent's front row", () => {
    const s = position({ own: ring([0, 0, 2, 0, 1]), opp: ring([0, 0, 0, 3], [5]) });
    const next = play(s, moves(s)[0]!);
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe(0);
    expect(next.endReason).toBe("front-row-empty");
    expect(baoGame.getScores(next).winners).toEqual([0]);
  });

  it("ends the game when the next player has no legal move", () => {
    const s = position({ own: ring([0, 0, 0, 2]), opp: ring([1], [1]) });
    const next = play(s, moves(s)[0]!);
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe(0);
    expect(next.endReason).toBe("no-legal-move");
  });

  it("loses a turn that runs past the 192-seed infinite cutoff", () => {
    const s = position({
      own: [2, 3, 2, 5, 1, 5, 3, 4, 5, 3, 5, 1, 4, 4, 4, 5],
      opp: ring([1], [7]),
    });
    const m = find(s, (x) => x.infinite);
    expect(m.sown).toBeGreaterThan(INFINITE_CUTOFF);
    const next = play(s, m);
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe(1);
    expect(next.endReason).toBe("infinite-turn");
  });

  it("does not end the game for a front row emptied only during sowing", () => {
    // Seat 0's only front seeds are lifted mid-turn, but the turn refills the row.
    const s = position({ own: ring([0, 0, 0, 0, 0, 0, 2]), opp: ring([0, 2], [1]) });
    const m = find(s, (x) => x.start === 6 && x.direction === -1);
    const next = play(s, m);
    expect(next.phase).not.toBe("finished");
    expect(front(next, 0).some((n) => n > 0)).toBe(true);
  });
});

// ---- 2.6 Bao la Kujifunza ----------------------------------------------------

describe("Bao — Bao la Kujifunza", () => {
  it("starts with two seeds in every pit, no reserve, no nyumba, in mtaji", () => {
    const s = create("bao-la-kujifunza");
    for (const seat of [0, 1]) {
      expect(s.pits[seat]).toEqual(Array(16).fill(2));
      expect(s.reserves[seat]).toBe(0);
      expect(s.nyumba[seat]).toBe(false);
    }
    expect(s.phase).toBe("mtaji");
    expect(seedsOf(s, 0) + seedsOf(s, 1)).toBe(64);
  });

  it("defaults to Bao la Kiswahili and rejects unknown variants", () => {
    expect(resolveSetup(baoGame, {}).config).toEqual({ variant: "bao-la-kiswahili" });
    expect(baoGame.meta.defaultVariant).toBe("bao-la-kiswahili");
    expect(baoGame.meta.variants?.map((v) => v.id)).toEqual([
      "bao-la-kiswahili",
      "bao-la-kujifunza",
    ]);
    expect(() =>
      baoGame.createInitialState({ variant: "bao-la-malawi" as BaoVariant }, PLAYERS, 1),
    ).toThrow(/bao-la-malawi/);
  });

  for (const variant of ["bao-la-kiswahili", "bao-la-kujifunza"] as const) {
    it(`plays ${variant} games to a decided legal end, conserving seeds`, () => {
      for (let g = 0; g < 20; g++) {
        let s = create(variant, `play-${g}`);
        let rng = createRng(`pick-${variant}-${g}`);
        for (let i = 0; i < 2000 && !baoGame.isTerminal(s); i++) {
          const all = moves(s);
          expect(all.length).toBeGreaterThan(0);
          const r = nextInt(rng, all.length);
          rng = r.state;
          s = play(s, all[r.value]!);
          expect(seedsOf(s, 0) + seedsOf(s, 1)).toBe(64);
        }
        expect(baoGame.isTerminal(s)).toBe(true);
        expect(baoGame.getScores(s).winners).toHaveLength(1);
        expect(s.variant).toBe(variant);
      }
    });
  }
});

// ---- 2.7 determinism, replay, forgery ----------------------------------------

describe("Bao — deterministic, complete move generation", () => {
  function randomGame(variant: BaoVariant, seed: string, plies: number) {
    const initial = create(variant, seed);
    let s = initial;
    let rng = createRng(seed);
    const log: BaoMove[] = [];
    for (let i = 0; i < plies && !baoGame.isTerminal(s); i++) {
      const all = moves(s);
      const r = nextInt(rng, all.length);
      rng = r.state;
      log.push(all[r.value]!);
      s = play(s, all[r.value]!);
    }
    return { initial, log, final: s };
  }

  for (const variant of ["bao-la-kiswahili", "bao-la-kujifunza"] as const) {
    it(`replays ${variant} to a deeply equal state`, () => {
      const a = randomGame(variant, "replay", 40);
      const b = randomGame(variant, "replay", 40);
      expect(b.log).toEqual(a.log);
      expect(replay(baoGame, create(variant, "replay"), a.log)).toEqual(a.final);
      // Serialization keeps the variant and every later decision.
      const restored = JSON.parse(JSON.stringify(a.final)) as BaoState;
      expect(restored.variant).toBe(variant);
      expect(moves(restored)).toEqual(moves(a.final));
    });
  }

  it("rejects an illegal move and leaves the state unchanged", () => {
    const s = create();
    const legal = moves(s)[0]!;
    const snapshot = JSON.stringify(s);
    const attempts: BaoMove[] = [
      { ...legal, start: NYUMBA }, // working nyumba cannot start kutakata
      { ...legal, seat: 1 }, // not your turn
      { ...legal, path: [{ source: "pit", from: 5, pits: [6] }] }, // forged path
      { ...legal, captures: [{ by: 5, pit: 2, seeds: 9 }] }, // forged capture
    ];
    for (const m of attempts) {
      expect(applyMove(baoGame, s, m).ok).toBe(false);
      expect(baoGame.reducer(s, m).ok).toBe(false);
    }
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("enumerates every capture and nothing else when captures exist", () => {
    const s = position({
      own: ring([0, 0, 1, 1, 0, 1]),
      opp: ring([0, 0, 2, 0, 2, 2, 0, 1]),
      reserves: [5, 5],
    });
    const all = moves(s);
    // Placement captures at 2, 3 and 5; 2 and 3 are central (two entries each),
    // 5 is central too.
    expect(new Set(all.map((m) => m.start))).toEqual(new Set([2, 3, 5]));
    expect(all.every((m) => m.kind === "capture")).toBe(true);
    const keys = all.map((m) => `${m.start}:${m.entry}:${m.safari}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
