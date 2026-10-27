// @vitest-environment happy-dom
/**
 * The GSAP animation layer keeps its motion guarantees: reduced motion snaps
 * to the final state, the subtle preference skips or shortens flourishes,
 * board helpers follow the same gates, and a failing animation leaves
 * elements visible.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { gsap } from "gsap";
import * as anim from "../app/utils/anim";

function setMotion({ reduced, pref }: { reduced: boolean; pref: "rich" | "subtle" }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({ matches: reduced && q.includes("reduce"), media: q })),
  );
  window.matchMedia = globalThis.matchMedia;
  localStorage.setItem("cg:motion", JSON.stringify(pref));
}

const el = () => {
  const d = document.createElement("div");
  document.body.appendChild(d);
  return d;
};
const pits = (n: number) => Array.from({ length: n }, el);

let calls: { to: number; fromTo: number; timeline: number };
beforeEach(() => {
  calls = { to: 0, fromTo: 0, timeline: 0 };
  const realTo = gsap.to.bind(gsap);
  const realFromTo = gsap.fromTo.bind(gsap);
  const realTimeline = gsap.timeline.bind(gsap);
  vi.spyOn(gsap, "to").mockImplementation((...a: Parameters<typeof gsap.to>) => {
    calls.to++;
    return realTo(...a);
  });
  vi.spyOn(gsap, "fromTo").mockImplementation((...a: Parameters<typeof gsap.fromTo>) => {
    calls.fromTo++;
    return realFromTo(...a);
  });
  vi.spyOn(gsap, "timeline").mockImplementation(
    (...a: Parameters<typeof gsap.timeline>) => {
      calls.timeline++;
      return realTimeline(...a);
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
});

const total = () => calls.to + calls.fromTo + calls.timeline;

describe("card helpers", () => {
  it("animate with rich motion", () => {
    setMotion({ reduced: false, pref: "rich" });
    anim.dealIn([el(), el()]);
    anim.playCard(el());
    anim.suitFlourish(el());
    anim.celebrate(el());
    anim.press(el());
    anim.tilt(el(), true);
    anim.loseShake(el());
    anim.confetti(5);
    expect(total()).toBeGreaterThanOrEqual(8);
  });

  it("do nothing under reduced motion", async () => {
    setMotion({ reduced: true, pref: "rich" });
    anim.dealIn([el(), el()]);
    anim.playCard(el());
    anim.sweepTo(el());
    anim.suitFlourish(el());
    anim.celebrate(el());
    anim.press(el());
    anim.floatLoop(el());
    anim.tilt(el(), true);
    anim.confetti(5);
    anim.loseShake(el());
    anim.burst(el());
    await anim.flyCard(el(), el());
    await anim.shuffle(el());
    expect(total()).toBe(0);
    expect(document.body.querySelectorAll("span").length).toBe(0); // no confetti/burst pieces
  });

  it("skip the flourishes with subtle motion but keep essential feedback", () => {
    setMotion({ reduced: false, pref: "subtle" });
    anim.suitFlourish(el());
    anim.tilt(el(), true);
    anim.confetti(5);
    anim.burst(el());
    expect(total()).toBe(0);
    anim.press(el());
    anim.playCard(el());
    expect(total()).toBeGreaterThan(0);
  });

  it("keep the previous timing and easing", () => {
    setMotion({ reduced: false, pref: "rich" });
    anim.dealIn([el()]);
    const vars = vi.mocked(gsap.fromTo).mock.calls[0]![2] as {
      duration: number;
      ease: string;
      stagger: number;
    };
    expect(vars).toMatchObject({ duration: 0.52, ease: "power2.out", stagger: 0.06 });
  });
});

describe("board helpers", () => {
  it("sow seed by seed with rich motion, pulse only the last pit with subtle", async () => {
    setMotion({ reduced: false, pref: "rich" });
    void anim.sowAlong(pits(4));
    expect(calls.timeline).toBe(1);
    expect(document.body.querySelectorAll("span").length).toBe(1); // the travelling seed

    calls = { to: 0, fromTo: 0, timeline: 0 };
    setMotion({ reduced: false, pref: "subtle" });
    await anim.sowAlong(pits(4));
    expect(calls.timeline).toBe(0);
    expect(calls.to).toBe(1);
  });

  it("show board results immediately under reduced motion", async () => {
    setMotion({ reduced: true, pref: "rich" });
    const ghost = el();
    await anim.sowAlong(pits(3));
    await anim.slidePiece(el(), new DOMRect(0, 0, 10, 10));
    await anim.popCapture([ghost]);
    anim.promotePiece(el());
    expect(total()).toBe(0);
    expect(ghost.isConnected).toBe(false); // capture copies are cleaned up
  });

  it("animate captures and promotions, using transform and opacity only", async () => {
    setMotion({ reduced: false, pref: "rich" });
    const crown = el();
    anim.promotePiece(crown);
    void anim.popCapture([el()]);
    const animated = [
      ...vi.mocked(gsap.to).mock.calls,
      ...vi.mocked(gsap.fromTo).mock.calls,
    ]
      .flatMap((c) => c.slice(1))
      .flatMap((v) => Object.keys(v as object))
      .concat(
        vi
          .mocked(gsap.to)
          .mock.calls.flatMap((c) =>
            Object.keys((c[1] as { keyframes?: object }).keyframes ?? {}),
          ),
      );
    const layout = ["width", "height", "top", "left", "margin", "padding"];
    expect(animated.filter((k) => layout.includes(k))).toEqual([]);
  });
});

describe("failure fallback", () => {
  it("leaves elements visible when an animation throws", () => {
    setMotion({ reduced: false, pref: "rich" });
    vi.mocked(gsap.fromTo).mockImplementation(() => {
      throw new Error("animation engine unavailable");
    });
    const card = el();
    card.style.opacity = "0";
    expect(() => anim.dealIn([card])).not.toThrow();
    expect(card.style.opacity).toBe("1");
  });
});
