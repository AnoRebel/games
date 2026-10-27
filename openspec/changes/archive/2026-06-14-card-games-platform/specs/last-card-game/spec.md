## ADDED Requirements

### Requirement: Deck, dealing, and starting discard
Last Card SHALL use a standard 52-card deck. On start it SHALL deal a configurable hand size (default 7, supporting 5) to each of 2–6 players, place the remainder face down as the draw pile, and turn the top card face up as the start of the discard pile. If the turned start card is an action card, the engine SHALL apply the configured start-card rule (default: re-draw a plain card to start).

#### Scenario: Standard deal
- **WHEN** a Last Card game starts with 4 players and default config
- **THEN** each player SHALL hold 7 cards, the discard pile SHALL have exactly 1 face-up card, and the draw pile SHALL hold the remaining cards

### Requirement: Matching and playing
On their turn a player SHALL play a card whose suit or rank matches the top discard card, unless the card is a designated wild/suit-change card. A player unable to play SHALL draw from the draw pile per the configured draw rule (default: draw one; optionally draw-until-playable).

#### Scenario: Matching play allowed
- **WHEN** the top discard is the 7 of hearts and a player holds the 7 of clubs and the 4 of hearts
- **THEN** both the 7 of clubs (rank match) and the 4 of hearts (suit match) SHALL be legal plays

#### Scenario: Forced draw when stuck
- **WHEN** a player has no legal card to play
- **THEN** the engine SHALL require them to draw according to the configured draw rule and pass the turn if still unplayable

### Requirement: Action cards
The system SHALL support configurable action cards. The default ruleset SHALL include: **pickup** cards (e.g. 2 → next player draws 2; configurable 3/4 or 5 variants) that MAY stack when the next player holds a matching pickup card; **skip** cards (e.g. 10) that skip the next player's turn; **suit-change** cards (e.g. Jack or Ace, per variant) that let the player nominate the next suit; and a configurable **reverse** option. Each action card's presence and effect SHALL be toggleable via game config so variants can be selected at room creation.

#### Scenario: Pickup applied
- **WHEN** a player plays a 2 with the pickup rule enabled and the next player cannot or does not stack another pickup card
- **THEN** the next player SHALL draw 2 cards and forfeit their turn

#### Scenario: Pickup stacking
- **WHEN** a 2 is played, stacking is enabled, and the next player plays another 2
- **THEN** the pickup count SHALL accumulate and pass to the following player

#### Scenario: Suit change
- **WHEN** a player plays a suit-change card and nominates clubs
- **THEN** the next required suit SHALL be clubs regardless of the played card's own suit

#### Scenario: Skip
- **WHEN** a player plays a skip card
- **THEN** the next player in turn order SHALL be skipped

### Requirement: "Last Card" call and penalty
When a player plays a card that reduces their hand to one card, they SHALL declare "Last Card". If they fail to declare before the next player acts, the engine SHALL apply the configured penalty (default: draw 2 cards).

#### Scenario: Penalty for missed call
- **WHEN** a player goes down to one card without declaring "Last Card" and the next player begins their turn
- **THEN** the engine SHALL add the configured penalty cards to the offending player's hand

#### Scenario: Valid call avoids penalty
- **WHEN** a player declares "Last Card" as they reduce their hand to one card
- **THEN** no penalty SHALL be applied

### Requirement: Draw pile exhaustion
When the draw pile is empty and a draw is required, the engine SHALL reshuffle the discard pile (except the current top card) into a new draw pile using the seeded PRNG. If no cards remain to reshuffle, the draw SHALL be skipped.

#### Scenario: Reshuffle on empty draw pile
- **WHEN** a draw is required and the draw pile is empty but the discard pile has more than one card
- **THEN** the engine SHALL reshuffle the discards (keeping the top card) into the draw pile and continue

### Requirement: Winning and scoring
A round SHALL end when a player empties their hand; that player wins the round. The engine SHALL compute penalty scores from remaining hands (numbered = face value, face cards = 10, Ace = 1, by default) and SHALL support single-round or cumulative multi-round matches where the lowest cumulative score wins.

#### Scenario: Round win
- **WHEN** a player legally plays their final card (having validly declared "Last Card")
- **THEN** the round SHALL terminate with that player as the winner

#### Scenario: Score tally
- **WHEN** a round ends
- **THEN** each non-winner SHALL be assigned points equal to the configured value of the cards remaining in their hand
