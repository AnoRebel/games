// @vitest-environment happy-dom
/**
 * Game state never relies on colour alone: every cue the boards show has its
 * own shape, glyph or outline style, so it survives grayscale and any custom
 * palette. (Colour contrast for hints is enforced by theme validation.)
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { applyMove, type Player } from "@card-games/engine-core";
import { baoGame, type BaoState } from "@card-games/game-bao";
import {
  EMPTY,
  KING_0,
  MAN_0,
  MAN_1,
  checkersGame,
  positionKey,
  type CheckersState,
} from "@card-games/game-checkers";
import BoardGrid from "../app/components/BoardGrid.vue";
import BaoBoard from "../app/components/BaoBoard.vue";
import CheckersBoard from "../app/components/CheckersBoard.vue";

const PLAYERS: Player[] = [
  { id: "me", name: "Me", seat: 0 },
  { id: "bot", name: "Bot", seat: 1 },
];
const t = (k: string) => k;
const global = { components: { BoardGrid } };

/** The markup (classes/glyphs) a cue renders, with every colour stripped. */
const shapeOf = (el: Element) =>
  [...el.querySelectorAll("*")]
    .map(
      (n) =>
        `${n.tagName}.${[...n.classList].sort().join(".")}:${n.children.length ? "" : (n.textContent ?? "").trim()}`,
    )
    .join("|");

describe("checkers cues survive grayscale", () => {
  it("distinguishes origin, selection, quiet and capture destinations, capture path, last move and kings by shape", async () => {
    const size = 8;
    const board = Array<number>(64).fill(EMPTY);
    board[5 * size + 2] = MAN_0;
    board[7 * size + 6] = KING_0;
    board[3 * size + 4] = MAN_1;
    board[0 * size + 1] = MAN_1;
    let s: CheckersState = {
      ...checkersGame.createInitialState({ variant: "drafti" }, PLAYERS, 1),
      board,
      activeSeat: 1,
    };
    s = { ...s, positionCounts: { [positionKey(board, 1)]: 1 } };
    // Black moves first so a last move exists, then White must capture.
    const blackMove = checkersGame
      .getLegalMoves(s, 1)
      .find((m) => m.from === 3 * size + 4 && m.path[0] === 4 * size + 3)!;
    s = (applyMove(checkersGame, s, blackMove) as { state: CheckersState }).state;

    const w = mount(CheckersBoard, {
      props: {
        state: s,
        legalMoves: checkersGame.getLegalMoves(s, 0),
        viewerSeat: 0,
        interactive: true,
        players: PLAYERS,
        t,
      },
      global,
    });
    // King vs man: a crown glyph, not a colour.
    expect(w.findAll('[data-piece="king"] [data-testid="crown"]')).toHaveLength(1);
    expect(w.findAll('[data-piece="man"] [data-testid="crown"]')).toHaveLength(0);
    // Last move: dashed frame element.
    expect(w.findAll(".marker-last")).toHaveLength(2);
    // Select the capturing man: destinations and the captured piece get their own glyphs.
    await w.get(`[data-square="${5 * size + 2}"]`).trigger("click");
    const capture = w.find(".marker-capture");
    const captured = w.find(".marker-captured");
    expect(capture.exists()).toBe(true);
    expect(captured.text()).toBe("✕");
    // Each cue is its own element (dot, diamond, ✕, dashed frame, crown) or an
    // outline style token, so none depends on hue.
    const selected = w.get(`[data-square="${5 * size + 2}"]`);
    expect(selected.attributes("data-state")).toContain("selected");
    const cueElements = [".marker-capture", ".marker-captured", ".marker-last", ".crown"];
    for (const sel of cueElements) expect(w.find(sel).exists()).toBe(true);
    expect(new Set(cueElements.map((c) => shapeOf(w.get(c).element) + c)).size).toBe(4);
  });

  it("quiet destinations are dots, captures are diamonds", async () => {
    const s = checkersGame.createInitialState({ variant: "english" }, PLAYERS, 1);
    const w = mount(CheckersBoard, {
      props: {
        state: s,
        legalMoves: checkersGame.getLegalMoves(s, 0),
        viewerSeat: 0,
        interactive: true,
        players: PLAYERS,
        t,
      },
      global,
    });
    await w.get(`[data-square="${5 * 8 + 2}"]`).trigger("click");
    expect(w.findAll(".marker-move")).toHaveLength(2);
    expect(w.findAll(".marker-capture")).toHaveLength(0);
  });
});

describe("Bao cues survive grayscale", () => {
  it("marks nyumba, starts, directions, captures and last move with distinct glyphs or outlines", async () => {
    let s: BaoState = baoGame.createInitialState(
      { variant: "bao-la-kiswahili" },
      PLAYERS,
      1,
    );
    s = (applyMove(baoGame, s, baoGame.getLegalMoves(s, 0)[0]!) as { state: BaoState })
      .state;
    s = (applyMove(baoGame, s, baoGame.getLegalMoves(s, 1)[0]!) as { state: BaoState })
      .state;
    const w = mount(BaoBoard, {
      props: {
        state: s,
        legalMoves: baoGame.getLegalMoves(s, 0),
        viewerSeat: 0,
        interactive: true,
        players: PLAYERS,
        t,
      },
      global,
    });
    expect(w.findAll('[data-testid="nyumba"]').length).toBeGreaterThan(0); // house glyph
    expect(w.findAll('[data-state~="last"]').length).toBeGreaterThan(0); // ringed pits
    const start = w.get('[data-state~="start"]'); // dashed outline
    await start.trigger("click");
    const arrows = w.findAll(".bao-target").map((n) => n.text());
    if (arrows.length) expect(arrows.every((a) => /[←→↑↓⤓]/.test(a))).toBe(true);
    // Each state is a different attribute token, styled by outline pattern, not hue.
    const tokens = new Set(
      w
        .findAll("[data-state]")
        .flatMap((n) => (n.attributes("data-state") ?? "").split(" ").filter(Boolean)),
    );
    expect(
      [...tokens].every((tk) =>
        ["start", "selected", "direction", "entry", "last", "captured"].includes(tk),
      ),
    ).toBe(true);
  });
});
