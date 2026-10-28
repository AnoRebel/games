# Decision: Gameplay/event animation library

**Status:** Accepted (revised) · **Date:** 2026-10-27 · Supersedes the 2026-06-14
decision that chose Anime.js.

## Context

The platform needs two tiers of animation:

1. **Component transitions** — cards entering a hand, modals, list changes.
2. **Orchestrated event animations** — deal stagger, trick-resolution sweep,
   suit-change flourish, win celebration, and now board choreography for Bao
   and Checkers: seeds travelling along a sowing path, pieces sliding through
   a multi-capture, captured pieces popping, a man being crowned. These are
   sequenced, imperative, and triggered by engine state deltas.

The UI must stay **memory-light and smooth on mobile**, animate only
compositor-friendly properties (transform/opacity), honour
`prefers-reduced-motion` and the in-app rich/subtle motion preference, and
render correctly on the server (Nuxt SSR) where no browser APIs exist.

Board games made the second tier much more demanding: a single Bao turn can
relay through dozens of pits and a draughts capture can chain several jumps,
so sequencing, per-step timing and reliable completion callbacks matter more
than raw size.

## Options

| Library         | Bundle (gzip)             | Model                                             | 2D/3D | Fit                                                                                                                                                                                                                                                      |
| --------------- | ------------------------- | ------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GSAP 3**      | ~28 KB (core, as bundled) | `gsap.to/fromTo/set` + `gsap.timeline`, keyframes | 2D    | **Chosen.** Mature timelines with position parameters for long multi-step sequences (sowing paths, chained jumps), array keyframes, function-based values, reliable `onComplete`, and `gsap.set` for instant snaps.                                      |
| **Anime.js v4** | ~9 KB                     | `animate` + `createTimeline` + `stagger`          | 2D    | Previous choice. Fine for the card sequences, but long board sequences need finer timeline control than we want to hand-roll; replaced so there is one orchestration library.                                                                            |
| **Three.js**    | ~150 KB+ (WebGL)          | Scene graph, imperative                           | 3D    | **Rejected.** Both new games are 2D boards. A WebGL context costs GPU memory on phones, adds a parallel render path, and would still need DOM for accessibility. No gameplay requirement for 3D.                                                         |
| **Popmotion**   | ~5 KB core                | Low-level animate/keyframes                       | 2D    | **Rejected.** Low-level, and no longer developed as a standalone library (its work continues in Motion); `@vueuse/motion` already covers declarative transitions on the same lineage, and it offers no timeline/sequencing model for board choreography. |

## Decision

- **Tier 1 (component transitions):** keep **`@vueuse/motion`** (`v-motion` +
  `motionPresets.ts`). Declarative, integrates with the Vue lifecycle.
- **Tier 2 (orchestrated events):** **GSAP**, wrapped in `app/utils/anim.ts`.
  The existing helpers keep their signatures, timing and easing (`dealIn`,
  `playCard`, `sweepTo`, `suitFlourish`, `celebrate`, `press`, `floatLoop`,
  `tilt`, `flyCard`, `shuffle`, `crossFade`, `confetti`, `loseShake`, `burst`)
  and the board helpers are added: `sowAlong`, `slidePiece`, `popCapture`,
  `promotePiece`. Game components call these helpers, never GSAP directly.
- **Page-root theme transition:** the **View Transitions API** (circular/iris/fade
  reveal) for dark/light mode; the GSAP `crossFade` is the fallback where View
  Transitions are unsupported.
- **Anime.js** is removed from the app.

## Bundle and memory impact

Measured on the production build:

- GSAP's client chunk: 74.9 KB raw / 28.5 KB gzip.
- Total client JS: 1377.0 → 1413.6 KB raw, 425.5 → 438.9 KB gzip (+13.4 KB
  gzip), net of removing Anime.js and adding the board helpers.

GSAP keeps one shared ticker on `requestAnimationFrame`; helpers create
short-lived tweens that are released when they finish, and temporary elements
(travelling seeds, capture copies, confetti) are removed in their completion
callbacks. No WebGL context or canvas is created.

## Guarantees preserved

- **Reduced motion:** every helper checks `prefers-reduced-motion` and shows the
  final state at once (no tween is created).
- **Subtle motion:** flourishes (confetti, bursts, tilt, suit spin, long sowing
  travel, capture-path hops) are skipped or shortened; essential feedback stays.
- **Compositor-friendly:** only transform (x/y/scale/rotation) and opacity are
  animated, plus the existing saturate filter on the loss shake. Board moves
  are FLIP animations of an element already in its final place, so layout is
  never animated.
- **SSR-safe:** helpers do nothing on the server; GSAP is only used in the
  browser, and boards render their full static state server-side.
- **Failure-safe:** if an animation throws, the element is left in its final,
  fully visible state so the game stays playable.

These are covered by `test/anim.component.test.ts` (gating, timing, fallback)
and `test/ssr-board.test.ts` (server rendering).
