# Spec Delta

## Purpose

Defines Bao's board, turn resolution, compulsory captures, nyumba rules, win conditions, and the Bao la Kujifunza learner variant, so every game is refereed deterministically offline and online.

## ADDED Requirements

### Requirement: Board, seating, and terminology
Bao SHALL use a 4×8 board of 32 pits. Each player SHALL own the two rows on their side: a front row nearer the opponent and a back row. The two end pits of a front row SHALL be that player's kichwa, the pits beside them the kimbi, and opposite front-row pits SHALL be paired for capture. A player's nyumba SHALL be the fifth front-row pit from that player's left (fourth from the right).

#### Scenario: Board shape and ownership
- **WHEN** a Bao game is created for two players
- **THEN** the board SHALL have 4 rows of 8 pits, and each player SHALL own exactly 16 pits split into a front row and a back row

#### Scenario: Nyumba and capture pairs
- **WHEN** the initial position is inspected from a player's perspective
- **THEN** that player's nyumba SHALL be the fifth front-row pit from their left, and each of their front-row pits SHALL be paired with the opposite pit in the opponent's front row

### Requirement: Standard setup and reserve seeds
In Bao la Kiswahili each player SHALL start with 32 seeds: 6 in the nyumba, 2 in each of the two pits immediately to the right of the nyumba, and 22 held in reserve. Seat 0 SHALL move first. Reserves SHALL be public information.

#### Scenario: Standard seeding
- **WHEN** a Bao la Kiswahili game starts with default config
- **THEN** each player's nyumba SHALL hold 6 seeds, the two pits to its right SHALL hold 2 seeds each, the reserve SHALL hold 22 seeds, and all other pits SHALL be empty

#### Scenario: Total seed conservation
- **WHEN** the initial position is created
- **THEN** the 32 pits plus both reserves SHALL contain exactly 64 seeds

### Requirement: Sowing and relay
Seeds SHALL be sown one at a time into consecutive pits around the sowing player's own sixteen pits, clockwise or counterclockwise as chosen or required. A sowing SHALL end when its last seed lands in a pit that was empty. If the last seed lands in a pit holding at least two seeds and no capture is triggered, the player SHALL pick up that pit and continue sowing in the same direction (relay).

#### Scenario: Last seed ends the turn
- **WHEN** the last seed of a sowing lands in an empty pit
- **THEN** the turn SHALL end and the turn SHALL pass to the opponent

#### Scenario: Relay from an occupied pit
- **WHEN** the last seed of a sowing lands in a pit that then holds two or more seeds and no capture is triggered
- **THEN** the player SHALL pick up that pit and continue sowing with the next pit in the same direction

#### Scenario: Sowing never leaves the player's side
- **WHEN** seeds are sown around the board
- **THEN** they SHALL only enter pits owned by the sowing player, never the opponent's 16 pits

### Requirement: Compulsory captures
Capture SHALL be compulsory: when a legal capturing turn exists, the player SHALL have no legal non-capturing turn. A capture SHALL occur when sowing ends in an own front-row pit that then holds at least two seeds and is opposite a nonempty opponent front-row pit; every seed in the opposite pit SHALL be captured and immediately sown on the capturing player's side.

#### Scenario: Capture removes the opposite pit
- **WHEN** a sowing ends in a front-row pit opposite a nonempty opponent front-row pit on a capturing turn
- **THEN** all seeds in the opposite pit SHALL be removed and sown on the capturing player's side

#### Scenario: Capture cannot be declined
- **WHEN** a player has at least one legal capture on their turn
- **THEN** every non-capturing move for that player SHALL be rejected as illegal

#### Scenario: No capture after a kutakata start
- **WHEN** a turn begins as a non-capturing (kutakata) turn
- **THEN** no captures SHALL occur during any part of that turn, even if a sowing later ends opposite an occupied opponent pit

### Requirement: Captured-seed entry
Captured seeds SHALL be sown beginning from a kichwa. Seeds captured from a kichwa or kimbi SHALL enter through the kichwa on that same side. Otherwise the player SHALL choose either kichwa for the first capture of a turn, and after a direction is established SHALL use the kichwa that preserves that direction.

#### Scenario: Kichwa capture keeps its side
- **WHEN** a capture is made from a kichwa or kimbi
- **THEN** the captured seeds SHALL enter through the kichwa on that same side

#### Scenario: First capture direction is chosen
- **WHEN** the first capture of a turn is made from a non-kichwa pit and no direction is established
- **THEN** the player SHALL be offered both kichwa entry directions as legal moves

#### Scenario: Repeated captures preserve direction
- **WHEN** a capture occurs after the sowing direction is established and the captured pit is not a kichwa or kimbi
- **THEN** the captured seeds SHALL enter through the kichwa that preserves the current direction

### Requirement: Kunamua phase turns
While reserve seeds remain, each turn SHALL begin by placing one reserve seed into a nonempty pit of the player's front row. If any such placement captures, it SHALL be compulsory. Otherwise the turn SHALL be non-capturing (kutakata) and its starting pit SHALL be chosen in this order: any occupied front-row pit other than a working nyumba; else, when no working nyumba exists, any front-row pit holding at least two seeds; else any occupied front-row pit.

#### Scenario: Reserve seed starts the turn
- **WHEN** a player has reserve seeds at the start of their turn
- **THEN** the turn SHALL begin by placing exactly one reserve seed into a nonempty front-row pit and sowing from that pit

#### Scenario: Capturing placement is forced
- **WHEN** a reserve seed can be placed into a front-row pit opposite a nonempty opponent pit
- **THEN** the player SHALL place it in such a pit, capture the opposite pit, and sow the captured seeds

#### Scenario: Working nyumba cannot start a kutakata turn
- **WHEN** a player's only occupied front-row pit is a working nyumba and no capture is available
- **THEN** the player SHALL have no legal move and SHALL lose

#### Scenario: Reserve exhaustion enters mtaji
- **WHEN** the last reserve seed of the game has been placed and the resulting turn is completed
- **THEN** all later turns SHALL follow mtaji-phase rules

### Requirement: Nyumba special rules
A nyumba SHALL keep house status until its contents are captured or it is picked up and sown, and SHALL be working while it holds at least six seeds. During kunamua, a relay ending in a working nyumba SHALL stop on a kutakata turn; on a capturing turn that ends there without a capture, the player SHALL choose to stop or to safari by picking up the nyumba and continuing the relay. A capture available from the nyumba SHALL take precedence over stopping or safari.

#### Scenario: Stop in a working nyumba
- **WHEN** a kunamua kutakata relay ends in a working nyumba
- **THEN** the turn SHALL stop without picking up the nyumba

#### Scenario: Safari is optional
- **WHEN** a kunamua capturing turn ends in a working nyumba and no capture occurs there
- **THEN** the player SHALL have both a stop move and a safari move available

#### Scenario: Capture beats nyumba stop
- **WHEN** a sowing ends in a working nyumba opposite a nonempty opponent front-row pit on a capturing turn
- **THEN** the capture SHALL occur and the player SHALL NOT be allowed to stop or safari instead

#### Scenario: House status is lost
- **WHEN** a nyumba's contents are captured or the nyumba is picked up and sown
- **THEN** the pit SHALL lose house status permanently

#### Scenario: Nyumba is ordinary during mtaji
- **WHEN** the game is in the mtaji phase
- **THEN** a nyumba SHALL be picked up and sown like an ordinary pit, subject only to ordinary mtaji rules

### Requirement: Mtaji phase turns
When no reserve seeds remain, a turn SHALL begin by choosing an own pit holding at least two seeds and sowing its contents in a chosen direction. A capturing turn SHALL be available only from a pit holding 2 through 15 seeds whose sowing ends in a capture, and if one exists it SHALL be compulsory. A turn from a pit holding 16 or more seeds SHALL always be non-capturing.

#### Scenario: Pit size limits capturing turns
- **WHEN** the only pit that could capture holds 16 or more seeds
- **THEN** the turn SHALL begin as kutakata and SHALL NOT capture

#### Scenario: Compulsory mtaji capture
- **WHEN** a mtaji-phase player has a pit of 2 through 15 seeds whose sowing ends in a capture
- **THEN** the player SHALL have no legal non-capturing move

#### Scenario: Front row preferred when not capturing
- **WHEN** no capture is available and at least one front-row pit holds two or more seeds
- **THEN** the player SHALL begin from a front-row pit and SHALL NOT begin from the back row

#### Scenario: Sole kichwa sows toward the centre
- **WHEN** a player's only occupied front-row pit is a kichwa
- **THEN** the legal non-capturing turn SHALL sow from that kichwa toward the centre along the front row

#### Scenario: Front row may not be empty before a back-row pickup
- **WHEN** a relay would pick up a back-row pit while the player's front row is empty
- **THEN** that move SHALL be illegal

### Requirement: Game end and result
A player SHALL lose when their front row is empty at the end of an opponent's turn, or when they have no legal move at the start of their own turn. A turn SHALL count as infinite, and its player SHALL lose, when more than 192 seeds have been distributed and another ordinary relay pickup would be required. Temporarily emptying one's own front row during a sowing SHALL NOT itself cause a loss.

#### Scenario: Front row emptied
- **WHEN** a turn ends with the opponent's front row completely empty
- **THEN** that opponent SHALL lose and the game SHALL finish

#### Scenario: No legal move at turn start
- **WHEN** a player begins a turn with no legal move
- **THEN** that player SHALL lose and the game SHALL finish

#### Scenario: Infinite turn cutoff
- **WHEN** a turn has distributed more than 192 seeds and another ordinary relay pickup is required
- **THEN** the sowing player SHALL lose the game

#### Scenario: Temporary empty front row
- **WHEN** a player's front row is empty only while that player's own sowing is in progress
- **THEN** the game SHALL NOT end on that basis

### Requirement: Bao la Kujifunza variant
The game SHALL offer two selectable rule variants: `bao-la-kiswahili` as the default and `bao-la-kujifunza` as the learner variant. Bao la Kujifunza SHALL start with two seeds in each of the 32 pits, no reserve seeds, no nyumba, and SHALL begin directly in the mtaji phase. Every other rule SHALL be identical to Bao la Kiswahili.

#### Scenario: Learner setup
- **WHEN** a Bao la Kujifunza game starts
- **THEN** every one of the 32 pits SHALL hold 2 seeds, both reserves SHALL be empty, no pit SHALL be a nyumba, and the game SHALL be in the mtaji phase

#### Scenario: Default variant
- **WHEN** a Bao game is created without an explicit variant
- **THEN** the variant SHALL be `bao-la-kiswahili`

#### Scenario: Learner games terminate
- **WHEN** a Bao la Kujifunza game is played to completion by legal moves
- **THEN** it SHALL finish with a decided winner under the ordinary Bao win conditions

### Requirement: Deterministic and complete move generation
Given the same variant, players, seed, and move sequence, Bao SHALL produce identical states. Legal-move generation SHALL enumerate every legal turn, including every legal starting pit, sowing direction, capture entry choice, and nyumba stop-or-safari choice, and the engine SHALL reject any move outside that set without changing state.

#### Scenario: Identical replay
- **WHEN** the same seed and ordered moves are replayed for either variant
- **THEN** the final states SHALL be deeply equal

#### Scenario: Illegal move leaves state unchanged
- **WHEN** a move that is not in the current legal-move set is submitted
- **THEN** the engine SHALL reject it and the state SHALL remain unchanged

#### Scenario: Every legal capture is enumerated
- **WHEN** a player has capturing turns available
- **THEN** legal-move generation SHALL include each legal capture and SHALL exclude every non-capturing turn
