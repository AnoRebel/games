/**
 * Board hints derived from the engine's legal moves and the last move — the
 * UI never applies game rules itself. Each board reduces a tap to an action:
 * select, narrow, clear, or play a fully determined legal move.
 */
import { pitCell, cellPit, type BaoMove, type BaoState } from "@card-games/game-bao";
import { previewMove, type CheckersMove } from "@card-games/game-checkers";

// ---- Checkers ---------------------------------------------------------------

/** Board square shown at a display cell; the viewer's side is always at the bottom. */
export function checkersSquare(size: number, row: number, col: number, flipped: boolean) {
  return flipped ? (size - 1 - row) * size + (size - 1 - col) : row * size + col;
}

export interface CheckersHints {
  /** Squares holding a piece that has a legal move. */
  origins: Set<number>;
  /** Only captures are legal right now. */
  forcedCapture: boolean;
  /** Destination square → the legal moves from the selected piece ending there. */
  destinations: Map<number, CheckersMove[]>;
  /** Intermediate landing squares of the selected piece's capture paths. */
  landings: Set<number>;
  /** Squares whose pieces the selected piece's moves would capture. */
  captured: Set<number>;
  /** Destinations reached by capturing. */
  captureDestinations: Set<number>;
}

export function checkersHints(
  legal: readonly CheckersMove[],
  selected: number | null,
): CheckersHints {
  const hints: CheckersHints = {
    origins: new Set(legal.map((m) => m.from)),
    forcedCapture: legal.length > 0 && legal.every((m) => m.captures.length > 0),
    destinations: new Map(),
    landings: new Set(),
    captured: new Set(),
    captureDestinations: new Set(),
  };
  if (selected === null) return hints;
  for (const m of legal) {
    if (m.from !== selected) continue;
    const p = previewMove(m);
    hints.destinations.set(p.destination, [
      ...(hints.destinations.get(p.destination) ?? []),
      m,
    ]);
    for (const l of p.landings.slice(0, -1)) hints.landings.add(l);
    for (const c of p.captured) hints.captured.add(c);
    if (p.captured.length) hints.captureDestinations.add(p.destination);
  }
  return hints;
}

export type CheckersTap =
  | { action: "play"; move: CheckersMove }
  | { action: "choose"; moves: CheckersMove[] }
  | { action: "select"; square: number }
  | { action: "clear" };

/** What tapping `square` does given the current selection. */
export function checkersTap(
  legal: readonly CheckersMove[],
  selected: number | null,
  square: number,
): CheckersTap {
  const hints = checkersHints(legal, selected);
  const ending = hints.destinations.get(square);
  if (ending?.length === 1) return { action: "play", move: ending[0]! };
  if (ending && ending.length > 1) return { action: "choose", moves: ending };
  if (hints.origins.has(square) && square !== selected)
    return { action: "select", square };
  return { action: "clear" };
}

/** Origin and destination of the last move, for highlighting. */
export function checkersLastMove(move: CheckersMove | null) {
  if (!move) return { from: null, to: null, captured: new Set<number>() };
  const p = previewMove(move);
  return { from: p.origin, to: p.destination, captured: new Set(p.captured) };
}

// ---- Bao ----------------------------------------------------------------------

/** The physical pit shown at a display cell, with the viewer's rows at the bottom. */
export function baoPitAt(row: number, col: number, viewer: number | null) {
  const { seat, ring } = cellPit(row, col);
  return { seat: viewer === 1 ? 1 - seat : seat, ring };
}

/** The display cell of a physical pit for this viewer. */
export function baoCellOf(seat: number, ring: number, viewer: number | null) {
  return pitCell(viewer === 1 ? 1 - seat : seat, ring);
}

/** The next choice that narrows the remaining candidate turns. */
export type BaoChoice =
  | { kind: "done"; move: BaoMove }
  | { kind: "direction"; options: { value: 1 | -1; pit: number }[] }
  | { kind: "entry"; options: { value: 0 | 7; pit: number }[] }
  | { kind: "safari" }
  | { kind: "none" };

const distinct = <T>(xs: T[]) => [...new Set(xs)];

export function nextBaoChoice(candidates: readonly BaoMove[]): BaoChoice {
  if (!candidates.length) return { kind: "none" };
  if (candidates.length === 1) return { kind: "done", move: candidates[0]! };
  const start = candidates[0]!.start;
  const dirs = distinct(candidates.map((m) => m.direction)).filter(
    (d): d is 1 | -1 => d !== null,
  );
  if (dirs.length > 1) {
    return {
      kind: "direction",
      options: dirs.map((d) => ({ value: d, pit: (start + d + 16) % 16 })),
    };
  }
  const entries = distinct(candidates.map((m) => m.entry)).filter(
    (e): e is 0 | 7 => e !== null,
  );
  if (entries.length > 1) {
    return { kind: "entry", options: entries.map((e) => ({ value: e, pit: e })) };
  }
  if (distinct(candidates.map((m) => m.safari)).length > 1) return { kind: "safari" };
  return { kind: "done", move: candidates[0]! };
}

export interface BaoSelection {
  start: number | null;
  direction?: 1 | -1;
  entry?: 0 | 7;
}

/** Legal turns still compatible with the selection so far. */
export function baoCandidates(legal: readonly BaoMove[], sel: BaoSelection): BaoMove[] {
  if (sel.start === null) return [];
  return legal.filter(
    (m) =>
      m.start === sel.start &&
      (sel.direction === undefined || m.direction === sel.direction) &&
      (sel.entry === undefined || m.entry === sel.entry),
  );
}

export type BaoTap =
  | { action: "play"; move: BaoMove }
  | { action: "select"; selection: BaoSelection }
  | { action: "safari"; selection: BaoSelection }
  | { action: "clear" };

/** What tapping own pit `ring` does given the current selection. */
export function baoTap(
  legal: readonly BaoMove[],
  sel: BaoSelection,
  ring: number,
): BaoTap {
  const resolve = (selection: BaoSelection): BaoTap => {
    const choice = nextBaoChoice(baoCandidates(legal, selection));
    if (choice.kind === "done") return { action: "play", move: choice.move };
    if (choice.kind === "safari") return { action: "safari", selection };
    if (choice.kind === "none") return { action: "clear" };
    return { action: "select", selection };
  };
  if (sel.start !== null) {
    const choice = nextBaoChoice(baoCandidates(legal, sel));
    if (choice.kind === "direction") {
      const opt = choice.options.find((o) => o.pit === ring);
      if (opt) return resolve({ ...sel, direction: opt.value });
    }
    if (choice.kind === "entry") {
      const opt = choice.options.find((o) => o.pit === ring);
      if (opt) return resolve({ ...sel, entry: opt.value });
    }
  }
  if (legal.some((m) => m.start === ring) && ring !== sel.start) {
    return resolve({ start: ring });
  }
  return { action: "clear" };
}

/** Pits to highlight for the last turn (by seat). */
export function baoLastMove(state: Pick<BaoState, "lastMove">) {
  const m = state.lastMove;
  if (!m) return null;
  const lastLeg = m.path[m.path.length - 1];
  return {
    seat: m.seat,
    start: m.start,
    end: lastLeg ? lastLeg.pits[lastLeg.pits.length - 1]! : m.start,
    captured: new Set(m.captures.map((c) => c.pit)),
    seeds: m.captures.reduce((n, c) => n + c.seeds, 0),
  };
}
