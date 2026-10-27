# Spec Delta

## Purpose

Defines the checkers family — Tanzanian Drafti, English/American checkers, and International draughts — covering setup, movement, compulsory captures, promotion, draws, and complete legal-move generation.

## ADDED Requirements

### Requirement: Variant catalog and board setup
The game SHALL offer exactly two seats and three selectable rule variants: `drafti` (default, 8×8 with 12 men per side), `english` (8×8 with 12 men per side), and `international` (10×10 with 20 men per side). Only dark squares SHALL be playable. Each side's men SHALL start on the three rows nearest that side for 8×8 and the four rows nearest that side for 10×10, leaving the middle rows empty.

#### Scenario: Drafti starting position
- **WHEN** a Drafti game starts
- **THEN** the board SHALL be 8×8 with 12 men per side on dark squares in the three rows nearest each player, and the middle two rows SHALL be empty

#### Scenario: International starting position
- **WHEN** an International draughts game starts
- **THEN** the board SHALL be 10×10 with 20 men per side on dark squares in the four rows nearest each player, and the middle two rows SHALL be empty

#### Scenario: Default variant
- **WHEN** a checkers game is created without an explicit variant
- **THEN** the variant SHALL be `drafti`

#### Scenario: Two seats only
- **WHEN** a checkers room or offline setup is created
- **THEN** it SHALL allow exactly two players

### Requirement: Man movement
A man SHALL move one square diagonally forward to an empty square. Men SHALL never move backward, in any variant.

#### Scenario: Forward move only
- **WHEN** a man has an empty square diagonally behind it
- **THEN** that square SHALL NOT be a legal non-capturing destination

#### Scenario: Blocked man has no move
- **WHEN** both forward diagonal squares of a man are occupied or off the board
- **THEN** that man SHALL have no non-capturing move

### Requirement: King movement
Kings SHALL move diagonally in both directions. In Drafti and International draughts a king SHALL be flying: it may travel any number of empty squares along a diagonal. In English/American checkers a king SHALL move exactly one square.

#### Scenario: Flying king range
- **WHEN** a Drafti or International king has a clear diagonal
- **THEN** every empty square along that diagonal SHALL be a legal destination up to the first occupied square

#### Scenario: Short king range
- **WHEN** an English/American king is selected
- **THEN** only the immediately adjacent empty diagonal squares SHALL be legal destinations

### Requirement: Compulsory capture
Capture SHALL be compulsory in every variant: when at least one legal capture exists, every non-capturing move SHALL be illegal. In Drafti and English/American the player SHALL be free to choose any legal capture or capture sequence, with no requirement to maximise the number of pieces and no priority for kings. In International draughts the player SHALL capture the maximum number of pieces available in the position, and may choose freely only among sequences that achieve that maximum.

#### Scenario: Non-capturing move rejected when a capture exists
- **WHEN** a player has a legal capture and attempts a non-capturing move
- **THEN** the engine SHALL reject the non-capturing move

#### Scenario: Any path in Drafti
- **WHEN** Drafti offers capture sequences of different lengths
- **THEN** every legal sequence SHALL be available, including the shorter one

#### Scenario: Maximum capture in International
- **WHEN** International offers capture sequences of different lengths
- **THEN** only sequences capturing the maximum number of pieces SHALL be legal

#### Scenario: Man captures a king
- **WHEN** a man is adjacent to an enemy king with an empty landing square beyond it
- **THEN** capturing that king SHALL be legal where the variant's capture direction allows it

### Requirement: Capture direction by variant
In Drafti and English/American, men SHALL capture forward only and kings SHALL capture in both directions. In International draughts, men SHALL capture both forward and backward, and kings SHALL capture in both directions at flying range.

#### Scenario: Drafti man cannot capture backward
- **WHEN** a Drafti man has an enemy piece diagonally behind it with an empty square beyond
- **THEN** that backward capture SHALL NOT be legal

#### Scenario: International man captures backward
- **WHEN** an International man has an enemy piece diagonally behind it with an empty square beyond
- **THEN** that backward capture SHALL be legal

#### Scenario: Flying king capture
- **WHEN** a Drafti or International king has exactly one enemy piece on a diagonal with at least one empty square beyond it
- **THEN** the king SHALL be able to jump it and land on any empty square beyond it before the next occupied square

### Requirement: Multi-capture resolution
A capture sequence SHALL continue while the moving piece has another legal capture from its landing square, and once a sequence is chosen every capture in it SHALL be completed. No piece SHALL be jumped more than once in a sequence. In International draughts, jumped pieces SHALL remain on the board until the whole move ends; in Drafti and English/American they SHALL be removed as jumped.

#### Scenario: Sequence continues
- **WHEN** a capturing piece lands on a square from which another capture is legal
- **THEN** the move SHALL continue with that capture rather than stopping

#### Scenario: Chosen sequence must be completed
- **WHEN** a player selects a capture sequence that has further captures available
- **THEN** the engine SHALL require the whole sequence rather than accepting a partial move

#### Scenario: No double jump of one piece
- **WHEN** a capture sequence would require jumping the same enemy piece twice
- **THEN** that sequence SHALL be illegal

#### Scenario: International removal timing
- **WHEN** an International multi-capture sequence passes over a landing square that only becomes empty after a jumped piece is removed
- **THEN** the jumped pieces SHALL still occupy their squares during the sequence

### Requirement: Promotion timing
A man that ends its move on the opponent's kings row SHALL be promoted to a king. In Drafti and English/American, promotion SHALL end the move immediately, even during a capture sequence. In International draughts, promotion SHALL occur only when the move stops on the kings row; a man that passes over the kings row during a capture SHALL remain a man and SHALL continue capturing as a man.

#### Scenario: Drafti promotion ends the jump
- **WHEN** a Drafti man reaches the kings row as part of a capture sequence
- **THEN** the move SHALL end there and the piece SHALL become a king

#### Scenario: English crowning ends the jump
- **WHEN** an English/American man jumps into the kings row
- **THEN** the move SHALL end there and the piece SHALL be crowned

#### Scenario: International pass-through is not promotion
- **WHEN** an International man passes over the kings row during a capture and continues to another square
- **THEN** it SHALL remain a man

#### Scenario: International stop on kings row promotes
- **WHEN** an International man ends its complete move on the kings row
- **THEN** it SHALL be promoted to a king

### Requirement: Drafti draw rules
A Drafti game SHALL be drawn immediately when each side has exactly one king, or when each side has exactly two kings. With three kings against one king, the stronger side SHALL have 12 of its own moves to win; otherwise the game SHALL be drawn. A position repeating three times with the same side to move SHALL also be drawn.

#### Scenario: One king each
- **WHEN** both sides are reduced to a single king
- **THEN** the game SHALL end as a draw

#### Scenario: Two kings each
- **WHEN** both sides have exactly two kings and nothing else
- **THEN** the game SHALL end as a draw

#### Scenario: Three against one expires
- **WHEN** the stronger side has three kings against one king and has made 12 moves without winning
- **THEN** the game SHALL end as a draw

#### Scenario: Threefold repetition
- **WHEN** the same position with the same side to move occurs for the third time
- **THEN** the game SHALL end as a draw

### Requirement: English/American draw rules
An English/American game SHALL be drawn when the same position with the same side to move occurs for the third time, or when 40 moves by each side have passed without a capture or a man move.

#### Scenario: Forty-move rule
- **WHEN** 40 moves by each side elapse with no capture and no man move
- **THEN** the game SHALL end as a draw

#### Scenario: Threefold repetition in English
- **WHEN** the same position with the same side to move occurs for the third time
- **THEN** the game SHALL end as a draw

### Requirement: International draw rules
An International draughts game SHALL be drawn when the same position with the same side to move occurs for the third time, when 25 consecutive moves contain only king moves with no capture, when a king faces a lone king, or when three kings, two kings and a man, or a king and two men face a lone king and the stronger side has not won within 16 moves by each side.

#### Scenario: King versus king
- **WHEN** each side has exactly one king
- **THEN** the game SHALL end as a draw

#### Scenario: Twenty-five king moves
- **WHEN** 25 consecutive moves contain only king moves and no captures
- **THEN** the game SHALL end as a draw

#### Scenario: Sixteen-move material rule
- **WHEN** the stronger side has three kings, two kings and a man, or a king and two men against a lone king and has not won within 16 moves by each side
- **THEN** the game SHALL end as a draw

### Requirement: Win conditions
A player SHALL win when the opponent has no pieces remaining or no legal move at the start of their turn. The result SHALL be recorded as a win for the surviving side, or as a draw under the applicable draw rule.

#### Scenario: All pieces captured
- **WHEN** a side loses its last piece
- **THEN** the opposing side SHALL win immediately

#### Scenario: No legal move
- **WHEN** a side begins its turn with at least one piece but no legal move
- **THEN** that side SHALL lose

#### Scenario: Draw recorded
- **WHEN** a draw rule triggers
- **THEN** the result SHALL record a draw for both seats rather than a win for either side

### Requirement: Move representation for presentation
Every legal checkers move SHALL expose its origin square, every landing square along the path, every captured piece and its square, and whether the move promotes. This information SHALL be sufficient to preview a capture path and to write a move log without recomputing the rules in the UI.

#### Scenario: Capture path exposed
- **WHEN** legal moves are generated for a multi-capture
- **THEN** the move SHALL list every landing square and every captured square in order

#### Scenario: Promotion flagged
- **WHEN** a legal move ends on the kings row with a man
- **THEN** the move SHALL indicate that it promotes

### Requirement: Deterministic and complete move generation
Given the same variant, players, seed, and move sequence, checkers SHALL produce identical states. Legal-move generation SHALL enumerate every legal move, including every legal capture sequence under the variant's maximal-capture rule, and SHALL reject moves outside that set without changing state.

#### Scenario: Perft starting counts
- **WHEN** legal moves are counted from each variant's starting position
- **THEN** the drafti and english starts SHALL each expose the same standard 8×8 opening move count, and the international start SHALL expose its standard 10×10 opening move count

#### Scenario: Identical replay
- **WHEN** the same seed and ordered moves are replayed for a variant
- **THEN** the final states SHALL be deeply equal

#### Scenario: Illegal move leaves state unchanged
- **WHEN** a move outside the current legal-move set is submitted
- **THEN** the engine SHALL reject it and the state SHALL remain unchanged
