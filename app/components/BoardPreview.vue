<script setup lang="ts">
/** Small decorative board for the home cards (Bao pits or a checkers corner). */
defineProps<{ kind: "bao" | "checkers" }>();

const baoSeeds = [2, 0, 3, 6, 2, 2, 0, 1, 1, 4, 0, 2, 5, 0, 2, 3];
const checkers = [
  [0, 3, 0, 3],
  [0, 0, 0, 0],
  [1, 0, 2, 0],
  [0, 1, 0, 1],
];
</script>

<template>
  <div aria-hidden="true" class="board-preview" :class="`is-${kind}`">
    <template v-if="kind === 'bao'">
      <span v-for="(n, i) in baoSeeds" :key="i" class="pit">{{ n || "" }}</span>
    </template>
    <template v-else>
      <template v-for="(row, r) in checkers" :key="r">
        <span
          v-for="(p, c) in row"
          :key="`${r}-${c}`"
          class="sq"
          :class="(r + c) % 2 ? 'dark' : 'light'"
        >
          <span v-if="p" class="piece" :class="p === 3 ? 'opp' : 'own'">
            <svg v-if="p === 2" viewBox="0 0 24 24">
              <path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z" />
            </svg>
          </span>
        </span>
      </template>
    </template>
  </div>
</template>

<style scoped>
.board-preview {
  display: grid;
  gap: 3px;
  padding: 5px;
  border-radius: 0.6rem;
  box-shadow: 0 10px 20px -8px rgb(0 0 0 / 0.5);
}
.board-preview.is-bao {
  grid-template-columns: repeat(8, 18px);
  background: oklch(0.55 0.08 60);
}
.pit {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: oklch(0.36 0.06 55);
  box-shadow: inset 0 2px 3px rgb(0 0 0 / 0.5);
  color: oklch(0.96 0.02 90);
  font-size: 9px;
  font-weight: 800;
  display: grid;
  place-items: center;
}
.board-preview.is-checkers {
  grid-template-columns: repeat(4, 26px);
  gap: 0;
  padding: 0;
  overflow: hidden;
}
.sq {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
}
.sq.dark {
  background: oklch(0.42 0.06 150);
}
.sq.light {
  background: oklch(0.88 0.04 90);
}
.piece {
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
}
.piece.own {
  background: oklch(0.95 0.02 90);
  color: oklch(0.3 0.05 30);
}
.piece.opp {
  background: oklch(0.32 0.08 30);
}
.piece svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}
</style>
