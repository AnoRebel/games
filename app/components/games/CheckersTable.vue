<script setup lang="ts">
/** Checkers table: the shared board-game frame around the checkers board. */
import type { BaseGameState, BaseMove } from "@games/engine-core";
import type { CheckersMove, CheckersState } from "@games/game-checkers";
import type { GameTransport } from "~/transports/types";

defineProps<{
  transport: GameTransport<BaseGameState, BaseMove>;
  canRematch?: boolean;
  shareUrl?: string | null;
}>();
const emit = defineEmits<{ restart: []; newGame: []; exit: [] }>();
</script>

<template>
  <BoardTableShell
    :transport="transport"
    game-id="checkers"
    :can-rematch="canRematch"
    :share-url="shareUrl"
    @restart="emit('restart')"
    @new-game="emit('newGame')"
    @exit="emit('exit')"
  >
    <template #default="{ state, legalMoves, viewerSeat, interactive, players, t, play }">
      <CheckersBoard
        :state="state as CheckersState"
        :legal-moves="legalMoves as CheckersMove[]"
        :viewer-seat="viewerSeat"
        :interactive="interactive"
        :players="players"
        :t="t"
        @play="play"
      />
    </template>
  </BoardTableShell>
</template>
