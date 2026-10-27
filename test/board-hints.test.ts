/**
 * Tap handling on the boards narrows the engine's legal moves until exactly
 * one remains — the UI never decides legality itself.
 */
import { describe, it, expect } from "vitest";
import type { Player } from "@games/engine-core";
import { baoGame, type BaoState } from "@games/game-bao";
import { checkersGame, type CheckersMove } from "@games/game-checkers";
import {
  baoCellOf,
  baoPitAt,
  baoTap,
  checkersSquare,
  checkersTap,
  nextBaoChoice,
} from "../app/utils/boardHints";

const PLAYERS: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];
const ring = (front: number[]) => [...front, ...Array(16 - front.length).fill(0)];
function bao(own: number[], opp: number[], reserves = 5): BaoState {
  const s = baoGame.createInitialState({ variant: "bao-la-kiswahili" }, PLAYERS, 1);
  return {
    ...s,
    pits: { 0: ring(own), 1: ring(opp) },
    reserves: { 0: reserves, 1: reserves },
  };
}

describe("Bao taps", () => {
  it("asks for the kichwa when a capture's entry is free, then plays", () => {
    const s = bao([0, 0, 0, 1], [0, 0, 0, 0, 2, 0, 0, 1]);
    const legal = baoGame.getLegalMoves(s, 0);
    const first = baoTap(legal, { start: null }, 3);
    expect(first).toEqual({ action: "select", selection: { start: 3 } });
    expect(nextBaoChoice(legal)).toMatchObject({ kind: "entry" });
    const second = baoTap(legal, { start: 3 }, 7);
    expect(second.action).toBe("play");
    expect(second.action === "play" && second.move.entry).toBe(7);
  });

  it("offers stop or safari when only that choice remains", () => {
    const s = {
      ...bao([0, 0, 1, 0, 6], [0, 0, 0, 0, 0, 5, 0, 1]),
      nyumba: { 0: true, 1: true },
    };
    const legal = baoGame.getLegalMoves(s, 0);
    const tap = baoTap(legal, { start: 2 }, 0);
    expect(tap).toEqual({ action: "safari", selection: { start: 2, entry: 0 } });
  });

  it("plays at once when a start has a single legal turn", () => {
    const s = bao([0, 0, 2, 0, 1], [0, 0, 0, 3, 0, 0, 0, 2], 0);
    const mtaji = { ...s, phase: "mtaji" as const };
    const legal = baoGame.getLegalMoves(mtaji, 0);
    expect(legal).toHaveLength(1);
    expect(baoTap(legal, { start: null }, 2).action).toBe("play");
  });

  it("maps display cells so the viewer's rows are at the bottom", () => {
    expect(baoPitAt(3, 0, 0)).toEqual({ seat: 0, ring: 15 });
    expect(baoPitAt(3, 0, 1)).toEqual({ seat: 1, ring: 15 });
    expect(baoCellOf(1, 4, 1)).toEqual(baoCellOf(0, 4, 0));
  });
});

describe("Checkers taps", () => {
  it("selects, then plays a unique destination; other taps clear", () => {
    const s = checkersGame.createInitialState({ variant: "english" }, PLAYERS, 1);
    const legal = checkersGame.getLegalMoves(s, 0);
    expect(checkersTap(legal, null, 42)).toEqual({ action: "select", square: 42 });
    expect(checkersTap(legal, 42, 35).action).toBe("play");
    expect(checkersTap(legal, 42, 0)).toEqual({ action: "clear" });
  });

  it("asks which path when several captures end on the same square", () => {
    const a = {
      type: "move",
      seat: 0,
      from: 1,
      path: [5, 9],
      captures: [],
      promotes: false,
    } as CheckersMove;
    const b = { ...a, path: [7, 9] };
    expect(checkersTap([a, b], 1, 9)).toEqual({ action: "choose", moves: [a, b] });
  });

  it("flips the board for seat 1", () => {
    expect(checkersSquare(8, 7, 7, true)).toBe(0);
    expect(checkersSquare(8, 7, 7, false)).toBe(63);
  });
});
