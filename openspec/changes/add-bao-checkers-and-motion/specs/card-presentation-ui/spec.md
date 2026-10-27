# Spec Delta

## MODIFIED Requirements

### Requirement: Smooth, memory-light animations
Card and board event animations (deal, play, draw, collect/eat, shuffle, sow, move, capture) SHALL use `@vueuse/motion` for component transitions and the shared orchestrated-event animation layer for sequenced effects. They SHALL be GPU-friendly (transform/opacity based), avoiding layout thrash and heavy per-frame allocation so they remain smooth on mobile. Users SHALL be able to respect reduced-motion preferences.

#### Scenario: Animations use compositor-friendly properties
- **WHEN** a card is dealt or played, or a seed or piece moves
- **THEN** the animation SHALL be driven by transform/opacity via `@vueuse/motion` or the shared event-animation layer rather than animating layout-affecting properties

#### Scenario: Reduced motion respected
- **WHEN** the user's system prefers reduced motion
- **THEN** the UI SHALL minimize or disable non-essential animations

#### Scenario: Existing card animations preserved
- **WHEN** the existing deal, flip, slide, celebrate, and press sequences run after the library migration
- **THEN** they SHALL keep their current timing, easing, and motion-preference gating

### Requirement: Gameplay animation library evaluation
The team SHALL use **GSAP** as the single orchestrated-event animation engine for richer gameplay and event animations beyond the base `@vueuse/motion` transitions, and SHALL keep the decision documented with rationale. The evaluation SHALL record why **Three.js** and **Popmotion** were rejected, weighing bundle size and runtime memory, 2D versus 3D needs, declarative-versus-imperative ergonomics with Vue/Nuxt SSR, timeline/sequencing support, and reduced-motion compatibility. GSAP SHALL integrate behind the existing motion-preset layer so games consume it uniformly, and SHALL NOT regress the compositor-friendly, reduced-motion guarantees.

#### Scenario: Documented decision
- **WHEN** the evaluation is complete
- **THEN** a decision record SHALL name GSAP, state its bundle and memory impact, explain the rejection of Three.js and Popmotion, and describe integration with `@vueuse/motion` and reduced motion

#### Scenario: No regression to performance guarantees
- **WHEN** GSAP drives a gameplay or event animation
- **THEN** the animation SHALL remain GPU/compositor-friendly, honour reduced-motion, and not introduce heavy per-frame allocation on mobile

#### Scenario: One orchestration library
- **WHEN** the migration ships
- **THEN** GSAP SHALL be the only orchestrated-event animation dependency and Anime.js SHALL be removed from the app

#### Scenario: Uniform consumption
- **WHEN** a game needs an orchestrated animation
- **THEN** it SHALL call the shared animation helpers rather than importing GSAP directly in game components

## ADDED Requirements

### Requirement: SSR-safe animation initialization
The animation layer SHALL NOT run or register timelines during server rendering, and SHALL initialize only in the browser. A game SHALL render its final static state when animations are unavailable.

#### Scenario: Server render
- **WHEN** a game page is server-rendered
- **THEN** no animation timeline or browser-only GSAP API SHALL execute

#### Scenario: Animation failure
- **WHEN** the animation layer fails to initialize in the browser
- **THEN** the game SHALL remain playable with static, fully visible elements

### Requirement: Shared board choreography helpers
The animation layer SHALL provide reusable board sequences for seed sowing, piece movement, capture removal, and promotion, in addition to the existing card sequences. These helpers SHALL honour the rich/subtle motion preference and SHALL be usable by every board game.

#### Scenario: Sowing sequence
- **WHEN** a Bao move sows seeds
- **THEN** the shared helper SHALL animate the seeds along the sown path and settle the final counts

#### Scenario: Capture sequence
- **WHEN** a checkers capture is applied
- **THEN** the shared helper SHALL animate the jump path and the removal of captured pieces

#### Scenario: Subtle preference
- **WHEN** the subtle motion preference is active
- **THEN** board helpers SHALL shorten or skip non-essential travel and show the result immediately
