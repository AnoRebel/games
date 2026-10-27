/**
 * Checkers rules for the three variants.
 *
 *  - Drafti (Tanzania): 8×8, flying kings, men move and capture forward only,
 *    free choice of capture, promotion ends a capture sequence.
 *  - English/American: 8×8, short kings, men forward only, free choice of
 *    capture, crowning ends a capture sequence.
 *  - International: 10×10, flying kings, men capture backward too, the
 *    maximum capture is mandatory, jumped pieces stay on the board until the
 *    move ends, and a man only promotes when its move stops on the kings row.
 *
 * Capture is compulsory everywhere, and a chosen sequence is always completed.
 */

import {
  type Player,
  type ReducerResult,
  type ScoreResult,
  type Seat,
  createRng,
} from "@games/engine-core";
import {
  type CapturedPiece,
  type CheckersConfig,
  type CheckersEndReason,
  type CheckersMove,
  type CheckersState,
  type CheckersVariant,
  type EndgameCounter,
  BOARD_SIZE,
  EMPTY,
  isDark,
  isKing,
  kingOf,
  kingsRow,
  manOf,
  ownerOf,
} from "./state";

export const CHECKERS_VARIANTS: readonly CheckersVariant[] = [
  "drafti",
  "english",
  "international",
];

export function defaultCheckersConfig(): CheckersConfig {
  return { variant: "drafti" };
}

/** A jumped piece that stays on the board until an International move ends. */
const GHOST = -1;

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

// ---- setup ------------------------------------------------------------------

export function startingBoard(variant: CheckersVariant): number[] {
  const size = BOARD_SIZE[variant];
  const rows = size === 10 ? 4 : 3;
  const board = Array<number>(size * size).fill(EMPTY);
  for (let sq = 0; sq < board.length; sq++) {
    if (!isDark(size, sq)) continue;
    const row = Math.floor(sq / size);
    if (row < rows) board[sq] = manOf(1);
    else if (row >= size - rows) board[sq] = manOf(0);
  }
  return board;
}

export function positionKey(board: readonly number[], toMove: Seat | null): string {
  return `${board.join("")}:${toMove ?? "-"}`;
}

export function createInitialState(
  config: CheckersConfig,
  players: Player[],
  seed: string | number,
): CheckersState {
  const variant = config?.variant ?? "drafti";
  if (!CHECKERS_VARIANTS.includes(variant)) {
    throw new Error(`Unsupported checkers variant "${String(variant)}"`);
  }
  if (players.length !== 2) throw new Error("Checkers is played by exactly two players");
  const board = startingBoard(variant);
  return {
    gameId: "checkers",
    rng: createRng(seed),
    players,
    activeSeat: 0,
    phase: "playing",
    version: 0,
    variant,
    config: { ...config, variant },
    size: BOARD_SIZE[variant],
    board,
    lastMove: null,
    ply: 0,
    positionCounts: { [positionKey(board, 0)]: 1 },
    quietPlies: 0,
    endgame: null,
    winner: null,
    drawn: false,
    endReason: null,
  };
}

// ---- move generation --------------------------------------------------------

interface Geometry {
  size: number;
  variant: CheckersVariant;
  flying: boolean;
}

const geometry = (state: Pick<CheckersState, "size" | "variant">): Geometry => ({
  size: state.size,
  variant: state.variant,
  flying: state.variant !== "english",
});

/** Forward row delta for a seat. */
const forward = (seat: Seat) => (seat === 0 ? -1 : 1);

/** Step from `sq` by (dr, dc), or -1 when off the board. */
function stepFrom(g: Geometry, sq: number, dr: number, dc: number): number {
  const r = Math.floor(sq / g.size) + dr;
  const c = (sq % g.size) + dc;
  if (r < 0 || c < 0 || r >= g.size || c >= g.size) return -1;
  return r * g.size + c;
}

function quietMoves(
  g: Geometry,
  board: number[],
  seat: Seat,
  from: number,
): CheckersMove[] {
  const piece = board[from]!;
  const king = isKing(piece);
  const out: CheckersMove[] = [];
  for (const [dr, dc] of DIAGONALS) {
    if (!king && dr !== forward(seat)) continue;
    let to = stepFrom(g, from, dr, dc);
    while (to >= 0 && board[to] === EMPTY) {
      const promotes = !king && Math.floor(to / g.size) === kingsRow(g.size, seat);
      out.push({ type: "move", seat, from, path: [to], captures: [], promotes });
      if (!(king && g.flying)) break;
      to = stepFrom(g, to, dr, dc);
    }
  }
  return out;
}

/** Every complete capture sequence for the piece on `from`. */
function captureSequences(
  g: Geometry,
  original: readonly number[],
  seat: Seat,
  from: number,
): CheckersMove[] {
  const board = original.slice();
  const piece = board[from]!;
  board[from] = EMPTY; // the moving piece leaves its square
  const out: CheckersMove[] = [];
  const intl = g.variant === "international";
  const enemyAt = (sq: number) => {
    const v = board[sq]!;
    return v !== GHOST && v !== EMPTY && ownerOf(v) !== seat;
  };

  /** Jumps available from `pos`: the enemy square and its landing squares. */
  const jumpsFrom = (pos: number, king: boolean) => {
    const jumps: { over: number; landings: number[] }[] = [];
    for (const [dr, dc] of DIAGONALS) {
      // Men capture forward only, except in International.
      if (!king && !intl && dr !== forward(seat)) continue;
      let sq = stepFrom(g, pos, dr, dc);
      if (king && g.flying) {
        while (sq >= 0 && board[sq] === EMPTY) sq = stepFrom(g, sq, dr, dc);
      }
      if (sq < 0 || !enemyAt(sq)) continue;
      const landings: number[] = [];
      let land = stepFrom(g, sq, dr, dc);
      while (land >= 0 && board[land] === EMPTY) {
        landings.push(land);
        if (!(king && g.flying)) break;
        land = stepFrom(g, land, dr, dc);
      }
      if (landings.length) jumps.push({ over: sq, landings });
    }
    return jumps;
  };

  const dfs = (pos: number, king: boolean, path: number[], caps: CapturedPiece[]) => {
    const jumps = jumpsFrom(pos, king);
    if (!jumps.length) {
      if (caps.length) {
        const promotes =
          !isKing(piece) && Math.floor(pos / g.size) === kingsRow(g.size, seat);
        out.push({ type: "move", seat, from, path, captures: caps, promotes });
      }
      return;
    }
    for (const { over, landings } of jumps) {
      const taken = board[over]!;
      // Drafti/English remove a piece as it is jumped; International leaves a
      // ghost that blocks and cannot be jumped again until the move ends.
      board[over] = intl ? GHOST : EMPTY;
      const nextCaps = [...caps, { square: over, king: isKing(taken) }];
      let allowed = landings;
      if (g.variant === "drafti" && king && landings.length > 1) {
        // A flying king must land where it can keep capturing, if it can.
        const continuing = landings.filter((l) => jumpsFrom(l, true).length > 0);
        if (continuing.length) allowed = continuing;
      }
      for (const land of allowed) {
        const crowned =
          !king &&
          g.variant !== "international" &&
          Math.floor(land / g.size) === kingsRow(g.size, seat);
        if (crowned) {
          // Reaching the kings row ends a Drafti/English capture at once.
          out.push({
            type: "move",
            seat,
            from,
            path: [...path, land],
            captures: nextCaps,
            promotes: true,
          });
        } else {
          dfs(land, king, [...path, land], nextCaps);
        }
      }
      board[over] = taken;
    }
  };

  dfs(from, isKing(piece), [], []);
  return out;
}

/** All legal moves for `seat`, ignoring whose turn it is. */
export function generateMoves(
  state: Pick<CheckersState, "size" | "variant" | "board">,
  seat: Seat,
): CheckersMove[] {
  const g = geometry(state);
  const board = state.board;
  const captures: CheckersMove[] = [];
  for (let sq = 0; sq < board.length; sq++) {
    if (ownerOf(board[sq]!) === seat)
      captures.push(...captureSequences(g, board, seat, sq));
  }
  if (captures.length) {
    if (g.variant !== "international") return captures;
    const max = Math.max(...captures.map((m) => m.captures.length));
    return captures.filter((m) => m.captures.length === max);
  }
  const quiet: CheckersMove[] = [];
  for (let sq = 0; sq < board.length; sq++) {
    if (ownerOf(board[sq]!) === seat) quiet.push(...quietMoves(g, board, seat, sq));
  }
  return quiet;
}

export function getLegalMoves(state: CheckersState, seat: Seat): CheckersMove[] {
  if (state.phase === "finished" || state.activeSeat !== seat) return [];
  return generateMoves(state, seat);
}

// ---- applying moves ---------------------------------------------------------

/** The board after a move (pure). */
export function applyToBoard(board: readonly number[], move: CheckersMove): number[] {
  const next = board.slice();
  const piece = next[move.from]!;
  next[move.from] = EMPTY;
  for (const c of move.captures) next[c.square] = EMPTY;
  const to = move.path[move.path.length - 1]!;
  next[to] = move.promotes ? kingOf(move.seat) : piece;
  return next;
}

/** Men and kings per seat. */
export function material(board: readonly number[]) {
  const m = { men: [0, 0], kings: [0, 0] };
  for (const v of board) {
    const owner = ownerOf(v);
    if (owner === null) continue;
    if (isKing(v)) m.kings[owner]!++;
    else m.men[owner]!++;
  }
  return m;
}

/**
 * The endgame countdown that applies to this material, if any: the material
 * signature, the stronger seat, and how long it has to win.
 */
function endgameRule(
  variant: CheckersVariant,
  m: ReturnType<typeof material>,
): {
  key: string;
  stronger: Seat;
  limit: { strongerMoves?: number; plies?: number };
} | null {
  for (const weak of [0, 1] as const) {
    const strong = (1 - weak) as Seat;
    const loneKing = m.kings[weak] === 1 && m.men[weak] === 0;
    if (!loneKing) continue;
    const k = m.kings[strong]!;
    const men = m.men[strong]!;
    const key = `${strong}:${k}k${men}m-v-1k`;
    if (variant === "drafti" && k === 3 && men === 0) {
      return { key, stronger: strong, limit: { strongerMoves: 12 } };
    }
    if (
      variant === "international" &&
      ((k === 3 && men === 0) || (k === 2 && men === 1) || (k === 1 && men === 2))
    ) {
      return { key, stronger: strong, limit: { plies: 32 } };
    }
  }
  return null;
}

function finish(
  state: CheckersState,
  result: { winner: Seat | null; reason: CheckersEndReason },
): CheckersState {
  return {
    ...state,
    phase: "finished",
    activeSeat: null,
    winner: result.winner,
    drawn: result.winner === null,
    endReason: result.reason,
  };
}

/**
 * Apply a legal move and settle wins and draws. Search passes
 * `checkNextMoves: false` and detects a stuck opponent itself when it expands
 * the child, saving one move generation per node.
 */
export function applyLegalMove(
  state: CheckersState,
  move: CheckersMove,
  { checkNextMoves = true }: { checkNextMoves?: boolean } = {},
): CheckersState {
  const seat = move.seat;
  const opponent = (1 - seat) as Seat;
  const board = applyToBoard(state.board, move);
  const irreversible = move.captures.length > 0 || !isKing(state.board[move.from]!);
  const key = positionKey(board, opponent);
  const positionCounts = irreversible ? {} : { ...state.positionCounts };
  positionCounts[key] = (positionCounts[key] ?? 0) + 1;

  const m = material(board);
  const rule = endgameRule(state.variant, m);
  // A countdown counts the moves played in its material situation: a move
  // made from that same situation counts, the move that creates it does not.
  let endgame: EndgameCounter | null = null;
  if (rule) {
    const before = endgameRule(state.variant, material(state.board));
    const continuing = before?.key === rule.key;
    const prev = continuing && state.endgame?.key === rule.key ? state.endgame : null;
    endgame = {
      key: rule.key,
      plies: continuing ? (prev?.plies ?? 0) + 1 : 0,
      strongerMoves: continuing
        ? (prev?.strongerMoves ?? 0) + (seat === rule.stronger ? 1 : 0)
        : 0,
    };
  }

  const next: CheckersState = {
    ...state,
    board,
    lastMove: move,
    ply: state.ply + 1,
    activeSeat: opponent,
    positionCounts,
    quietPlies: irreversible ? 0 : state.quietPlies + 1,
    endgame,
  };

  // Wins first: no pieces left, or no legal move at the start of the turn.
  if (m.men[opponent]! + m.kings[opponent]! === 0) {
    return finish(next, { winner: seat, reason: "no-pieces" });
  }
  if (checkNextMoves && generateMoves(next, opponent).length === 0) {
    return finish(next, { winner: seat, reason: "no-legal-move" });
  }

  // Draws.
  if (positionCounts[key]! >= 3)
    return finish(next, { winner: null, reason: "repetition" });
  const kingsOnly = m.men[0] === 0 && m.men[1] === 0;
  if (state.variant === "drafti" && kingsOnly) {
    const [a, b] = m.kings as [number, number];
    if ((a === 1 && b === 1) || (a === 2 && b === 2)) {
      return finish(next, { winner: null, reason: "kings-equal" });
    }
  }
  if (
    state.variant === "international" &&
    kingsOnly &&
    m.kings[0] === 1 &&
    m.kings[1] === 1
  ) {
    return finish(next, { winner: null, reason: "kings-equal" });
  }
  if (rule && endgame) {
    const expired =
      (rule.limit.strongerMoves !== undefined &&
        endgame.strongerMoves >= rule.limit.strongerMoves) ||
      (rule.limit.plies !== undefined && endgame.plies >= rule.limit.plies);
    if (expired) return finish(next, { winner: null, reason: "king-endgame" });
  }
  // English: 40 moves each without a capture or man move. International: 25
  // moves each of king moves only.
  const noProgressLimit =
    state.variant === "english" ? 80 : state.variant === "international" ? 50 : Infinity;
  if (next.quietPlies >= noProgressLimit) {
    return finish(next, { winner: null, reason: "no-progress" });
  }
  return next;
}

const sameMove = (a: CheckersMove, b: CheckersMove) =>
  JSON.stringify(a) === JSON.stringify(b);

export function reducer(
  state: CheckersState,
  move: CheckersMove,
): ReducerResult<CheckersState> {
  if (state.phase === "finished")
    return { ok: false, error: "Game is already over", state };
  if (move?.type !== "move" || move.seat !== state.activeSeat) {
    return { ok: false, error: "Not your turn", state };
  }
  const legal = generateMoves(state, move.seat).find((m) => sameMove(m, move));
  if (!legal) return { ok: false, error: "Illegal move", state };
  return { ok: true, state: applyLegalMove(state, legal) };
}

// ---- scoring ----------------------------------------------------------------

export function getScores(state: CheckersState): ScoreResult {
  const m = material(state.board);
  const bySeat: Record<Seat, number> = {};
  for (const p of state.players) bySeat[p.seat] = m.men[p.seat]! + m.kings[p.seat]!;
  return {
    bySeat,
    winners: state.winner === null ? [] : [state.winner],
    ...(state.drawn ? { drawn: true } : {}),
  };
}
