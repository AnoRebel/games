<script setup lang="ts">
/**
 * Shared 2D board: a CSS grid of square cells for 4×8, 8×8 and 10×10 boards,
 * drawn with plain DOM (no canvas/WebGL).
 *
 * Accessibility: `role="grid"` with rows and gridcells, one roving tab stop,
 * arrow keys / Home / End to move focus, Enter or Space to activate, a name per
 * cell from `cellName`, and a polite live region for move announcements.
 *
 * Sizing: in fit mode cells shrink to fit the available width (never below
 * 24px, preferring 44px); zoom mode uses 44px cells and the board pans inside
 * its own scroll box, so the page never overflows. Focus and selection are
 * preserved across zoom, rotation and state updates because cells are keyed by
 * position.
 */
import { computed, nextTick, ref, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { cellSizeFor } from "~/utils/boardSizing";

const props = withDefaults(
  defineProps<{
    rows: number;
    cols: number;
    /** Accessible name of the whole board. */
    label: string;
    /** Accessible name of one cell (position, contents, state). */
    cellName: (row: number, col: number) => string;
    /** Whether cells can be activated (false for spectators / waiting). */
    interactive?: boolean;
    /** Latest move/turn announcement for screen readers. */
    announcement?: string;
    /** Labels for the zoom control. */
    zoomInLabel?: string;
    zoomOutLabel?: string;
    /** Largest cell size in fit mode (px). */
    maxCell?: number;
  }>(),
  {
    interactive: true,
    announcement: "",
    zoomInLabel: "Zoom in",
    zoomOutLabel: "Fit board",
    maxCell: 72,
  },
);
const emit = defineEmits<{ activate: [row: number, col: number] }>();

// ---- sizing ---------------------------------------------------------------
const frame = ref<HTMLElement | null>(null);
const { width } = useElementSize(frame);
const zoomed = ref(false);
// Before layout (SSR / first paint) assume a small phone's width.
const cellSize = computed(() =>
  cellSizeFor(width.value || 328, props.cols, zoomed.value, props.maxCell),
);

// ---- roving focus ---------------------------------------------------------
const focusRow = ref(0);
const focusCol = ref(0);
const gridEl = ref<HTMLElement | null>(null);

const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));
watch(
  () => [props.rows, props.cols],
  () => {
    focusRow.value = clamp(focusRow.value, props.rows);
    focusCol.value = clamp(focusCol.value, props.cols);
  },
);

function cellEl(row: number, col: number): HTMLElement | null {
  return (
    gridEl.value?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`) ??
    null
  );
}

function moveFocus(row: number, col: number) {
  focusRow.value = clamp(row, props.rows);
  focusCol.value = clamp(col, props.cols);
  void nextTick(() => {
    const el = cellEl(focusRow.value, focusCol.value);
    el?.focus();
    // In zoom mode keep the focused cell inside the pannable viewport.
    if (zoomed.value) el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });
}

function onKeydown(e: KeyboardEvent) {
  const r = focusRow.value;
  const c = focusCol.value;
  switch (e.key) {
    case "ArrowUp":
      moveFocus(r - 1, c);
      break;
    case "ArrowDown":
      moveFocus(r + 1, c);
      break;
    case "ArrowLeft":
      moveFocus(r, c - 1);
      break;
    case "ArrowRight":
      moveFocus(r, c + 1);
      break;
    case "Home":
      moveFocus(r, 0);
      break;
    case "End":
      moveFocus(r, props.cols - 1);
      break;
    case "Enter":
    case " ":
      if (props.interactive) emit("activate", r, c);
      break;
    default:
      return;
  }
  e.preventDefault();
}

function onClick(row: number, col: number) {
  focusRow.value = row;
  focusCol.value = col;
  if (props.interactive) emit("activate", row, col);
}

function toggleZoom() {
  zoomed.value = !zoomed.value;
  // Keep the focused cell (and so the selection context) in view.
  void nextTick(() =>
    cellEl(focusRow.value, focusCol.value)?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    }),
  );
}

defineExpose({ cellSize, zoomed, toggleZoom, focusCell: moveFocus, cellEl });
</script>

<template>
  <div class="games-board w-full">
    <div class="flex justify-end mb-1">
      <button
        type="button"
        class="games-board-zoom"
        :aria-pressed="zoomed"
        :aria-label="zoomed ? zoomOutLabel : zoomInLabel"
        :title="zoomed ? zoomOutLabel : zoomInLabel"
        data-testid="board-zoom"
        @click="toggleZoom"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
          <path v-if="!zoomed" d="M11 8v6M8 11h6" />
          <path v-else d="M8 11h6" />
        </svg>
      </button>
    </div>
    <div
      ref="frame"
      class="games-board-frame"
      :class="zoomed ? 'is-zoomed' : ''"
      data-testid="board-frame"
    >
      <div
        ref="gridEl"
        role="grid"
        :aria-label="label"
        :aria-rowcount="rows"
        :aria-colcount="cols"
        class="games-board-grid"
        :style="{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
          '--games-cell': `${cellSize}px`,
        }"
        @keydown="onKeydown"
      >
        <div v-for="r in rows" :key="`row-${r - 1}`" role="row" class="contents">
          <div
            v-for="c in cols"
            :key="`${r - 1}-${c - 1}`"
            role="gridcell"
            :data-row="r - 1"
            :data-col="c - 1"
            :tabindex="focusRow === r - 1 && focusCol === c - 1 ? 0 : -1"
            :aria-label="cellName(r - 1, c - 1)"
            :aria-disabled="!interactive || undefined"
            class="games-board-cell"
            @click="onClick(r - 1, c - 1)"
            @focus="
              focusRow = r - 1;
              focusCol = c - 1;
            "
          >
            <slot name="cell" :row="r - 1" :col="c - 1" :size="cellSize" />
          </div>
        </div>
      </div>
    </div>
    <div
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
      data-testid="board-announcer"
    >
      {{ announcement }}
    </div>
  </div>
</template>

<style scoped>
.games-board-zoom {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  color: var(--games-scene-text, var(--games-text));
  background: var(--games-surface);
  border: 1px solid var(--games-border);
}
.games-board-zoom:focus-visible {
  outline: 2px solid var(--games-accent);
  outline-offset: 2px;
}
.games-board-frame {
  max-width: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
}
.games-board-frame.is-zoomed {
  /* Board-local panning: the board scrolls inside its frame, never the page. */
  overflow: auto;
  justify-content: flex-start;
  max-height: 70vh;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}
.games-board-grid {
  display: grid;
  width: max-content;
  /* Never squeeze the tracks: in zoom mode the board pans instead. */
  flex-shrink: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--games-scene-cell-border, var(--games-border));
}
.games-board-cell {
  position: relative;
  width: var(--games-cell);
  height: var(--games-cell);
  outline: none;
}
.games-board-cell:focus-visible {
  z-index: 2;
  box-shadow: inset 0 0 0 3px var(--games-scene-accent, var(--games-accent));
}
</style>
