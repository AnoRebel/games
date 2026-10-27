/**
 * GSAP helpers for gamey, tactile event animations — the one orchestrated
 * animation layer. Games call these helpers, never GSAP directly.
 *
 * Gates:
 *   - prefers-reduced-motion → helpers snap to the final state (no motion).
 *   - motion preference 'subtle' → only quick, essential feedback runs; the
 *     flashier sequences (confetti, slides to the winner, tilt, long board
 *     travel) are skipped or shortened.
 *   - server rendering → nothing runs; GSAP is only touched in the browser.
 *   - a failing animation → the element is left in its final, fully visible
 *     state so the game stays playable.
 *
 * @vueuse/motion handles declarative component transitions; this is the
 * imperative, sequenced layer (deal, flip, slide, celebrate, press, and the
 * board choreography: sow, slide, capture, promote). Everything animates
 * transform and opacity only.
 */
import { gsap } from "gsap";

type Targets = string | Element | Element[] | null | undefined;
type Vars = Record<string, unknown>;

/**
 * In the browser? Nuxt replaces `import.meta.client` with a literal at build
 * time; outside Nuxt (unit tests) fall back to checking for a window.
 */
const isClient = (): boolean => import.meta.client ?? typeof window !== "undefined";

function reduced(): boolean {
  return (
    isClient() && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Read the persisted motion preference without a composable. */
function rich(): boolean {
  if (reduced()) return false;
  if (!isClient()) return true;
  try {
    return (localStorage.getItem("cg:motion") ?? '"rich"').includes("rich");
  } catch {
    return true;
  }
}

/** Animations run only in a browser that hasn't asked for reduced motion. */
const canAnimate = () => isClient() && !reduced();

/** Seconds from milliseconds. */
const s = (ms: number) => ms / 1000;

/** Named eases; `outN` is the curve of power N in the original timings (GSAP `power(N-1).out`). */
const EASE = {
  out2: "power1.out",
  out3: "power2.out",
  out4: "power3.out",
  inOut2: "power1.inOut",
  inOut3: "power2.inOut",
} as const;

/** Leave targets in their resting, fully visible state. */
function settle(targets: Targets, extra: Vars = {}) {
  if (!targets || !isClient()) return;
  try {
    gsap.set(targets, { clearProps: "transform", opacity: 1, ...extra });
  } catch {
    for (const el of toElements(targets)) {
      (el as HTMLElement).style.transform = "";
      (el as HTMLElement).style.opacity = "1";
    }
  }
}

function toElements(targets: Targets): Element[] {
  if (!targets || !isClient()) return [];
  if (typeof targets === "string") return [...document.querySelectorAll(targets)];
  return Array.isArray(targets) ? targets : [targets];
}

/**
 * Tween through keyframe values. Each property is `[start, ...stops]`; the
 * start is applied immediately and the stops are spread evenly over the
 * duration — the same shape the helpers used before.
 */
function keyframes(targets: Targets, props: Record<string, unknown[]>, vars: Vars) {
  if (!targets) return null;
  const from: Vars = {};
  const stops: Vars = {};
  for (const [key, values] of Object.entries(props)) {
    from[key] = values[0];
    stops[key] = values.slice(1);
  }
  gsap.set(targets, from);
  return gsap.to(targets, { keyframes: { ...stops, easeEach: "none" }, ...vars });
}

/** Run an animation, falling back to the final state if GSAP fails. */
function guarded<T>(targets: Targets, run: () => T, final: Vars = {}): T | undefined {
  try {
    return run();
  } catch {
    settle(targets, final);
    return undefined;
  }
}

/** Staggered, springy deal-in for a freshly rendered hand/row. */
export function dealIn(targets: string | Element | Element[]) {
  if (!canAnimate()) return;
  guarded(targets, () =>
    gsap.fromTo(
      targets,
      { y: -36, rotation: rich() ? -8 : 0, opacity: 0, scale: 0.85 },
      {
        y: 0,
        rotation: 0,
        opacity: 1,
        scale: 1,
        stagger: s(rich() ? 60 : 30),
        duration: s(rich() ? 520 : 320),
        ease: EASE.out3,
      },
    ),
  );
}

/** A card flipping/popping onto the table when played. */
export function playCard(target: string | Element) {
  if (!canAnimate()) return;
  guarded(target, () => {
    if (rich()) {
      keyframes(target, { scale: [0.7, 1.08, 1] }, { duration: s(420), ease: EASE.out4 });
      gsap.fromTo(
        target,
        { rotationY: 90, opacity: 0 },
        { rotationY: 0, opacity: 1, duration: s(420), ease: EASE.out4 },
      );
    } else {
      gsap.fromTo(
        target,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: s(200) },
      );
    }
  });
}

/** Slide captured cards toward the winner, then settle (trick/pickup). */
export function sweepTo(targets: string | Element | Element[], dx = 0, dy = -28) {
  if (!canAnimate()) return;
  guarded(targets, () =>
    gsap.fromTo(
      targets,
      { opacity: 1, scale: 1 },
      {
        x: rich() ? dx : 0,
        y: dy,
        opacity: 0,
        scale: 0.9,
        duration: s(rich() ? 460 : 280),
        stagger: s(rich() ? 40 : 20),
        ease: EASE.inOut3,
      },
    ),
  );
}

/** Suit-change flourish — spin + pulse on the indicator. */
export function suitFlourish(target: string | Element) {
  if (!canAnimate() || !rich()) return;
  guarded(target, () =>
    keyframes(
      target,
      { rotation: [0, 360], scale: [1, 1.4, 1] },
      { duration: s(560), ease: EASE.inOut3 },
    ),
  );
}

/** Win celebration — buoyant pop + shimmer. */
export function celebrate(target: string | Element) {
  if (!canAnimate()) return;
  return guarded(target, () => {
    const tl = gsap.timeline();
    tl.add(
      keyframes(
        target,
        {
          scale: [0.6, 1.1, 1],
          rotation: rich() ? [-4, 3, 0] : [0, 0],
          opacity: [0, 1],
        },
        { duration: s(rich() ? 720 : 360), ease: EASE.out4 },
      )!,
    );
    return tl;
  });
}

/** Quick tactile press feedback on tap/click. */
export function press(target: string | Element) {
  if (!canAnimate()) return;
  guarded(target, () =>
    keyframes(target, { scale: [1, 0.94, 1] }, { duration: s(180), ease: EASE.out2 }),
  );
}

/**
 * Gentle continuous bob/float for a set of elements (e.g. footer suit pips).
 * Staggered so they ripple rather than move in lockstep. No-op when reduced.
 */
export function floatLoop(targets: string | Element | Element[]) {
  if (!canAnimate()) return;
  guarded(targets, () =>
    keyframes(
      targets,
      { y: [0, -5, 0], rotation: [0, 6, 0] },
      { duration: s(2200), stagger: s(160), repeat: -1, ease: EASE.inOut2 },
    ),
  );
}

/** Subtle hover tilt for a card (rich only). */
export function tilt(target: Element, on: boolean) {
  if (!canAnimate() || !rich()) return;
  guarded(target, () =>
    gsap.to(target, {
      rotation: on ? -3 : 0,
      y: on ? -10 : 0,
      duration: s(220),
      ease: EASE.out2,
    }),
  );
}

/**
 * FLIP-style "card flight": animate a floating clone of `from` flying to where
 * `to` sits, then resolve so the caller can commit the real state. Gives the
 * tactile sense of a card travelling hand → discard (or deck → hand). No-ops
 * (and resolves immediately) under reduced motion or when refs are missing.
 */
export function flyCard(
  from: Element | null | undefined,
  to: Element | null | undefined,
  opts: { scaleTo?: number } = {},
): Promise<void> {
  if (!canAnimate() || !from || !to) return Promise.resolve();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) return Promise.resolve();

  const clone = from.cloneNode(true) as HTMLElement;
  clone.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;pointer-events:none;z-index:9999;will-change:transform`;
  document.body.appendChild(clone);

  const dx = b.left + (b.width - a.width) / 2 - a.left;
  const dy = b.top + (b.height - a.height) / 2 - a.top;

  // Scale toward the target. When `to` is a large container (e.g. a whole hand
  // row) matching its width would balloon the clone, so clamp to a sane range.
  // Callers that know the exact destination card size can pass `scaleTo`.
  const scaleEnd = opts.scaleTo ?? Math.min(1.25, Math.max(0.55, b.width / a.width));

  return new Promise<void>((resolve) => {
    const done = () => {
      clone.remove();
      resolve();
    };
    try {
      gsap.fromTo(
        clone,
        { x: 0, y: 0, rotation: 0, scale: 1 },
        {
          x: dx,
          y: dy,
          rotation: rich() ? gsap.utils.random(-12, 12, 1) : 0,
          scale: scaleEnd,
          duration: s(rich() ? 380 : 240),
          ease: EASE.inOut3,
          onComplete: done,
        },
      );
    } catch {
      done();
    }
  });
}

/**
 * Riffle/cut shuffle on a deck pile — a quick set of overshoot wiggles that read
 * as "the deck is being shuffled". Resolves when done so a deal can follow.
 */
export function shuffle(target: Element | null | undefined): Promise<void> {
  if (!canAnimate() || !target) return Promise.resolve();
  const reps = rich() ? 3 : 1;
  return new Promise<void>((resolve) => {
    try {
      const tl = gsap.timeline({ onComplete: () => resolve() });
      for (let i = 0; i < reps; i++) {
        tl.add(
          keyframes(
            target,
            {
              x: [0, rich() ? 14 : 8, -10, 0],
              rotation: rich() ? [0, 5, -4, 0] : [0, 2, 0],
              scale: [1, 1.04, 1],
            },
            { duration: s(rich() ? 240 : 180), ease: EASE.inOut2 },
          )!,
        );
      }
    } catch {
      settle(target);
      resolve();
    }
  });
}

/** Theme-toggle cross-fade fallback. */
export function crossFade(target: string | Element, opacityTo = 1) {
  if (!isClient()) return;
  if (reduced()) {
    guarded(target, () => gsap.set(target, { opacity: opacityTo }), {
      opacity: opacityTo,
    });
    return;
  }
  guarded(
    target,
    () =>
      gsap.fromTo(
        target,
        { opacity: 0.4 },
        { opacity: opacityTo, duration: s(300), ease: EASE.inOut2 },
      ),
    { opacity: opacityTo },
  );
}

/**
 * Full-screen confetti rain for a win. Spawns paper pieces above the viewport
 * that fall + tumble + drift, then clean themselves up. Mounted on <body> so it
 * overlays everything. Honors reduced/subtle motion (no-op).
 */
export function confetti(count = 90): void {
  if (!canAnimate() || !rich()) return;
  const rand = gsap.utils.random;
  const colors = [
    "var(--cg-accent)",
    "oklch(0.82 0.18 30)",
    "oklch(0.85 0.17 140)",
    "oklch(0.82 0.16 250)",
    "oklch(0.88 0.18 90)",
    "oklch(0.7 0.2 330)",
  ];
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden";
  document.body.appendChild(layer);

  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const w = rand(6, 12, 1);
    p.style.cssText = `position:absolute;top:-5%;left:${rand(0, 100, 1)}%;width:${w}px;height:${w * rand(0.4, 1)}px;background:${colors[i % colors.length]};border-radius:${rand(0, 3, 1)}px;will-change:transform`;
    layer.appendChild(p);
    pieces.push(p);
  }
  try {
    // Each piece gets its own fall time; the layer goes when the last lands.
    const tl = gsap.timeline({ onComplete: () => layer.remove() });
    pieces.forEach((p, i) => {
      tl.to(
        p,
        {
          y: rand(window.innerHeight * 0.9, window.innerHeight * 1.2),
          x: rand(-120, 120),
          rotation: rand(-540, 540),
          keyframes: { opacity: [1, 1, 0], easeEach: "none" },
          duration: s(rand(1600, 2800)),
          ease: EASE.out2,
        },
        s(i * 12),
      );
    });
  } catch {
    layer.remove();
  }
}

/** A dejected "you lost" reaction — a quick shake + dip on the table/result. */
export function loseShake(target: string | Element): void {
  if (!canAnimate()) return;
  guarded(
    target,
    () =>
      keyframes(
        target,
        {
          x: rich() ? [0, -10, 9, -7, 5, 0] : [0, -5, 4, 0],
          y: [0, 4, 0],
          rotation: rich() ? [0, -1.5, 1.2, -0.6, 0] : [0, 0],
          // The desaturation pulse only plays in rich motion.
          ...(rich() ? { filter: ["saturate(1)", "saturate(0.6)", "saturate(1)"] } : {}),
        },
        { duration: s(rich() ? 620 : 360), ease: EASE.inOut2 },
      ),
    { filter: "none" },
  );
}

/** Celebratory burst of small dots from a point (win moment, rich only). */
export function burst(container: HTMLElement) {
  if (!canAnimate() || !rich()) return;
  const rand = gsap.utils.random;
  const colors = [
    "var(--cg-accent)",
    "oklch(0.8 0.16 30)",
    "oklch(0.82 0.16 140)",
    "oklch(0.8 0.16 250)",
  ];
  const dots: HTMLElement[] = [];
  for (let i = 0; i < 18; i++) {
    const d = document.createElement("span");
    d.style.cssText = `position:absolute;left:50%;top:40%;width:8px;height:8px;border-radius:9999px;pointer-events:none;background:${colors[i % colors.length]}`;
    container.appendChild(d);
    dots.push(d);
  }
  const cleanup = () => dots.forEach((d) => d.remove());
  try {
    gsap.fromTo(
      dots,
      { scale: 1, opacity: 1 },
      {
        x: () => rand(-160, 160, 1),
        y: () => rand(-140, 60, 1),
        scale: 0,
        opacity: 0,
        rotation: () => rand(-180, 180, 1),
        duration: s(900),
        ease: EASE.out3,
        onComplete: cleanup,
      },
    );
  } catch {
    cleanup();
  }
}

// ---- board choreography ----------------------------------------------------------

/** Centre of an element, in viewport coordinates. */
function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Bao sowing: a seed travels pit to pit along the sown path, each pit pulsing
 * as it receives the seed, then the final counts settle. Subtle motion only
 * pulses the last pit; reduced motion shows the result at once. Long relays
 * speed up so a turn never drags.
 */
export function sowAlong(pits: Element[]): Promise<void> {
  if (!canAnimate() || !pits.length) return Promise.resolve();
  if (!rich()) {
    guarded(pits.at(-1), () =>
      keyframes(
        pits.at(-1),
        { scale: [1, 1.12, 1] },
        { duration: s(200), ease: EASE.out2 },
      ),
    );
    return Promise.resolve();
  }
  const hop = Math.max(0.035, Math.min(0.09, 1.4 / pits.length));
  const seed = document.createElement("span");
  const start = centre(pits[0]!);
  seed.style.cssText = `position:fixed;left:${start.x - 6}px;top:${start.y - 6}px;width:12px;height:12px;border-radius:9999px;pointer-events:none;z-index:50;background:var(--games-scene-accent, var(--cg-accent));box-shadow:0 0 6px rgb(0 0 0 / 0.4);will-change:transform`;
  document.body.appendChild(seed);
  return new Promise<void>((resolve) => {
    const done = () => {
      seed.remove();
      resolve();
    };
    try {
      const tl = gsap.timeline({ onComplete: done });
      for (const pit of pits) {
        const c = centre(pit);
        tl.to(seed, {
          x: c.x - start.x,
          y: c.y - start.y,
          duration: hop,
          ease: EASE.inOut2,
        });
        tl.add(
          keyframes(
            pit,
            { scale: [1, 1.1, 1] },
            { duration: hop * 1.6, ease: EASE.out2 },
          )!,
          "<",
        );
      }
      tl.to(seed, { opacity: 0, scale: 0.4, duration: s(120) });
    } catch {
      settle(pits);
      done();
    }
  });
}

/**
 * Slide a piece that has already been placed on its destination: it starts
 * at `fromRect` and hops through any capture landings to rest in place
 * (a FLIP animation, so the final layout is never animated).
 */
export function slidePiece(
  piece: Element | null | undefined,
  fromRect: DOMRect | null | undefined,
  via: DOMRect[] = [],
): Promise<void> {
  if (!canAnimate() || !piece || !fromRect) return Promise.resolve();
  const end = piece.getBoundingClientRect();
  if (!end.width) return Promise.resolve();
  const offset = (r: DOMRect) => ({
    x: r.left + r.width / 2 - (end.left + end.width / 2),
    y: r.top + r.height / 2 - (end.top + end.height / 2),
  });
  const stops = rich() ? via.map(offset) : [];
  const first = offset(fromRect);
  const legDuration = s(rich() ? 180 : 140);
  return new Promise<void>((resolve) => {
    try {
      const tl = gsap.timeline({ onComplete: () => resolve() });
      tl.set(piece, { x: first.x, y: first.y, zIndex: 5 });
      for (const stop of stops) {
        tl.to(piece, { x: stop.x, y: stop.y, duration: legDuration, ease: EASE.inOut2 });
      }
      tl.to(piece, { x: 0, y: 0, duration: legDuration, ease: EASE.out3 });
      tl.set(piece, { clearProps: "transform,zIndex" });
    } catch {
      settle(piece);
      resolve();
    }
  });
}

/**
 * Captured pieces or seeds pop and fade. Pass detached clones positioned
 * where the captured items were; they are removed afterwards.
 */
export function popCapture(ghosts: HTMLElement[]): Promise<void> {
  const cleanup = () => ghosts.forEach((g) => g.remove());
  if (!canAnimate() || !ghosts.length) {
    cleanup();
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    try {
      gsap.to(ghosts, {
        keyframes: {
          scale: [1, rich() ? 1.25 : 1.1, 0.2],
          opacity: [1, 1, 0],
          easeEach: "none",
        },
        duration: s(rich() ? 420 : 200),
        stagger: s(rich() ? 70 : 0),
        ease: EASE.out3,
        onComplete: () => {
          cleanup();
          resolve();
        },
      });
    } catch {
      cleanup();
      resolve();
    }
  });
}

/** A man crowned king: the crown pops in (rich) or simply appears. */
export function promotePiece(crown: Element | null | undefined) {
  if (!canAnimate() || !crown) return;
  guarded(crown, () =>
    rich()
      ? keyframes(
          crown,
          { scale: [0, 1.35, 1], rotation: [-30, 10, 0], opacity: [0, 1, 1] },
          { duration: s(520), ease: EASE.out4 },
        )
      : gsap.fromTo(crown, { opacity: 0 }, { opacity: 1, duration: s(150) }),
  );
}

/** Ghost copy of an element at its current place (for capture animations). */
export function ghostOf(el: Element | null | undefined): HTMLElement | null {
  if (!el || !isClient()) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const g = el.cloneNode(true) as HTMLElement;
  g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;pointer-events:none;z-index:40;will-change:transform,opacity`;
  document.body.appendChild(g);
  return g;
}
