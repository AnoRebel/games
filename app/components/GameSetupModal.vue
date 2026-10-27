<script setup lang="ts">
/**
 * Game setup modal — pick offline vs online, players, rule variant, bot
 * difficulty and spectator visibility. Variants and difficulty tiers come from
 * the game's declared metadata, identically for offline and online play.
 * Used from the home cards and the play route so there's no dedicated setup page.
 */
import { getGame } from "@card-games/engine-core";
import {
  type OfflineStart,
  type OnlineStart,
  type SetupSelection,
  hasBots,
  offlineStart,
  onlineStart,
  setupDefaults,
} from "~/utils/setupOptions";

const props = defineProps<{ gameId: string }>();
const open = defineModel<boolean>("open", { default: false });
type SetupConfig = Record<string, unknown> | null;
const emit = defineEmits<{
  startOffline: [OfflineStart];
  startOnline: [OnlineStart];
}>();

const { $ts } = useI18n();
const { name } = usePlayerIdentity();

const meta = computed(() => getGame(props.gameId)?.meta ?? null);
const counts = computed(() => meta.value?.supportedPlayerCounts ?? [2, 3, 4]);
const totalPlayers = ref(2);
const humanCount = ref(1);
const visibility = ref<"public" | "locked">("public");
const mode = ref<"offline" | "online">("offline");
const customId = ref("");
const showOptions = ref(false);
// Online per-turn time limit in seconds (0 = off).
const turnTimeoutSec = ref(0);
// Keep the room alive while empty (off = reaped after a short grace).
const persist = ref(false);
// Cap on concurrent spectators. -1 = none allowed, 0 = unlimited, n>0 = cap.
const maxSpectators = ref(0);

// Declared rule variant + bot difficulty (defaults from the game's metadata).
const selection = ref<SetupSelection>(setupDefaults(null));
// Seats the server fills with bots in an online room.
const botSeats = ref(0);
const withBots = computed(() =>
  hasBots(mode.value, {
    totalPlayers: totalPlayers.value,
    humanCount: humanCount.value,
    botSeats: botSeats.value,
  }),
);

// --- Per-game options. These map straight onto the engine config; unset
// knobs fall back to the game's defaultConfig(). ---------------------------
// Last Card
const lcRounds = ref(1);
const lcHandSize = ref(7);
const lcMultiRank = ref(true);
const lcStacking = ref(true);
const lcCallRequired = ref(true);
// Albastini
const abTeamMode = ref<"individual" | "teams-of-two" | "teams-of-three">("individual");
const abHands = ref(1);
const abBidding = ref(true);

// Team modes only make sense at certain player counts.
type TeamModeItem = {
  label: string;
  value: "individual" | "teams-of-two" | "teams-of-three";
};
const teamModeItems = computed<TeamModeItem[]>(() => {
  const items: TeamModeItem[] = [
    { label: $ts("setup.teamIndividual"), value: "individual" },
  ];
  if (totalPlayers.value % 2 === 0 && totalPlayers.value >= 4)
    items.push({ label: $ts("setup.teamsOfTwo"), value: "teams-of-two" });
  if (totalPlayers.value === 6)
    items.push({ label: $ts("setup.teamsOfThree"), value: "teams-of-three" });
  return items;
});
watch(teamModeItems, (items) => {
  if (!items.some((i) => i.value === abTeamMode.value)) abTeamMode.value = "individual";
});

/** Build the engine config object from the chosen options (or null for defaults). */
function buildConfig(): SetupConfig {
  if (props.gameId === "last-card") {
    return {
      rounds: lcRounds.value,
      handSize: lcHandSize.value,
      allowMultiSameRank: lcMultiRank.value,
      allowPickupStacking: lcStacking.value,
      requireLastCardCall: lcCallRequired.value,
    };
  }
  if (props.gameId === "albastini") {
    return {
      teamMode: abTeamMode.value,
      hands: abHands.value,
      enableBidding: abBidding.value,
    };
  }
  return null;
}

watch(
  meta,
  (m) => {
    if (m) totalPlayers.value = m.supportedPlayerCounts[0] ?? 2;
    selection.value = setupDefaults(m);
  },
  { immediate: true },
);
watch(totalPlayers, (n) => {
  if (humanCount.value > n) humanCount.value = n;
  if (botSeats.value > n - 1) botSeats.value = Math.max(0, n - 1);
});

const title = computed(() => meta.value?.name ?? "Game");
// Online rooms always have options; offline only games with extra knobs do.
const hasOptions = computed(
  () =>
    mode.value === "online" ||
    props.gameId === "last-card" ||
    props.gameId === "albastini",
);
const modalUi = useThemedModalUi();

function start() {
  open.value = false;
  const config = buildConfig();
  if (mode.value === "offline") {
    emit(
      "startOffline",
      offlineStart(
        { totalPlayers: totalPlayers.value, humanCount: humanCount.value },
        config,
        selection.value,
      ),
    );
  } else {
    emit(
      "startOnline",
      onlineStart(
        {
          totalPlayers: totalPlayers.value,
          visibility: visibility.value,
          customId: customId.value.trim() || undefined,
          botSeats: botSeats.value,
          turnTimeoutMs:
            turnTimeoutSec.value > 0 ? turnTimeoutSec.value * 1000 : undefined,
          persist: persist.value || undefined,
          // 0 = unlimited (omit); -1 = none; n>0 = cap.
          maxSpectators: maxSpectators.value !== 0 ? maxSpectators.value : undefined,
        },
        config,
        selection.value,
      ),
    );
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`${$ts('common.play')} ${title}`" :ui="modalUi">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="$ts('common.yourName')" size="sm">
          <UInput v-model="name" size="sm" />
        </UFormField>

        <!-- mode -->
        <UFieldGroup class="w-full">
          <UButton
            class="flex-1 justify-center"
            icon="i-lucide-monitor"
            :variant="mode === 'offline' ? 'solid' : 'outline'"
            color="primary"
            @click="mode = 'offline'"
          >
            {{ $ts("lobby.playOffline") }}
          </UButton>
          <UButton
            class="flex-1 justify-center"
            icon="i-lucide-wifi"
            :variant="mode === 'online' ? 'solid' : 'outline'"
            color="primary"
            @click="mode = 'online'"
          >
            {{ $ts("lobby.playOnline") }}
          </UButton>
        </UFieldGroup>

        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="$ts('common.players')" size="sm">
            <USelect
              v-model="totalPlayers"
              size="sm"
              :items="counts.map((c) => ({ label: `${c}`, value: c }))"
            />
          </UFormField>
          <UFormField v-if="mode === 'offline'" :label="$ts('lobby.humans')" size="sm">
            <USelect
              v-model="humanCount"
              size="sm"
              :items="
                Array.from({ length: totalPlayers }, (_, i) => ({
                  label: `${i + 1}`,
                  value: i + 1,
                }))
              "
            />
          </UFormField>
          <UFormField v-else :label="$ts('lobby.spectators')" size="sm">
            <USelect
              v-model="visibility"
              size="sm"
              :items="[
                { label: $ts('lobby.spectatorPublic'), value: 'public' },
                { label: $ts('lobby.spectatorLocked'), value: 'locked' },
              ]"
            />
          </UFormField>
        </div>

        <UFormField
          v-if="mode === 'online' && totalPlayers > 1"
          :label="$ts('setup.botSeats')"
          :hint="$ts('common.optional')"
          size="sm"
        >
          <USelect
            v-model="botSeats"
            size="sm"
            class="w-full"
            :items="
              Array.from({ length: totalPlayers }, (_, i) => ({
                label: i === 0 ? $ts('setup.botSeatsNone') : `${i}`,
                value: i,
              }))
            "
          />
        </UFormField>

        <!-- Rule variant + bot difficulty, read from the game's declaration -->
        <GameVariantFields
          v-model:variant="selection.variant"
          v-model:difficulty="selection.difficulty"
          :game-id="gameId"
          :with-bots="withBots"
          :t="$ts"
        />

        <UFormField
          v-if="mode === 'online'"
          :label="$ts('lobby.customRoomId')"
          :hint="$ts('common.optional')"
          size="sm"
        >
          <UInput
            v-model="customId"
            size="sm"
            class="w-full"
            :placeholder="$ts('lobby.customRoomIdPlaceholder')"
            icon="i-lucide-hash"
          />
        </UFormField>

        <!-- Game options — collapsible to keep the modal calm -->
        <div
          v-if="hasOptions"
          class="rounded-lg"
          :style="{ border: '1px solid var(--cg-border)' }"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
            :aria-expanded="showOptions"
            @click="showOptions = !showOptions"
          >
            <span class="flex items-center gap-1.5">
              <UIcon name="i-lucide-sliders-horizontal" />
              {{ $ts("setup.gameOptions") }}
            </span>
            <UIcon
              :name="showOptions ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            />
          </button>
          <div
            v-if="showOptions"
            class="px-3 pt-3 pb-3 space-y-3 border-t"
            :style="{ borderColor: 'var(--cg-border)' }"
          >
            <!-- Online-only room options -->
            <template v-if="mode === 'online'">
              <div class="grid grid-cols-2 gap-3">
                <UFormField :label="$ts('setup.turnTimer')" size="sm">
                  <USelect
                    v-model="turnTimeoutSec"
                    size="sm"
                    :items="[
                      { label: $ts('setup.timerOff'), value: 0 },
                      { label: $ts('setup.timerSec', { n: 15 }), value: 15 },
                      { label: $ts('setup.timerSec', { n: 30 }), value: 30 },
                      { label: $ts('setup.timerSec', { n: 60 }), value: 60 },
                    ]"
                  />
                </UFormField>
                <UFormField :label="$ts('setup.maxSpectators')" size="sm">
                  <USelect
                    v-model="maxSpectators"
                    size="sm"
                    :items="[
                      { label: $ts('setup.spectatorsUnlimited'), value: 0 },
                      { label: $ts('setup.spectatorsNone'), value: -1 },
                      ...[2, 5, 10, 25].map((n) => ({ label: `${n}`, value: n })),
                    ]"
                  />
                </UFormField>
              </div>

              <label class="flex items-start gap-2 cursor-pointer">
                <USwitch v-model="persist" size="sm" class="mt-0.5" />
                <span class="text-sm">
                  {{ $ts("setup.persistRoom") }}
                  <span class="block text-xs" :style="{ color: 'var(--cg-text-muted)' }">
                    {{ $ts("setup.persistRoomHint") }}
                  </span>
                </span>
              </label>
            </template>

            <!-- Last Card options -->
            <template v-if="gameId === 'last-card'">
              <div class="grid grid-cols-2 gap-3">
                <UFormField :label="$ts('setup.matchLength')" size="sm">
                  <USelect
                    v-model="lcRounds"
                    size="sm"
                    :items="[
                      { label: $ts('setup.oneRound'), value: 1 },
                      { label: $ts('setup.nRounds', { n: 3 }), value: 3 },
                      { label: $ts('setup.nRounds', { n: 5 }), value: 5 },
                    ]"
                  />
                </UFormField>
                <UFormField :label="$ts('setup.handSize')" size="sm">
                  <USelect
                    v-model="lcHandSize"
                    size="sm"
                    :items="[5, 7, 10].map((c) => ({ label: `${c}`, value: c }))"
                  />
                </UFormField>
              </div>
              <div class="space-y-2">
                <USwitch
                  v-model="lcMultiRank"
                  :label="$ts('setup.multiRank')"
                  size="sm"
                />
                <USwitch
                  v-model="lcStacking"
                  :label="$ts('setup.pickupStacking')"
                  size="sm"
                />
                <USwitch
                  v-model="lcCallRequired"
                  :label="$ts('setup.callRequired')"
                  size="sm"
                />
              </div>
            </template>

            <!-- Albastini options -->
            <template v-else-if="gameId === 'albastini'">
              <UFormField :label="$ts('setup.teamMode')" size="sm">
                <USelect v-model="abTeamMode" size="sm" :items="teamModeItems" />
              </UFormField>
              <div class="grid grid-cols-2 gap-3">
                <UFormField :label="$ts('setup.matchLength')" size="sm">
                  <USelect
                    v-model="abHands"
                    size="sm"
                    :items="[
                      { label: $ts('setup.oneHand'), value: 1 },
                      { label: $ts('setup.nHands', { n: 3 }), value: 3 },
                      { label: $ts('setup.nHands', { n: 5 }), value: 5 },
                    ]"
                  />
                </UFormField>
              </div>
              <USwitch v-model="abBidding" :label="$ts('setup.bidding')" size="sm" />
            </template>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">
          {{ $ts("game.cancel") }}
        </UButton>
        <UButton color="primary" icon="i-lucide-play" @click="start">
          {{ $ts("common.start") }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
