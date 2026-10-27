## ADDED Requirements

### Requirement: Per-room realtime chat
Each room SHALL provide a realtime chat available to seated players and spectators, delivered over the same realtime transport as game state. Messages SHALL show sender identity and a timestamp formatted via date-fns with timezone handling via `@date-fns/tz`.

#### Scenario: Message delivered to room
- **WHEN** a participant sends a chat message in a room
- **THEN** all current participants (players and spectators) SHALL receive it in realtime with sender and timestamp

#### Scenario: Spectator can chat
- **WHEN** a spectator sends a chat message
- **THEN** it SHALL be delivered to the room like any other participant's message

### Requirement: Chat safety and limits
The system SHALL apply basic safeguards to chat: length limits and rate limiting to prevent spam. Messages exceeding limits SHALL be rejected with feedback.

#### Scenario: Rate limit enforced
- **WHEN** a participant sends messages faster than the configured rate limit
- **THEN** the system SHALL throttle or reject the excess messages and inform the sender
