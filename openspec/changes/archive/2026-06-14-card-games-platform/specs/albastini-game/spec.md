## ADDED Requirements

### Requirement: Deck, ranking, and point values
Albastini SHALL use a 36-card deck (standard 52 minus all 2s, 8s, 9s, 10s, and Jokers). Card rank from high to low within a suit SHALL be: Ace, 7, King, Jack, Queen, 6, 5, 4, 3. Card point values SHALL be: Ace = 11, 7 = 10, King = 4, Jack = 3, Queen = 2, and 6/5/4/3 = 0, totalling 120 points in the deck.

#### Scenario: Stripped deck composition
- **WHEN** an Albastini game is created
- **THEN** the deck SHALL contain exactly 36 cards with no 2, 8, 9, 10, or Joker

#### Scenario: Trick ranking honors the 7 above the King
- **WHEN** a trick contains the King and the 7 of the same led (or trump) suit
- **THEN** the 7 SHALL beat the King

### Requirement: Dealing and seating
The system SHALL support 2, 3, 4, or 6 players, with team configurations (partners opposite) for even counts. The dealer SHALL deal 5 cards to each player one at a time and place the remainder face down as the stock.

#### Scenario: Initial deal
- **WHEN** a 4-player Albastini game starts
- **THEN** each player SHALL hold 5 cards and the stock SHALL hold the remaining 16 cards before trump is turned

### Requirement: Bidding (otea) and trump determination
Before trump is revealed, non-dealer (and in team play, non-dealer-team) players MAY each place one face-up bid card, each in a suit different from any prior bid this hand. The dealer SHALL then turn the top stock card face up; its suit SHALL be the trump suit. A bidder whose card matches the trump suit SHALL exchange their bid card for the turned trump indicator; non-matching bid cards SHALL return to hand.

#### Scenario: Bid suits must differ
- **WHEN** one player has already bid a heart card this hand
- **THEN** another player SHALL NOT be allowed to bid another heart card in the same hand

#### Scenario: Matching bid claims the trump card
- **WHEN** the turned trump card is a spade and a player bid a spade
- **THEN** that player SHALL take the trump indicator card and leave their bid card face up

### Requirement: Trick play with no follow-suit obligation
The player to the dealer's right SHALL lead the first trick. Players MAY play any card regardless of suit (no obligation to follow suit). The trick winner SHALL be the highest trump played; if no trump is played, the highest card of the led suit. The trick winner SHALL collect ("eat") the cards and lead the next trick.

#### Scenario: Trump beats led suit
- **WHEN** the led suit is hearts, trump is clubs, and a player plays any club while others follow with hearts
- **THEN** the highest club played SHALL win the trick

#### Scenario: No trump in trick
- **WHEN** a trick contains no trump cards
- **THEN** the highest-ranked card of the led suit SHALL win

### Requirement: Draw to refill
After each trick, while the stock has cards, players SHALL draw to refill to 5 cards, beginning with the trick winner and proceeding in turn order. Once the stock is exhausted, play continues with the cards in hand until all are played.

#### Scenario: Refill order
- **WHEN** a trick ends and the stock is non-empty
- **THEN** the trick winner SHALL draw first, then each other player in turn order, until each is back to 5 cards or the stock is empty

### Requirement: Scoring and victory points
At hand end, each player or team SHALL total the point value of cards eaten. Victory points SHALL be awarded per configuration: individual — 1 VP to the highest scorer if every player ate at least 10, else 2 VP; teams of two — 1 VP if each team ate at least 20, else 2 VP; teams of three — 1 VP if the losing team ate at least 30, else 2 VP. Ties SHALL award 0 VP to all.

#### Scenario: Individual victory points
- **WHEN** an individual hand ends and the lowest-scoring player ate fewer than 10 points
- **THEN** the winner SHALL receive 2 victory points

#### Scenario: Tie yields no victory points
- **WHEN** the top score is tied between players or teams
- **THEN** no victory points SHALL be awarded for that hand
