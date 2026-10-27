/**
 * Server rendering: the animation layer never touches browser APIs on the
 * server, and the boards render their full static state there.
 */
import { describe, it, expect, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { gsap } from "gsap";
import { baoGame } from "@games/game-bao";
import { checkersGame } from "@games/game-checkers";
import * as anim from "../app/utils/anim";
import BoardGrid from "../app/components/BoardGrid.vue";
import BaoBoard from "../app/components/BaoBoard.vue";
import CheckersBoard from "../app/components/CheckersBoard.vue";

const PLAYERS = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];
const t = (k: string) => k;

describe("server rendering", () => {
  it("has no window and runs no animation", async () => {
    expect(typeof window).toBe("undefined");
    const spy = vi.spyOn(gsap, "to");
    const fromTo = vi.spyOn(gsap, "fromTo");
    anim.dealIn("x");
    anim.confetti();
    await anim.sowAlong([]);
    await anim.flyCard(null, null);
    expect(spy).not.toHaveBeenCalled();
    expect(fromTo).not.toHaveBeenCalled();
  });

  it("renders a static Bao board", async () => {
    const state = baoGame.createInitialState({ variant: "bao-la-kiswahili" }, PLAYERS, 1);
    const app = createSSRApp({
      render: () =>
        h(BaoBoard, {
          state,
          legalMoves: baoGame.getLegalMoves(state, 0),
          viewerSeat: 0,
          interactive: true,
          players: PLAYERS,
          t,
        }),
    });
    app.component("BoardGrid", BoardGrid);
    const html = await renderToString(app);
    expect(html.match(/role="gridcell"/g)).toHaveLength(32);
    expect(html).toContain('data-testid="nyumba"');
  });

  it("renders a static checkers board", async () => {
    const state = checkersGame.createInitialState(
      { variant: "international" },
      PLAYERS,
      1,
    );
    const app = createSSRApp({
      render: () =>
        h(CheckersBoard, {
          state,
          legalMoves: [],
          viewerSeat: null,
          interactive: false,
          players: PLAYERS,
          t,
        }),
    });
    app.component("BoardGrid", BoardGrid);
    const html = await renderToString(app);
    expect(html.match(/role="gridcell"/g)).toHaveLength(100);
    expect(html.match(/data-piece="man"/g)).toHaveLength(40);
  });
});
