<script setup lang="ts">
/**
 * Floating chat — draggable (move via header) and resizable (CSS resize handle).
 * Minimizable to a bubble with an unread-message badge. Position/size persist.
 */
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { useDraggable } from "@vueuse/core";
import type { GameTransport } from "~/transports/types";
import type { WsTransport } from "~/transports/WsTransport";

const props = defineProps<{ transport: GameTransport; name: string }>();

const session = useGameSession(props.transport);
// Stable local identity → local hotseat chat is attributed to the device owner,
// not the rotating active seat. (Online ignores this; the server attributes it.)
const { id: localId, name: localName } = usePlayerIdentity();

// --- Voice chat (online only) ---------------------------------------------
// Offline/local play has no voice; the composable only spins up when enabled.
const isOnline = computed(() => props.transport.mode === "online");
const ws = computed(() =>
  isOnline.value ? (props.transport as unknown as WsTransport<never, never>) : null,
);
const voice = useVoiceChat({
  roomId: () => ws.value?.roomId ?? "",
  peerId: localId.value || "anon",
  name: () => props.name || localName.value,
  enabled: isOnline,
});
const draft = ref("");
const open = ref(false);
const unread = ref(0);
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const listRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

// Persisted panel position (bottom-right by default via initialValue).
const stored = useLocalStorage("games:chat-pos", { x: -1, y: -1 });
const initial =
  import.meta.client && stored.value.x >= 0
    ? { x: stored.value.x, y: stored.value.y }
    : { x: 0, y: 0 };

const { x, y, style } = useDraggable(panelRef, {
  handle: handleRef,
  initialValue: initial,
  preventDefault: true,
  onEnd: () => {
    stored.value = { x: x.value, y: y.value };
  },
});
const positioned = computed(() => stored.value.x >= 0);

watch(
  () => session.chat.value.length,
  (n, prev) => {
    if (!open.value && n > (prev ?? 0)) unread.value += n - (prev ?? 0);
    if (open.value) nextTick(scrollToEnd);
  },
);
watch(open, (o) => {
  if (o) {
    unread.value = 0;
    nextTick(scrollToEnd);
  }
});

function scrollToEnd() {
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
}
async function send() {
  const body = draft.value.trim();
  if (!body) return;
  const res = await session.sendChat(body, {
    id: localId.value,
    name: props.name || localName.value,
  });
  if (res.ok) draft.value = "";
}
function time(iso: string) {
  try {
    return format(new TZDate(iso, tz), "HH:mm");
  } catch {
    return "";
  }
}
</script>

<template>
  <div>
    <!-- Panel (draggable + resizable) -->
    <Transition name="chat-pop">
      <div
        v-if="open"
        ref="panelRef"
        class="fixed z-50 rounded-2xl overflow-hidden shadow-2xl flex flex-col resize"
        :class="positioned ? '' : 'bottom-4 right-4'"
        :style="[
          positioned ? style : {},
          {
            background: 'var(--games-surface-solid)',
            border: '1px solid var(--games-border)',
            width: '20rem',
            height: '24rem',
            minWidth: '14rem',
            minHeight: '12rem',
            maxWidth: '90vw',
            maxHeight: '80vh',
          },
        ]"
      >
        <div
          ref="handleRef"
          class="flex items-center justify-between px-3 py-2 border-b text-sm font-semibold cursor-move select-none"
          :style="{ borderColor: 'var(--games-border)' }"
        >
          <span class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-grip-horizontal"
              :style="{ color: 'var(--games-text-muted)' }"
            />
            {{ $ts("chat.title") }}
          </span>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-minus"
            :title="$ts('chat.minimize')"
            @click="open = false"
          />
        </div>

        <!-- Voice (online rooms only) -->
        <div
          v-if="isOnline"
          class="px-3 py-2 border-b space-y-2"
          :style="{ borderColor: 'var(--games-border)' }"
        >
          <div class="flex items-center gap-1.5">
            <UButton
              v-if="!voice.inVoice.value"
              size="xs"
              color="primary"
              icon="i-lucide-phone"
              :label="$ts('voice.join')"
              @click="voice.join()"
            />
            <template v-else>
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-phone-off"
                :label="$ts('voice.leave')"
                @click="voice.leave()"
              />
              <UTooltip
                :text="voice.muted.value ? $ts('voice.unmute') : $ts('voice.mute')"
              >
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :icon="voice.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
                  :aria-label="
                    voice.muted.value ? $ts('voice.unmute') : $ts('voice.mute')
                  "
                  @click="voice.toggleMute()"
                />
              </UTooltip>
              <span
                v-if="voice.state.value === 'connecting'"
                class="text-xs"
                :style="{ color: 'var(--games-text-muted)' }"
              >
                {{ $ts("voice.connecting") }}
              </span>
              <span
                v-else
                class="text-xs ml-auto"
                :style="{ color: 'var(--games-text-muted)' }"
              >
                {{ $ts("voice.inVoice", { count: voice.peers.value.length + 1 }) }}
              </span>
            </template>
          </div>

          <p v-if="voice.error.value" class="text-xs text-red-500">
            {{
              voice.error.value === "micDenied"
                ? $ts("voice.micDenied")
                : $ts("voice.unsupported")
            }}
          </p>

          <ul v-if="voice.inVoice.value && voice.peers.value.length" class="space-y-1">
            <li
              v-for="p in voice.peers.value"
              :key="p.peerId"
              class="flex items-center gap-1.5 text-xs"
            >
              <span
                class="inline-block w-2 h-2 rounded-full transition-all"
                :class="p.speaking ? 'voice-pulse' : ''"
                :style="{
                  background: p.speaking
                    ? 'var(--games-accent)'
                    : 'var(--games-text-muted)',
                  opacity: p.speaking ? 1 : 0.4,
                }"
                :title="p.speaking ? $ts('voice.speaking') : ''"
              />
              <UIcon
                name="i-lucide-volume-2"
                class="shrink-0"
                :style="{ color: 'var(--games-text-muted)' }"
              />
              <span class="truncate">{{ p.name }}</span>
            </li>
          </ul>
        </div>

        <div
          ref="listRef"
          class="flex-1 overflow-y-auto p-3 space-y-1.5 text-sm"
          data-tour="chat"
        >
          <p
            v-if="!session.chat.value.length"
            :style="{ color: 'var(--games-text-muted)' }"
          >
            {{ $ts("chat.empty") }}
          </p>
          <div v-for="m in session.chat.value" :key="m.id" class="flex gap-2">
            <span
              class="text-xs shrink-0 tabular-nums"
              :style="{ color: 'var(--games-text-muted)' }"
            >
              {{ time(m.at) }}
            </span>
            <span
              ><span class="font-medium">{{ m.senderName }}:</span> {{ m.body }}</span
            >
          </div>
        </div>

        <form
          class="flex gap-1.5 p-2 border-t"
          :style="{ borderColor: 'var(--games-border)' }"
          @submit.prevent="send"
        >
          <UInput
            v-model="draft"
            :placeholder="$ts('chat.placeholder')"
            size="sm"
            class="flex-1"
            :maxlength="500"
          />
          <UButton
            type="submit"
            size="sm"
            icon="i-lucide-send"
            :disabled="!draft.trim()"
            :title="$ts('chat.send')"
          />
        </form>

        <!-- visible resize affordance (the panel itself is CSS-resizable) -->
        <span
          class="pointer-events-none absolute bottom-1 right-1 opacity-50"
          :style="{ color: 'var(--games-text-muted)' }"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-move-diagonal-2" class="size-3.5" />
        </span>
      </div>
    </Transition>

    <!-- Bubble -->
    <button
      v-if="!open"
      type="button"
      class="fixed z-50 grid place-items-center w-12 h-12 rounded-full shadow-xl transition hover:scale-105"
      :style="{
        background: 'var(--games-accent)',
        color: 'var(--games-accent-contrast)',
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
      }"
      :title="$ts('chat.title')"
      @click="open = true"
    >
      <UIcon name="i-lucide-message-circle" class="text-xl" />
      <span
        v-if="unread"
        class="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[11px] font-bold"
      >
        {{ unread > 9 ? "9+" : unread }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: bottom right;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(8px);
}
.voice-pulse {
  animation: voice-pulse 1s ease-in-out infinite;
}
@keyframes voice-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--games-accent);
  }
  50% {
    transform: scale(1.3);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--games-accent) 30%, transparent);
  }
}
</style>
