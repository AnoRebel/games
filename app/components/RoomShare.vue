<script setup lang="ts">
/**
 * Frictionless room invites. Shows a QR for the PLAYER link and, when the room
 * allows watchers, a second tab with a QR for the SPECTATOR link — scanning is
 * the fastest way to hand a room to someone across a table. Native share where
 * supported, copy everywhere.
 */
import { renderSVG } from "uqr";

const props = defineProps<{
  shareUrl: string;
  /** Watch-only link. Omit when the room has no spectator link to hand out. */
  spectatorUrl?: string;
  title?: string;
}>();
const { $ts } = useI18n();
const { track } = useAnalytics();
const { share, isSupported: canShare } = useShare();

type Kind = "player" | "spectator";
const kind = ref<Kind>("player");
// A room with spectators disabled has no second link — don't offer the tab.
const hasSpectator = computed(() => !!props.spectatorUrl);
watch(hasSpectator, (has) => {
  if (!has) kind.value = "player";
});

const activeUrl = computed(() =>
  kind.value === "spectator" && props.spectatorUrl ? props.spectatorUrl : props.shareUrl,
);

const { copy, copied } = useClipboard({ source: () => activeUrl.value });

// QR as an inline SVG data string (no network, no image asset).
const qrSvg = computed(() => {
  if (!activeUrl.value) return "";
  try {
    return renderSVG(activeUrl.value, { border: 2 });
  } catch {
    return "";
  }
});

async function nativeShare() {
  track("share_link_copied", { kind: `native-${kind.value}` });
  try {
    await share({
      title: props.title ?? $ts("app.title"),
      text: $ts("invite.shareText"),
      url: activeUrl.value,
    });
  } catch {
    /* user cancelled */
  }
}
</script>

<template>
  <UPopover>
    <UButton size="xs" variant="soft" color="primary" icon="i-lucide-qr-code">
      {{ $ts("invite.invite") }}
    </UButton>
    <template #content>
      <div class="p-3 space-y-3 w-60 text-center">
        <UFieldGroup v-if="hasSpectator" class="w-full">
          <UButton
            size="xs"
            class="flex-1 justify-center"
            icon="i-lucide-user"
            :variant="kind === 'player' ? 'solid' : 'outline'"
            :color="kind === 'player' ? 'primary' : 'neutral'"
            @click="kind = 'player'"
          >
            {{ $ts("invite.playerLink") }}
          </UButton>
          <UButton
            size="xs"
            class="flex-1 justify-center"
            icon="i-lucide-eye"
            :variant="kind === 'spectator' ? 'solid' : 'outline'"
            :color="kind === 'spectator' ? 'primary' : 'neutral'"
            @click="kind = 'spectator'"
          >
            {{ $ts("invite.spectatorLink") }}
          </UButton>
        </UFieldGroup>

        <p class="text-xs font-medium" :style="{ color: 'var(--cg-text-muted)' }">
          {{ $ts("invite.scanToJoin") }}
        </p>
        <!-- eslint-disable-next-line vue/no-v-html -- our own generated QR SVG, not user input -->
        <div
          class="mx-auto w-40 h-40 rounded-lg overflow-hidden bg-white p-2 [&>svg]:w-full [&>svg]:h-full"
          v-html="qrSvg"
        />
        <div class="flex gap-2">
          <UButton
            v-if="canShare"
            size="xs"
            block
            color="primary"
            icon="i-lucide-share-2"
            @click="nativeShare"
          >
            {{ $ts("invite.share") }}
          </UButton>
          <UButton
            size="xs"
            block
            variant="outline"
            color="neutral"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            @click="copy()"
          >
            {{ copied ? $ts("game.copied") : $ts("invite.copyLink") }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
