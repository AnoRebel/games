// @vitest-environment happy-dom
/**
 * Board presentation: the shared grid's roles, keyboard focus and
 * announcements; Bao hints, markers and read-only spectating; checkers men and
 * kings, destinations, capture paths, forced capture, promotion and last move.
 */
import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { applyMove, createRng, nextInt, type Player } from "@games/engine-core";
import { baoGame, type BaoMove, type BaoState } from "@games/game-bao";
import {
  BOARD_SIZE,
  EMPTY,
  KING_0,
  MAN_0,
  MAN_1,
  checkersGame,
  positionKey,
  type CheckersMove,
  type CheckersState,
} from "@games/game-checkers";
import BoardGrid from "../app/components/BoardGrid.vue";
import BaoBoard from "../app/components/BaoBoard.vue";
import CheckersBoard from "../app/components/CheckersBoard.vue";

const PLAYERS: Player[] = [
  { id: "me", name: "Me", seat: 0 },
  { id: "bot", name: "Bot", seat: 1, bot: true },
];
/** Translation stub: echoes the key with its params. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}(${Object.values(params).join(",")})` : key;
const global = { components: { BoardGrid } };
/** Accessible name of the gridcell holding an element. */
const nameOf = (el: { element: Element }) =>
  el.element.closest('[role="gridcell"]')?.getAttribute("aria-label") ?? "";

// ---- BoardGrid -------------------------------------------------------------------

describe("BoardGrid", () => {
  const mountGrid = (interactive = true) =>
    mount(BoardGrid, {
      attachTo: document.body,
      props: {
        rows: 3,
        cols: 4,
        label: "Test board",
        cellName: (r: number, c: number) => `cell ${r}-${c}`,
        interactive,
        announcement: "Bot moved.",
      },
    });

  it("exposes grid, row and gridcell roles with accessible names", () => {
    const w = mountGrid();
    const grid = w.get('[role="grid"]');
    expect(grid.attributes("aria-label")).toBe("Test board");
    expect(w.findAll('[role="row"]')).toHaveLength(3);
    const cells = w.findAll('[role="gridcell"]');
    expect(cells).toHaveLength(12);
    expect(cells[5]!.attributes("aria-label")).toBe("cell 1-1");
    w.unmount();
  });

  it("keeps one roving tab stop and moves it with the arrow keys", async () => {
    const w = mountGrid();
    const tabStops = () => w.findAll('[role="gridcell"][tabindex="0"]');
    expect(tabStops()).toHaveLength(1);
    const grid = w.get('[role="grid"]');
    await grid.trigger("keydown", { key: "ArrowRight" });
    await grid.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(tabStops()[0]!.attributes("aria-label")).toBe("cell 1-1");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("cell 1-1");
    await grid.trigger("keydown", { key: "End" });
    await grid.trigger("keydown", { key: "ArrowRight" }); // clamps at the edge
    await nextTick();
    expect(tabStops()[0]!.attributes("aria-label")).toBe("cell 1-3");
    await grid.trigger("keydown", { key: "Home" });
    await grid.trigger("keydown", { key: "ArrowUp" });
    await grid.trigger("keydown", { key: "ArrowUp" });
    await nextTick();
    expect(tabStops()[0]!.attributes("aria-label")).toBe("cell 0-0");
    w.unmount();
  });

  it("activates with Enter, Space or a tap — only when interactive", async () => {
    const w = mountGrid();
    const grid = w.get('[role="grid"]');
    await grid.trigger("keydown", { key: "ArrowRight" });
    await grid.trigger("keydown", { key: "Enter" });
    await grid.trigger("keydown", { key: " " });
    await w.findAll('[role="gridcell"]')[6]!.trigger("click");
    expect(w.emitted("activate")).toEqual([
      [0, 1],
      [0, 1],
      [1, 2],
    ]);
    w.unmount();

    const ro = mountGrid(false);
    await ro.get('[role="grid"]').trigger("keydown", { key: "Enter" });
    await ro.findAll('[role="gridcell"]')[0]!.trigger("click");
    expect(ro.emitted("activate")).toBeUndefined();
    expect(ro.findAll('[aria-disabled="true"]')).toHaveLength(12);
    ro.unmount();
  });

  it("announces through a polite live region", () => {
    const w = mountGrid();
    const live = w.get('[data-testid="board-announcer"]');
    expect(live.attributes("aria-live")).toBe("polite");
    expect(live.text()).toBe("Bot moved.");
    w.unmount();
  });

  it("offers a 44px zoom control that toggles board-local panning", async () => {
    const w = mountGrid();
    const zoom = w.get('[data-testid="board-zoom"]');
    expect(zoom.attributes("aria-pressed")).toBe("false");
    await zoom.trigger("click");
    expect(zoom.attributes("aria-pressed")).toBe("true");
    expect(w.get('[data-testid="board-frame"]').classes()).toContain("is-zoomed");
    w.unmount();
  });
});

// ---- Bao ---------------------------------------------------------------------------

function baoState(variant: "bao-la-kiswahili" | "bao-la-kujifunza" = "bao-la-kiswahili") {
  return baoGame.createInitialState({ variant }, PLAYERS, 1);
}
const mountBao = (state: BaoState, viewerSeat: number | null = 0, interactive = true) =>
  mount(BaoBoard, {
    props: {
      state,
      legalMoves:
        viewerSeat === null ? [] : baoGame.getLegalMoves(state, state.activeSeat ?? 0),
      viewerSeat,
      interactive,
      players: PLAYERS,
      t,
    },
    global,
  });
const pit = (w: ReturnType<typeof mountBao>, seat: number, ring: number) =>
  w.get(`[data-seat="${seat}"][data-ring="${ring}"]`);

describe("BaoBoard", () => {
  it("renders 4 × 8 pits with every seed count", () => {
    const w = mountBao(baoState("bao-la-kujifunza"));
    expect(w.findAll('[role="gridcell"]')).toHaveLength(32);
    expect(w.findAll('[data-testid="seed-count"]').map((c) => c.text())).toEqual(
      Array(32).fill("2"),
    );
  });

  it("marks each nyumba while it has house status, and none in the learner game", () => {
    expect(mountBao(baoState()).findAll('[data-testid="nyumba"]')).toHaveLength(2);
    expect(
      mountBao(baoState("bao-la-kujifunza")).findAll('[data-testid="nyumba"]'),
    ).toHaveLength(0);
    expect(nameOf(pit(mountBao(baoState()), 0, 4))).toContain("board.nyumba");
  });

  it("hints legal starts, then the legal sowing directions", async () => {
    const w = mountBao(baoState());
    const starts = w
      .findAll('[data-state~="start"]')
      .map((c) => Number(c.attributes("data-ring")));
    expect(new Set(starts)).toEqual(new Set([5, 6]));
    await pit(w, 0, 5).trigger("click");
    expect(pit(w, 0, 5).attributes("data-state")).toContain("selected");
    const dirs = w
      .findAll('[data-state~="direction"]')
      .map((c) => Number(c.attributes("data-ring")));
    expect(new Set(dirs)).toEqual(new Set([4, 6]));
    expect(nameOf(pit(w, 0, 6))).toContain("board.directionTarget");
    // Tapping a direction plays the matching legal turn.
    await pit(w, 0, 6).trigger("click");
    const [move] = w.emitted("play")![0] as [BaoMove];
    expect(move).toMatchObject({ start: 5, direction: 1 });
  });

  it("clears the selection on an invalid tap without playing", async () => {
    const w = mountBao(baoState());
    await pit(w, 0, 5).trigger("click");
    await pit(w, 0, 0).trigger("click");
    expect(w.findAll('[data-state~="selected"]')).toHaveLength(0);
    await pit(w, 1, 3).trigger("click");
    expect(w.emitted("play")).toBeUndefined();
  });

  it("shows the forced-capture state and the last move", () => {
    // Find a reachable position where seat 0 must capture after seat 1 moved.
    let s: BaoState | null = null;
    for (let g = 0; g < 50 && !s; g++) {
      let x = baoState();
      let rng = createRng(`forced-${g}`);
      for (let i = 0; i < 80 && !baoGame.isTerminal(x); i++) {
        const legal = baoGame.getLegalMoves(x, x.activeSeat!);
        if (
          x.activeSeat === 0 &&
          x.lastMove &&
          legal.every((m) => m.kind === "capture")
        ) {
          s = x;
          break;
        }
        const r = nextInt(rng, legal.length);
        rng = r.state;
        x = (applyMove(baoGame, x, legal[r.value]!) as { state: BaoState }).state;
      }
    }
    expect(s).not.toBeNull();
    const w = mountBao(s!);
    expect(w.find('[data-testid="forced-capture"]').exists()).toBe(true);
    const last = w.findAll('[data-state~="last"]');
    expect(last.length).toBeGreaterThan(0);
    expect(last.every((c) => c.attributes("data-seat") === "1")).toBe(true);
  });

  it("is read-only for spectators", async () => {
    const w = mountBao(baoState(), null, false);
    expect(w.find('[data-testid="spectating"]').exists()).toBe(true);
    expect(w.findAll('[data-state~="start"]')).toHaveLength(0);
    await pit(w, 0, 5).trigger("click");
    expect(w.emitted("play")).toBeUndefined();
    expect(w.findAll('[aria-disabled="true"]')).toHaveLength(32);
  });
});

// ---- Checkers -----------------------------------------------------------------------

function checkersPosition(pieces: [number, number, number][]): CheckersState {
  const base = checkersGame.createInitialState({ variant: "drafti" }, PLAYERS, 1);
  const size = BOARD_SIZE.drafti;
  const board = Array<number>(size * size).fill(EMPTY);
  for (const [r, c, p] of pieces) board[r * size + c] = p;
  return { ...base, board, positionCounts: { [positionKey(board, 0)]: 1 } };
}
const mountCheckers = (
  state: CheckersState,
  viewerSeat: number | null = 0,
  interactive = true,
) =>
  mount(CheckersBoard, {
    props: {
      state,
      legalMoves:
        viewerSeat === null
          ? []
          : checkersGame.getLegalMoves(state, state.activeSeat ?? 0),
      viewerSeat,
      interactive,
      players: PLAYERS,
      t,
    },
    global,
  });
const square = (w: ReturnType<typeof mountCheckers>, sq: number) =>
  w.get(`[data-square="${sq}"]`);
const sq = (r: number, c: number) => r * 8 + c;

describe("CheckersBoard", () => {
  it("renders the board with men, and kings marked by a crown glyph", () => {
    const w = mountCheckers(
      checkersPosition([
        [5, 2, MAN_0],
        [6, 1, KING_0],
        [0, 1, MAN_1],
      ]),
    );
    expect(w.findAll('[role="gridcell"]')).toHaveLength(64);
    expect(w.findAll('[data-piece="man"]')).toHaveLength(2);
    const king = square(w, sq(6, 1)).get('[data-piece="king"]');
    expect(king.find('[data-testid="crown"]').exists()).toBe(true);
    expect(nameOf(square(w, sq(6, 1)))).toContain("board.yourKing");
    expect(nameOf(square(w, sq(0, 1)))).toContain("board.opponentMan");
  });

  it("highlights legal destinations for the selected piece", async () => {
    const w = mountCheckers(
      checkersGame.createInitialState({ variant: "english" }, PLAYERS, 1),
    );
    expect(w.findAll('[data-state~="origin"]')).toHaveLength(4);
    await square(w, sq(5, 2)).trigger("click");
    expect(square(w, sq(5, 2)).attributes("data-state")).toContain("selected");
    const dests = w
      .findAll('[data-state~="destination"]')
      .map((c) => Number(c.attributes("data-square")));
    expect(new Set(dests)).toEqual(new Set([sq(4, 1), sq(4, 3)]));
    await square(w, sq(4, 3)).trigger("click");
    const [move] = w.emitted("play")![0] as [CheckersMove];
    expect(move).toMatchObject({ from: sq(5, 2), path: [sq(4, 3)] });
  });

  it("previews a capture path and its captured pieces, under forced capture", async () => {
    const w = mountCheckers(
      checkersPosition([
        [5, 2, MAN_0],
        [7, 0, MAN_0],
        [4, 3, MAN_1],
        [2, 5, MAN_1],
        [0, 7, MAN_1],
      ]),
    );
    expect(w.find('[data-testid="forced-capture"]').exists()).toBe(true);
    // Only the capturing piece is offered.
    expect(
      w.findAll('[data-state~="origin"]').map((c) => Number(c.attributes("data-square"))),
    ).toEqual([sq(5, 2)]);
    await square(w, sq(5, 2)).trigger("click");
    expect(square(w, sq(1, 6)).attributes("data-state")).toContain("capture-destination");
    expect(square(w, sq(3, 4)).attributes("data-state")).toContain("landing");
    for (const c of [sq(4, 3), sq(2, 5)]) {
      expect(square(w, c).attributes("data-state")).toContain("captured");
      expect(nameOf(square(w, c))).toContain("board.willCapture");
    }
    // Capture destinations differ from quiet ones by shape, not just colour.
    expect(square(w, sq(1, 6)).find(".marker-capture").exists()).toBe(true);
    expect(w.find(".marker-move").exists()).toBe(false);
  });

  it("announces a promotion and marks the last move", () => {
    let s = checkersPosition([
      [1, 2, MAN_0],
      [6, 7, MAN_1],
    ]);
    const promote = checkersGame.getLegalMoves(s, 0).find((m) => m.promotes)!;
    s = (applyMove(checkersGame, s, promote) as { state: CheckersState }).state;
    const w = mountCheckers(s, 0, false);
    expect(square(w, promote.path[0]!).find('[data-testid="crown"]').exists()).toBe(true);
    expect(w.get('[data-testid="board-announcer"]').text()).toContain(
      "board.announcePromote",
    );
    for (const c of [promote.from, promote.path[0]!]) {
      expect(square(w, c).attributes("data-state")).toContain("last");
    }
  });

  it("puts the viewer's side at the bottom and is read-only for spectators", async () => {
    const s = checkersGame.createInitialState({ variant: "drafti" }, PLAYERS, 1);
    const asSeat1 = mountCheckers({ ...s, activeSeat: 1 }, 1);
    // Bottom-right display cell is seat 1's corner square (0,0 on the board array).
    const cells = asSeat1.findAll('[role="gridcell"]');
    expect(cells.at(-1)!.find("[data-square]").attributes("data-square")).toBe("0");

    const spectator = mountCheckers(s, null, false);
    expect(spectator.find('[data-testid="spectating"]').exists()).toBe(true);
    expect(spectator.findAll('[data-state~="origin"]')).toHaveLength(0);
    await square(spectator, sq(5, 2)).trigger("click");
    expect(spectator.emitted("play")).toBeUndefined();
  });
});
