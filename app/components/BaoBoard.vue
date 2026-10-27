<script setup lang="ts">
/**
 * Bao board (4 rows × 8 pits). Each player's two rows are grouped on their
 * side, with the viewer's rows at the bottom. Every pit shows its seed count;
 * the nyumba carries a house marker while it keeps house status. A turn is
 * chosen by narrowing the engine's legal turns: tap a starting pit, then a
 * highlighted direction pit or kichwa entry, then stop/safari if offered.
 * Spectators get the same board read-only.
 */
import { computed, nextTick, ref, watch } from "vue";
import type { Player } from "@card-games/engine-core";
import { NYUMBA, type BaoMove, type BaoState } from "@card-games/game-bao";
import {
  baoCandidates,
  baoCellOf,
  baoLastMove,
  baoPitAt,
  baoTap,
  nextBaoChoice,
  type BaoSelection,
} from "~/utils/boardHints";
import { ghostOf, popCapture, sowAlong } from "~/utils/anim";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const props = defineProps<{
  state: BaoState;
  legalMoves: BaoMove[];
  viewerSeat: number | null;
  interactive: boolean;
  players: Player[];
  t: Translate;
}>();
const emit = defineEmits<{ play: [move: BaoMove] }>();

const mine = computed(() => props.viewerSeat ?? 0);
const other = computed(() => 1 - mine.value);
const legal = computed(() => (props.interactive ? props.legalMoves : []));

const selection = ref<BaoSelection>({ start: null });
const askSafari = ref(false);
watch(
  () => props.state.version,
  () => {
    selection.value = { start: null };
    askSafari.value = false;
  },
);

const candidates = computed(() => baoCandidates(legal.value, selection.value));
const choice = computed(() => nextBaoChoice(candidates.value));
const starts = computed(() => new Set(legal.value.map((m) => m.start)));
const forcedCapture = computed(
  () => legal.value.length > 0 && legal.value.every((m) => m.kind === "capture"),
);
/** Own pits that complete the current step (direction or entry). */
const targets = computed(() => {
  const c = choice.value;
  if (selection.value.start === null) return new Map<number, "direction" | "entry">();
  if (c.kind === "direction")
    return new Map(c.options.map((o) => [o.pit, "direction" as const]));
  if (c.kind === "entry") return new Map(c.options.map((o) => [o.pit, "entry" as const]));
  return new Map<number, "direction" | "entry">();
});
const last = computed(() => baoLastMove(props.state));

function pitAt(row: number, col: number) {
  return baoPitAt(row, col, props.viewerSeat);
}

function onActivate(row: number, col: number) {
  const pit = pitAt(row, col);
  askSafari.value = false;
  if (pit.seat !== mine.value) {
    selection.value = { start: null };
    return;
  }
  const tap = baoTap(legal.value, selection.value, pit.ring);
  if (tap.action === "play") {
    selection.value = { start: null };
    emit("play", tap.move);
  } else if (tap.action === "safari") {
    selection.value = tap.selection;
    askSafari.value = true;
  } else if (tap.action === "select") {
    selection.value = tap.selection;
  } else {
    selection.value = { start: null };
  }
}

function pickSafari(safari: boolean) {
  const move = candidates.value.find((m) => m.safari === safari);
  askSafari.value = false;
  selection.value = { start: null };
  if (move) emit("play", move);
}

// ---- per-pit presentation ----------------------------------------------------

const seeds = (seat: number, ring: number) => props.state.pits[seat]?.[ring] ?? 0;
const isNyumba = (seat: number, ring: number) =>
  ring === NYUMBA && !!props.state.nyumba[seat];

function pitState(seat: number, ring: number): string[] {
  const out: string[] = [];
  const own = seat === mine.value;
  if (own && selection.value.start === ring) out.push("selected");
  else if (own && targets.value.get(ring) === "direction") out.push("direction");
  else if (own && targets.value.get(ring) === "entry") out.push("entry");
  else if (own && selection.value.start === null && starts.value.has(ring))
    out.push("start");
  const l = last.value;
  if (l && l.seat === seat && (l.start === ring || l.end === ring)) out.push("last");
  if (l && l.seat !== seat && l.captured.has(ring)) out.push("captured");
  return out;
}

/** Arrow pointing from the selected pit toward a direction target, on screen. */
function arrowFor(ring: number): string {
  const start = selection.value.start;
  if (start === null) return "";
  const a = baoCellOf(mine.value, start, props.viewerSeat);
  const b = baoCellOf(mine.value, ring, props.viewerSeat);
  if (b.row < a.row) return "↑";
  if (b.row > a.row) return "↓";
  return b.col > a.col ? "→" : "←";
}

function cellName(row: number, col: number): string {
  const t = props.t;
  const { seat, ring } = pitAt(row, col);
  const own = seat === mine.value;
  const front = ring < 8;
  const n = front ? ring + 1 : 16 - ring;
  const rowName = t(front ? "board.frontRow" : "board.backRow");
  const parts = [t(own ? "board.yourPit" : "board.opponentPit", { row: rowName, n })];
  const count = seeds(seat, ring);
  parts.push(
    count === 0
      ? t("board.emptyPit")
      : count === 1
        ? t("board.oneSeed")
        : t("board.seeds", { count }),
  );
  if (isNyumba(seat, ring)) parts.push(t("board.nyumba"));
  const st = pitState(seat, ring);
  if (st.includes("selected")) parts.push(t("board.selected"));
  if (st.includes("direction")) parts.push(t("board.directionTarget"));
  if (st.includes("entry")) parts.push(t("board.entryTarget"));
  if (st.includes("start")) parts.push(t("board.selectable"));
  if (st.includes("last")) parts.push(t("board.lastMove"));
  if (st.includes("captured")) parts.push(t("board.willCapture"));
  return parts.join(", ");
}

// ---- side panels and announcements ------------------------------------------------

const nameOf = (seat: number | null) =>
  props.players.find((p) => p.seat === seat)?.name ?? `${(seat ?? 0) + 1}`;
const learner = computed(() => props.state.variant === "bao-la-kujifunza");

const announcement = computed(() => {
  const t = props.t;
  const m = props.state.lastMove;
  const parts: string[] = [];
  if (m) {
    const n = m.start < 8 ? m.start + 1 : 16 - m.start;
    parts.push(t("board.announceSow", { name: nameOf(m.seat), n }));
    const taken = m.captures.reduce((s, c) => s + c.seeds, 0);
    if (taken === 1) parts.push(t("board.announceCaptureOne", { name: nameOf(m.seat) }));
    else if (taken) {
      parts.push(t("board.announceCapture", { name: nameOf(m.seat), count: taken }));
    }
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

// ---- motion -----------------------------------------------------------------------

const host = ref<HTMLElement | null>(null);
const pitEl = (seat: number, ring: number) =>
  host.value?.querySelector(`[data-seat="${seat}"][data-ring="${ring}"] .bao-pit`) ??
  null;

// Replay each new turn: seeds travel the sown path, captured pits pop. The
// board already shows the final counts, so skipping motion loses nothing.
watch(
  () => props.state.lastMove,
  async (move, previous) => {
    if (!move || move === previous) return;
    await nextTick();
    const sown = move.path
      .flatMap((leg) => leg.pits)
      .map((ring) => pitEl(move.seat, ring))
      .filter((el): el is Element => !!el);
    const ghosts = move.captures
      .map((c) => ghostOf(pitEl(1 - move.seat, c.pit)))
      .filter((g): g is HTMLElement => !!g);
    void popCapture(ghosts);
    void sowAlong(sown);
  },
);

defineExpose({ selection });
</script>

<template>
  <div ref="host" class="games-scene-board space-y-2">
    <div class="bao-side" data-tour="bao-opponent-front">
      <span class="font-semibold truncate">{{ nameOf(other) }}</span>
      <span v-if="!learner" class="bao-chip">{{
        t("board.reserve", { count: state.reserves[other] ?? 0 })
      }}</span>
    </div>

    <p
      v-if="interactive && forcedCapture"
      class="games-board-banner"
      role="status"
      data-testid="forced-capture"
    >
      <span aria-hidden="true">⚔</span> {{ t("board.captureRequired") }}
    </p>
    <p v-if="viewerSeat === null" class="games-board-banner" data-testid="spectating">
      {{ t("board.spectating") }}
    </p>
    <p
      v-if="choice.kind === 'direction' && selection.start !== null"
      class="sr-only"
      role="status"
    >
      {{ t("board.pickDirection") }}
    </p>
    <p
      v-if="choice.kind === 'entry' && selection.start !== null"
      class="games-board-banner"
      role="status"
    >
      {{ t("board.pickEntry") }}
    </p>

    <div data-tour="bao-board">
      <BoardGrid
        :rows="4"
        :cols="8"
        :label="t('board.baoBoard')"
        :cell-name="cellName"
        :interactive="interactive"
        :announcement="announcement"
        :zoom-in-label="t('board.zoomIn')"
        :zoom-out-label="t('board.zoomOut')"
        :max-cell="76"
        @activate="onActivate"
      >
        <template #cell="{ row, col }">
          <div
            class="bao-cell"
            :class="[
              pitAt(row, col).seat === mine ? 'is-own' : 'is-opponent',
              row === 2 ? 'is-divider' : '',
            ]"
            :data-seat="pitAt(row, col).seat"
            :data-ring="pitAt(row, col).ring"
            :data-state="pitState(pitAt(row, col).seat, pitAt(row, col).ring).join(' ')"
          >
            <span class="bao-pit">
              <span class="bao-count" data-testid="seed-count">{{
                seeds(pitAt(row, col).seat, pitAt(row, col).ring) || ""
              }}</span>
              <svg
                v-if="isNyumba(pitAt(row, col).seat, pitAt(row, col).ring)"
                class="bao-nyumba"
                viewBox="0 0 24 24"
                data-testid="nyumba"
                :data-tour="pitAt(row, col).seat === mine ? 'bao-nyumba' : undefined"
                aria-hidden="true"
              >
                <path d="M3 11.5 12 4l9 7.5V20h-6v-5H9v5H3z" />
              </svg>
              <span
                v-if="
                  targets.get(pitAt(row, col).ring) === 'direction' &&
                  pitAt(row, col).seat === mine
                "
                class="bao-target"
                aria-hidden="true"
                >{{ arrowFor(pitAt(row, col).ring) }}</span
              >
              <span
                v-else-if="
                  targets.get(pitAt(row, col).ring) === 'entry' &&
                  pitAt(row, col).seat === mine
                "
                class="bao-target"
                aria-hidden="true"
                >⤓</span
              >
              <span
                v-if="
                  pitState(pitAt(row, col).seat, pitAt(row, col).ring).includes(
                    'captured',
                  )
                "
                class="bao-captured"
                aria-hidden="true"
                >✕</span
              >
            </span>
          </div>
        </template>
      </BoardGrid>
    </div>

    <div
      v-if="askSafari"
      class="games-board-choices"
      role="group"
      :aria-label="t('board.stopOrSafari')"
    >
      <p class="text-sm">{{ t("board.stopOrSafari") }}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="games-board-choice"
          data-testid="choose-stop"
          @click="pickSafari(false)"
        >
          {{ t("board.stop") }}
        </button>
        <button
          type="button"
          class="games-board-choice"
          data-testid="choose-safari"
          @click="pickSafari(true)"
        >
          {{ t("board.safari") }}
        </button>
      </div>
    </div>

    <div class="bao-side" data-tour="bao-own-rows">
      <span class="font-semibold truncate">{{
        viewerSeat === null ? nameOf(mine) : t("board.you")
      }}</span>
      <span v-if="!learner" class="bao-chip" data-tour="bao-reserve">{{
        t("board.reserve", { count: state.reserves[mine] ?? 0 })
      }}</span>
      <span class="bao-chip">{{
        t(state.phase === "kunamua" ? "board.phaseNamua" : "board.phaseMtaji")
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.bao-side {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--games-scene-text, var(--cg-text));
}
.bao-chip {
  border-radius: 9999px;
  padding: 0.1rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--games-scene-surface, var(--cg-surface));
  border: 1px solid var(--games-scene-cell-border, var(--cg-border));
}
.bao-cell {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--games-scene-board-light, oklch(0.62 0.07 60));
}
.bao-cell.is-opponent {
  background: color-mix(
    in oklch,
    var(--games-scene-board-light, oklch(0.62 0.07 60)) 85%,
    black
  );
}
.bao-cell.is-divider {
  box-shadow: inset 0 3px 0 var(--games-scene-cell-border, oklch(0.3 0.04 60));
}
.bao-pit {
  position: relative;
  width: 82%;
  height: 82%;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  background: var(--games-scene-board-dark, oklch(0.4 0.06 55));
  box-shadow: inset 0 3px 6px rgb(0 0 0 / 0.45);
  color: var(--games-scene-text, oklch(0.97 0.01 90));
}
.is-own .bao-pit {
  color: var(--games-scene-own-piece, oklch(0.97 0.01 90));
}
.is-opponent .bao-pit {
  color: var(--games-scene-opponent-piece, oklch(0.9 0.05 60));
}
.bao-count {
  font-weight: 800;
  font-size: calc(var(--games-cell) * 0.36);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.bao-nyumba {
  position: absolute;
  top: 4%;
  right: 4%;
  width: 34%;
  height: 34%;
  fill: var(--games-scene-accent, var(--cg-accent));
}
.bao-target {
  position: absolute;
  bottom: 2%;
  font-weight: 900;
  font-size: calc(var(--games-cell) * 0.32);
  color: var(--games-scene-legal, oklch(0.85 0.17 130));
}
.bao-captured {
  position: absolute;
  top: 0;
  left: 6%;
  font-weight: 900;
  font-size: calc(var(--games-cell) * 0.3);
  color: var(--games-scene-capture, oklch(0.7 0.2 30));
}
[data-state~="start"] .bao-pit {
  outline: 2px dashed var(--games-scene-legal, oklch(0.85 0.17 130));
  outline-offset: 1px;
}
[data-state~="selected"] .bao-pit {
  outline: 3px solid var(--games-scene-accent, var(--cg-accent));
  outline-offset: 1px;
}
[data-state~="direction"] .bao-pit,
[data-state~="entry"] .bao-pit {
  outline: 3px double var(--games-scene-legal, oklch(0.85 0.17 130));
  outline-offset: 1px;
}
[data-state~="last"] .bao-pit {
  box-shadow:
    inset 0 3px 6px rgb(0 0 0 / 0.45),
    0 0 0 2px var(--games-scene-last-move, oklch(0.85 0.12 85));
}
</style>
