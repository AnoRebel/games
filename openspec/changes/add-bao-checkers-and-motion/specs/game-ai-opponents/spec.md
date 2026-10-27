# Spec Delta

## Purpose

Defines the shared bot-opponent system for Bao and Checkers: three selectable difficulty tiers, deterministic legal play, and a measurable strength ladder so every game is playable offline.

## ADDED Requirements

### Requirement: Difficulty tiers and default
The system SHALL offer three difficulty tiers for Bao and Checkers: `easy`, `normal`, and `hard`, with `normal` as the default. Difficulty SHALL apply per bot-filled seat and SHALL be declared by each game module through the shared engine contract so setup, rooms, and offline play read the same list.

#### Scenario: Default difficulty
- **WHEN** a player starts an offline game without choosing a difficulty
- **THEN** every bot seat SHALL play at `normal`

#### Scenario: Per-seat difficulty
- **WHEN** a player selects `hard` for a game with one bot seat
- **THEN** that bot SHALL use the `hard` policy while human seats remain human-controlled

#### Scenario: Declared by the game module
- **WHEN** the setup UI opens for Bao or Checkers
- **THEN** it SHALL show exactly the difficulties declared by that game module, with `normal` preselected

### Requirement: Deterministic bot decisions
Bot move selection SHALL be deterministic: the same state, seat, difficulty, and seed SHALL always produce the same move. Search budgets SHALL be expressed in plies or evaluated nodes, not wall-clock time. Any tie-break randomness SHALL use the state's seeded PRNG, never ambient randomness.

#### Scenario: Repeated decisions match
- **WHEN** the same bot decision is computed twice from an identical state
- **THEN** both calls SHALL return the same move

#### Scenario: Independent of wall-clock time
- **WHEN** the same decision is computed under different machine loads
- **THEN** the chosen move SHALL be identical

#### Scenario: Decision replay
- **WHEN** a full bot game is replayed from the same seed and difficulty assignment
- **THEN** every move and the final state SHALL be identical

### Requirement: Bot moves are always legal
A bot SHALL return a move drawn from the engine's legal-move set for its seat, or no move when the game is terminal or the seat has no legal move. A bot SHALL NOT mutate state, inspect hidden information, or produce a move the engine later rejects.

#### Scenario: Legal move guarantee
- **WHEN** a bot acts in any reachable state for either game and any difficulty
- **THEN** the returned move SHALL be present in that state's legal-move set

#### Scenario: No move when terminal
- **WHEN** the game is terminal or the bot's seat has no legal move
- **THEN** the bot SHALL return no move rather than an arbitrary fallback

#### Scenario: No illegal move under budget pressure
- **WHEN** a search reaches its node or depth budget before completing
- **THEN** the bot SHALL still return a legal move

### Requirement: Easy policy
The `easy` policy SHALL choose uniformly at random from the seat's legal moves using the seeded PRNG, with no lookahead and no heuristic preference.

#### Scenario: Uniform legal selection
- **WHEN** the easy policy is run repeatedly from one state with different PRNG positions
- **THEN** it SHALL be able to select more than one of the available legal moves

#### Scenario: Easy is weakest
- **WHEN** easy plays a match series against normal on the shipped benchmark
- **THEN** easy SHALL score below normal

### Requirement: Normal policy
The `normal` policy SHALL use a bounded search of at least two plies with a deterministic node budget and a material-and-mobility evaluation appropriate to the game. It SHALL take a forced capture when one exists and SHALL prefer moves that gain material.

#### Scenario: Normal takes a free capture
- **WHEN** a single legal move captures material and no reply can recapture
- **THEN** normal SHALL choose that capture

#### Scenario: Normal looks ahead
- **WHEN** one move loses material to an immediate recapture and another does not
- **THEN** normal SHALL avoid the losing move

#### Scenario: Bounded work
- **WHEN** normal searches a position with many legal moves
- **THEN** it SHALL stop within its declared node budget

### Requirement: Hard policy
The `hard` policy SHALL use alpha-beta search at a depth target deeper than normal with a larger deterministic node budget, plus a stronger evaluation covering material, mobility, king safety, and capture threats. It SHALL complete at least four plies when the node budget allows and SHALL return the best move found so far when the budget truncates the search.

#### Scenario: Hard searches deeper
- **WHEN** normal and hard evaluate the same non-terminal position
- **THEN** hard's search SHALL reach a greater completed depth

#### Scenario: Hard finds a deeper tactic
- **WHEN** a win requires a sacrifice followed by a forced capture two plies deeper than normal searches
- **THEN** hard SHALL choose the winning move

#### Scenario: Truncated search stays legal
- **WHEN** hard exhausts its node budget mid-search
- **THEN** it SHALL return a legal move and SHALL NOT exceed its budget

### Requirement: Measured strength ladder
The system SHALL ship a deterministic benchmark harness of seeded matches for both games. On that suite, `hard` SHALL score at least 60% against `normal`, and `normal` SHALL score at least 65% against `easy`, counting a draw as half a point. The harness SHALL be runnable on demand and in continuous integration.

#### Scenario: Hard beats normal
- **WHEN** the benchmark suite runs hard against normal for Bao and for Checkers
- **THEN** hard's score SHALL be at least 60% in each game

#### Scenario: Normal beats easy
- **WHEN** the benchmark suite runs normal against easy for Bao and for Checkers
- **THEN** normal's score SHALL be at least 65% in each game

#### Scenario: Suite is reproducible
- **WHEN** the benchmark suite is run twice with the same seeds
- **THEN** the results SHALL be identical

### Requirement: Responsive bot play
Bot computation SHALL NOT block player input or freeze the interface. In the browser, search SHALL run off the main thread or in yielding chunks, and bot turns SHALL honour the existing paced bot delay without extending it by the search duration.

#### Scenario: UI stays interactive
- **WHEN** a hard bot is thinking
- **THEN** the player SHALL still be able to open panels and the interface SHALL remain responsive

#### Scenario: Delay excludes search time
- **WHEN** a bot move is computed before the bot delay elapses
- **THEN** the move SHALL be applied after the configured delay rather than after delay plus computation

### Requirement: Offline and online parity
The same difficulty policies SHALL drive bot seats in offline local play and in server-hosted rooms, producing the same move for the same state and difficulty regardless of transport.

#### Scenario: Same decision across transports
- **WHEN** the same state and difficulty are evaluated in offline play and in a room
- **THEN** the chosen move SHALL be identical

#### Scenario: Server fills a bot seat
- **WHEN** a room is started with a seat marked as a bot at a selected difficulty
- **THEN** the server SHALL choose that bot's moves with the same policy used offline

### Requirement: Existing card-game bots unchanged
The difficulty behaviour of Last Card and Albastini SHALL remain unchanged by this change, and their existing bot termination and legality guarantees SHALL continue to hold.

#### Scenario: Card-game regression
- **WHEN** the existing card-game bot suite runs after the change
- **THEN** every difficulty SHALL still drive games to a legal termination with unchanged policy outcomes
