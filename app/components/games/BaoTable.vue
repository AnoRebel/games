<script setup lang="ts">
/** Bao table: the shared board-game frame around the Bao board. */
import type { BaseGameState, BaseMove } from "@games/engine-core";
import type { BaoMove, BaoState } from "@games/game-bao";
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
    game-id="bao"
    :can-rematch="canRematch"
    :share-url="shareUrl"
    @restart="emit('restart')"
    @new-game="emit('newGame')"
    @exit="emit('exit')"
  >
    <template #default="{ state, legalMoves, viewerSeat, interactive, players, t, play }">
      <BaoBoard
        :state="state as BaoState"
        :legal-moves="legalMoves as BaoMove[]"
        :viewer-seat="viewerSeat"
        :interactive="interactive"
        :players="players"
        :t="t"
        @play="play"
      />
    </template>
  </BoardTableShell>
</template>
