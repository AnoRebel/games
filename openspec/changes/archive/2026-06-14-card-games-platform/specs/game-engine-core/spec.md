## ADDED Requirements

### Requirement: Game module interface
The system SHALL define a single game-module interface that every game implements, exposing at minimum: a unique game id and display metadata, a `createInitialState(config, players, seed)` factory, a pure `reducer(state, move)` that returns the next state, a `getLegalMoves(state, seat)` generator, an `isTerminal(state)` predicate, and a `getScores(state)` resolver. The engine core SHALL be transport-agnostic and UI-agnostic — it MUST NOT import network, DOM, or framework code.

#### Scenario: Registering a game module
- **WHEN** a game module conforming to the interface is registered with the engine core
- **THEN** the engine SHALL expose it by id and be able to create a game instance from it without any game-specific code in the core

#### Scenario: Core stays decoupled
- **WHEN** the engine core package is built or type-checked in isolation
- **THEN** it SHALL compile with no dependency on Conduit, Nitro, Vue, or the DOM

### Requirement: Deterministic state transitions
The reducer SHALL be a pure function: given the same prior state and the same move, it MUST always produce an identical next state, with no side effects and no reliance on wall-clock time or ambient randomness.

#### Scenario: Same input yields same output
- **WHEN** the reducer is applied twice to identical `(state, move)` inputs
- **THEN** both results SHALL be deeply equal

#### Scenario: Replay reconstructs state
- **WHEN** the initial state and the ordered list of applied moves are replayed through the reducer
- **THEN** the resulting state SHALL equal the live state produced by applying those moves incrementally

### Requirement: Seeded randomness
All randomness (shuffling, dealing, tie-breaks) SHALL be driven by an explicit seed carried in state via a seeded PRNG. No game logic SHALL call ambient `Math.random`.

#### Scenario: Identical seed reproduces deal
- **WHEN** two game instances are created with the same seed, players, and config
- **THEN** the initial shuffle and deal SHALL be identical

### Requirement: Legal move validation
The engine SHALL reject any move that is not present in `getLegalMoves` for the acting seat at the current state, leaving state unchanged.

#### Scenario: Illegal move rejected
- **WHEN** a move not in the current legal-move set is submitted
- **THEN** the reducer SHALL reject it and return the prior state unchanged (or signal an error) rather than mutating state

#### Scenario: Out-of-turn move rejected
- **WHEN** a seat that is not the active seat submits a move that requires the turn
- **THEN** the engine SHALL reject the move
