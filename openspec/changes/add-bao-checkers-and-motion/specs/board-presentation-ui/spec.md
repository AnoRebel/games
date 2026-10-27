# Spec Delta

## Purpose

Defines the shared 2D board presentation layer for grid games so Bao and the checkers variants render legibly, accessibly, and smoothly on mobile and desktop without WebGL.

## ADDED Requirements

### Requirement: Shared grid board rendering
The system SHALL provide one shared board presentation layer that renders 4×8, 8×8, and 10×10 grids from a game's declared geometry. Boards SHALL be drawn with 2D DOM/SVG elements and SHALL NOT require canvas, WebGL, or a 3D renderer.

#### Scenario: Bao board
- **WHEN** a Bao game is displayed
- **THEN** the layer SHALL render 4 rows of 8 pits with each player's two rows visually grouped on their side

#### Scenario: Checkers board
- **WHEN** a Drafti, English, or International game is displayed
- **THEN** the layer SHALL render the variant's 8×8 or 10×10 grid with only dark squares playable

#### Scenario: No WebGL dependency
- **WHEN** any board is opened on a device without WebGL
- **THEN** the board SHALL render and remain fully playable

### Requirement: Responsive touch layout
Boards SHALL fit the viewport without horizontal page overflow. Board targets SHALL be at least 24×24 CSS pixels, preferring 44×44 where space permits. A zoomed, pannable board mode SHALL provide 44×44 targets. Other controls SHALL remain at least 44×44. The full board SHALL be visible in fit mode at 360×640.

#### Scenario: Small phone
- **WHEN** a board is opened on a 360×640 viewport
- **THEN** the whole board SHALL be visible in fit mode with at least 24-pixel targets and an accessible zoom control SHALL offer 44-pixel targets with board-local panning

#### Scenario: Desktop scaling
- **WHEN** the same board is opened on a wide viewport
- **THEN** the board SHALL scale up without stretching pieces or clipping labels

#### Scenario: Orientation change
- **WHEN** the device rotates while a game is in progress
- **THEN** the board SHALL reflow to the new viewport without losing selection or game state

### Requirement: Legal move and capture preview
The board SHALL highlight the selected origin and every legal destination, SHALL distinguish captures from quiet moves, and SHALL preview the path and captured pieces of a checkers capture sequence. When capture is compulsory, the board SHALL indicate that only captures are available.

#### Scenario: Quiet move hints
- **WHEN** a player selects a piece or pit with legal quiet moves
- **THEN** the legal destinations SHALL be highlighted and visually distinct from captures

#### Scenario: Capture path preview
- **WHEN** a player selects a checkers piece with legal capture sequences
- **THEN** the board SHALL show the landing squares and captured pieces for each available sequence

#### Scenario: Forced capture indicated
- **WHEN** only capturing moves are legal
- **THEN** the board SHALL mark the capture requirement and SHALL NOT offer quiet-move destinations

#### Scenario: Invalid target
- **WHEN** a player taps a cell that is not a legal destination
- **THEN** the selection SHALL update or clear without submitting a move

### Requirement: Board state legibility
The board SHALL show seed counts for every Bao pit, a distinct nyumba marker, piece type for checkers men and kings, the last move, the active side, and the viewer's own side.

#### Scenario: Pit counts
- **WHEN** a Bao position is displayed
- **THEN** every nonempty pit SHALL show its seed count as readable text

#### Scenario: Nyumba marker
- **WHEN** a nyumba still has house status
- **THEN** the board SHALL mark it distinctly from ordinary pits

#### Scenario: Last move
- **WHEN** a move is applied
- **THEN** the origin and destination of that move SHALL remain visibly marked until the next move

#### Scenario: King distinction
- **WHEN** a checkers piece is a king
- **THEN** the board SHALL distinguish it from a man by more than colour alone

### Requirement: Accessible board interaction
Every cell SHALL expose an accessible name describing its position, contents, and whether it is selectable, selected, or a legal destination. The board SHALL be operable by keyboard, SHALL move focus with arrow keys, SHALL activate with Enter or Space, and SHALL announce moves, captures, promotions, and turn changes to assistive technology.

#### Scenario: Screen-reader description
- **WHEN** a screen reader focuses a cell
- **THEN** it SHALL announce the cell position, its contents, and its current selection or destination state

#### Scenario: Keyboard play
- **WHEN** a keyboard-only player focuses the board
- **THEN** they SHALL be able to reach and activate a legal move using arrow keys and Enter

#### Scenario: Move announcement
- **WHEN** a move, capture, promotion, or turn change occurs
- **THEN** the change SHALL be announced through a polite live region

#### Scenario: Focus preserved
- **WHEN** the board updates after a move
- **THEN** keyboard focus SHALL remain on a sensible cell rather than being lost

### Requirement: Reduced motion and board animation
Board animations SHALL honour reduced-motion preferences, SHALL animate only transform and opacity, and SHALL NOT animate layout-affecting properties. With reduced motion enabled, moves SHALL resolve immediately with no non-essential motion.

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion
- **THEN** seed and piece movement SHALL snap to the final position without transition

#### Scenario: Compositor-only animation
- **WHEN** a seed is sown or a piece is moved
- **THEN** the animation SHALL use transform and opacity rather than width, height, top, or left

#### Scenario: Motion preference
- **WHEN** the user selects the subtle motion preference
- **THEN** only short essential feedback SHALL play and longer board flourishes SHALL be skipped

### Requirement: Read-only spectator presentation
A spectator view SHALL render the same board and move history without offering legal-move hints, selection, or submit controls, and SHALL clearly label the game as spectated.

#### Scenario: Spectator cannot interact
- **WHEN** a spectator opens a board
- **THEN** cells SHALL NOT be selectable and no move SHALL be submitted

#### Scenario: Spectator sees public board
- **WHEN** a spectator views a game
- **THEN** they SHALL see every public board element and SHALL NOT receive hidden information
