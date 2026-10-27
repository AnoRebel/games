# card-presentation-ui Specification

## Purpose

Defines the reusable card-rendering and animation layer shared by all games: sprite-based card faces, themed card backs, smooth memory-light animations, the gameplay animation library evaluation, and responsive mobile-friendly layout.

## Requirements

### Requirement: Reusable card rendering
The system SHALL provide a reusable card-rendering component that renders any of the 52 card faces from the `DeckCards.svg` sprite (keyed by rank+suit, e.g. `13c` = King of clubs) and renders card backs from the active theme. The same component SHALL be used by all games.

#### Scenario: Render a specific card face
- **WHEN** the card component is given rank King and suit clubs
- **THEN** it SHALL render the corresponding sprite symbol from `DeckCards.svg`

#### Scenario: Render themed card back
- **WHEN** a card is shown face down
- **THEN** it SHALL render the card back from the currently active theme

### Requirement: Smooth, memory-light animations
Card animations (deal, play, draw, collect/eat, shuffle) SHALL use `@vueuse/motion` and SHALL be GPU-friendly (transform/opacity based), avoiding layout thrash and heavy per-frame allocation so they remain smooth on mobile. Users SHALL be able to respect reduced-motion preferences.

#### Scenario: Animations use compositor-friendly properties
- **WHEN** a card is dealt or played
- **THEN** the animation SHALL be driven by transform/opacity via `@vueuse/motion` rather than animating layout-affecting properties

#### Scenario: Reduced motion respected
- **WHEN** the user's system prefers reduced motion
- **THEN** the UI SHALL minimize or disable non-essential animations

### Requirement: Gameplay animation library evaluation
The team SHALL evaluate **Three.js**, **Anime.js**, and **Popmotion** as the engine for richer gameplay and event animations/interactivity (beyond the base `@vueuse/motion` card transitions), and SHALL document a decision with rationale. The evaluation SHALL weigh: bundle size and runtime memory (the platform requires memory-light, mobile-smooth animation), 2D vs 3D needs for cards, declarative-vs-imperative ergonomics with Vue/Nuxt SSR, timeline/sequencing support for orchestrated events (deal, trick resolution, win celebrations), and reduced-motion compatibility. The chosen approach SHALL integrate behind the existing motion-preset layer so games consume it uniformly, and SHALL NOT regress the compositor-friendly, reduced-motion guarantees.

#### Scenario: Documented decision

- **WHEN** the evaluation is complete
- **THEN** a decision record SHALL state the chosen library (or combination) and why, including bundle/memory impact and how it integrates with `@vueuse/motion` and reduced-motion

#### Scenario: No regression to performance guarantees

- **WHEN** the chosen library is integrated for a gameplay/event animation
- **THEN** the animation SHALL remain GPU/compositor-friendly, honour reduced-motion, and not introduce heavy per-frame allocation on mobile

### Requirement: Responsive layout
Game tables, hands, and controls SHALL be responsive and usable on mobile screens, with touch-friendly interactions and no horizontal overflow.

#### Scenario: Playable on mobile
- **WHEN** a game is opened on a small touch screen
- **THEN** the hand, table, and primary controls SHALL be laid out legibly and be operable by touch
