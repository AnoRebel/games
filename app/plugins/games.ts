/**
 * Register all game modules with the engine registry at app startup, so the
 * registry is the single lookup point for game logic (no game-specific imports
 * scattered through the UI).
 */
import { registerLastCard } from "@card-games/game-last-card";
import { registerAlbastini } from "@card-games/game-albastini";
import { registerBao } from "@card-games/game-bao";
import { registerCheckers } from "@card-games/game-checkers";

export default defineNuxtPlugin(() => {
  registerLastCard();
  registerAlbastini();
  registerBao();
  registerCheckers();
});
