<script setup lang="ts">
/**
 * Checkers board for every variant (8×8 and 10×10). Shows men and kings (a
 * crown glyph, not just colour), legal origins and destinations, capture
 * paths with the pieces they take, forced-capture state and the last move.
 * The viewer's side is always at the bottom. Every hint comes from the
 * engine's legal moves; spectators get the same board read-only.
 */
import { computed, ref, watch } from "vue";
import {
  isDark,
  isKing,
  moveNotation,
  ownerOf,
  squareNumber,
  type CheckersMove,
  type CheckersState,
} from "@card-games/game-checkers";
import type { Player } from "@card-games/engine-core";
import {
  checkersHints,
  checkersLastMove,
  checkersSquare,
  checkersTap,
} from "~/utils/boardHints";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const props = defineProps<{
  state: CheckersState;
  legalMoves: CheckersMove[];
  /** The viewer's seat; null for spectators. */
  viewerSeat: number | null;
  /** Whether the viewer may move now. */
  interactive: boolean;
  players: Player[];
  t: Translate;
}>();
const emit = defineEmits<{ play: [move: CheckersMove] }>();

const size = computed(() => props.state.size);
const flipped = computed(() => props.viewerSeat === 1);
const mine = computed(() => props.viewerSeat ?? 0);
const legal = computed(() => (props.interactive ? props.legalMoves : []));

const selected = ref<number | null>(null);
const choosing = ref<CheckersMove[] | null>(null);
// A new position invalidates any half-made selection.
watch(
  () => props.state.version,
  () => {
    selected.value = null;
    choosing.value = null;
  },
);

const hints = computed(() => checkersHints(legal.value, selected.value));
const last = computed(() => checkersLastMove(props.state.lastMove));

const square = (row: number, col: number) =>
  checkersSquare(size.value, row, col, flipped.value);

function onActivate(row: number, col: number) {
  const sq = square(row, col);
  const tap = checkersTap(legal.value, selected.value, sq);
  choosing.value = null;
  if (tap.action === "play") {
    selected.value = null;
    emit("play", tap.move);
  } else if (tap.action === "choose") {
    choosing.value = tap.moves;
  } else if (tap.action === "select") {
    selected.value = tap.square;
  } else {
    selected.value = null;
  }
}

function choose(move: CheckersMove) {
  choosing.value = null;
  selected.value = null;
  emit("play", move);
}

// ---- per-cell presentation --------------------------------------------------

function pieceOf(sq: number) {
  const v = props.state.board[sq] ?? 0;
  const owner = ownerOf(v);
  if (owner === null) return null;
  return { owner, king: isKing(v), own: owner === mine.value };
}

function cellName(row: number, col: number): string {
  const t = props.t;
  const sq = square(row, col);
  if (!isDark(size.value, sq)) return t("board.lightSquare");
  const parts = [t("board.square", { n: squareNumber(size.value, sq) ?? 0 })];
  const p = pieceOf(sq);
  if (!p) parts.push(t("board.emptySquare"));
  else if (props.viewerSeat === null)
    parts.push(
      t(
        p.owner === 0
          ? p.king
            ? "board.lightKing"
            : "board.lightMan"
          : p.king
            ? "board.darkKing"
            : "board.darkMan",
      ),
    );
  else
    parts.push(
      t(
        p.own
          ? p.king
            ? "board.yourKing"
            : "board.yourMan"
          : p.king
            ? "board.opponentKing"
            : "board.opponentMan",
      ),
    );
  const h = hints.value;
  if (selected.value === sq) parts.push(t("board.selected"));
  else if (h.destinations.has(sq))
    parts.push(
      t(h.captureDestinations.has(sq) ? "board.captureDestination" : "board.destination"),
    );
  else if (h.origins.has(sq) && selected.value === null)
    parts.push(t("board.selectable"));
  if (h.landings.has(sq)) parts.push(t("board.landing"));
  if (h.captured.has(sq)) parts.push(t("board.willCapture"));
  if (last.value.from === sq || last.value.to === sq) parts.push(t("board.lastMove"));
  return parts.join(", ");
}

// ---- announcements ------------------------------------------------------------

const nameOf = (seat: number | null) =>
  props.players.find((p) => p.seat === seat)?.name ?? `${(seat ?? 0) + 1}`;
const announcement = computed(() => {
  const t = props.t;
  const m = props.state.lastMove;
  const parts: string[] = [];
  if (m) {
    parts.push(
      t("board.announceMove", {
        name: nameOf(m.seat),
        move: moveNotation(size.value, m),
      }),
    );
    if (m.captures.length)
      parts.push(t("board.announceJumps", { count: m.captures.length }));
    if (m.promotes) parts.push(t("board.announcePromote"));
  }
  const active = props.state.activeSeat;
  if (active !== null && props.state.phase !== "finished") {
    parts.push(
      active === props.viewerSeat
        ? t("board.announceYourTurn")
        : t("board.announceTheirTurn", { name: nameOf(active) }),
    );
  }
  return parts.join(" ");
});

defineExpose({ selected });
</script>

<template>
  <div class="games-scene-board space-y-2" data-tour="checkers-board">
    <p
      v-if="interactive && hints.forcedCapture"
      class="games-board-banner"
      role="status"
      data-tour="checkers-capture"
      data-testid="forced-capture"
    >
      <span aria-hidden="true">⚔</span> {{ t("board.captureRequired") }}
    </p>
    <p v-if="viewerSeat === null" class="games-board-banner" data-testid="spectating">
      {{ t("board.spectating") }}
    </p>

    <BoardGrid
      :rows="size"
      :cols="size"
      :label="t('board.checkersBoard')"
      :cell-name="cellName"
      :interactive="interactive"
      :announcement="announcement"
      :zoom-in-label="t('board.zoomIn')"
      :zoom-out-label="t('board.zoomOut')"
      @activate="onActivate"
    >
      <template #cell="{ row, col }">
        <div
          class="checkers-square"
          :class="isDark(size, square(row, col)) ? 'is-dark' : 'is-light'"
          :data-square="square(row, col)"
          :data-state="
            [
              selected === square(row, col) ? 'selected' : '',
              hints.destinations.has(square(row, col))
                ? hints.captureDestinations.has(square(row, col))
                  ? 'capture-destination'
                  : 'destination'
                : '',
              hints.origins.has(square(row, col)) && selected === null ? 'origin' : '',
              hints.landings.has(square(row, col)) ? 'landing' : '',
              hints.captured.has(square(row, col)) ? 'captured' : '',
              last.from === square(row, col) || last.to === square(row, col)
                ? 'last'
                : '',
            ]
              .filter(Boolean)
              .join(' ')
          "
        >
          <span
            v-if="last.from === square(row, col) || last.to === square(row, col)"
            class="marker-last"
            aria-hidden="true"
          />
          <span
            v-if="pieceOf(square(row, col))"
            class="checkers-piece"
            :class="[
              pieceOf(square(row, col))!.own ? 'is-own' : 'is-opponent',
              pieceOf(square(row, col))!.king ? 'is-king' : 'is-man',
            ]"
            :data-piece="pieceOf(square(row, col))!.king ? 'king' : 'man'"
            aria-hidden="true"
          >
            <svg
              v-if="pieceOf(square(row, col))!.king"
              class="crown"
              viewBox="0 0 24 24"
              data-testid="crown"
            >
              <path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z" />
            </svg>
          </span>
          <span
            v-if="hints.captured.has(square(row, col))"
            class="marker-captured"
            aria-hidden="true"
            >✕</span
          >
          <span
            v-if="hints.landings.has(square(row, col))"
            class="marker-landing"
            aria-hidden="true"
          />
          <span
            v-if="hints.destinations.has(square(row, col))"
            :class="
              hints.captureDestinations.has(square(row, col))
                ? 'marker-capture'
                : 'marker-move'
            "
            aria-hidden="true"
          />
        </div>
      </template>
    </BoardGrid>

    <div
      v-if="choosing"
      class="games-board-choices"
      role="group"
      :aria-label="t('board.chooseCapture')"
    >
      <p class="text-sm">{{ t("board.chooseCapture") }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in choosing"
          :key="m.path.join('-')"
          type="button"
          class="games-board-choice"
          @click="choose(m)"
        >
          {{ moveNotation(size, m) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkers-square {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.checkers-square.is-dark {
  background: var(--games-scene-board-dark, oklch(0.42 0.06 150));
}
.checkers-square.is-light {
  background: var(--games-scene-board-light, oklch(0.88 0.04 90));
}
.checkers-piece {
  position: relative;
  width: 78%;
  height: 78%;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  box-shadow:
    inset 0 -3px 0 rgb(0 0 0 / 0.25),
    0 2px 4px rgb(0 0 0 / 0.35);
}
.checkers-piece.is-own {
  background: var(--games-scene-own-piece, oklch(0.95 0.02 90));
  color: var(--games-scene-opponent-piece, oklch(0.25 0.02 30));
}
.checkers-piece.is-opponent {
  background: var(--games-scene-opponent-piece, oklch(0.32 0.08 30));
  color: var(--games-scene-own-piece, oklch(0.95 0.02 90));
}
.crown {
  width: 58%;
  height: 58%;
  fill: currentColor;
}
.games-board-cell[aria-disabled] .checkers-square {
  cursor: default;
}
[data-state~="origin"] .checkers-piece {
  outline: 2px dashed var(--games-scene-accent, var(--cg-accent));
  outline-offset: 1px;
}
[data-state~="selected"] .checkers-piece {
  outline: 3px solid var(--games-scene-accent, var(--cg-accent));
  outline-offset: 1px;
}
.marker-move {
  position: absolute;
  width: 30%;
  height: 30%;
  border-radius: 9999px;
  background: var(--games-scene-legal, oklch(0.85 0.17 130));
  box-shadow: 0 0 0 2px rgb(0 0 0 / 0.35);
}
.marker-capture {
  position: absolute;
  inset: 12%;
  border: 3px solid var(--games-scene-capture, oklch(0.7 0.2 30));
  transform: rotate(45deg);
  border-radius: 0.2rem;
}
.marker-landing {
  position: absolute;
  width: 20%;
  height: 20%;
  transform: rotate(45deg);
  background: var(--games-scene-capture, oklch(0.7 0.2 30));
}
.marker-captured {
  position: absolute;
  font-weight: 800;
  font-size: calc(var(--games-cell) * 0.5);
  line-height: 1;
  color: var(--games-scene-capture, oklch(0.7 0.2 30));
  text-shadow: 0 0 3px rgb(0 0 0 / 0.8);
}
.marker-last {
  position: absolute;
  inset: 3px;
  border: 2px dashed var(--games-scene-last-move, oklch(0.85 0.12 85));
  border-radius: 0.25rem;
}
</style>
