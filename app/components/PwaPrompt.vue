<script setup lang="ts">
/**
 * PWA prompts: surfaces the @vite-pwa/nuxt `$pwa` lifecycle as small, themed
 * toasts/cards — "offline ready", "new version available → reload", and an
 * "install app" button. `$pwa` is undefined when the PWA is disabled (e.g. dev
 * without devOptions), so everything is guarded.
 */
const { $pwa } = useNuxtApp();
const { $ts } = useI18n();
const toast = useToast();

// One-time "ready to play offline" confirmation.
watch(
  () => $pwa?.offlineReady,
  (ready) => {
    if (ready) {
      toast.add({
        title: $ts("pwa.offlineReady"),
        icon: "i-lucide-wifi-off",
        duration: 4000,
        ui: {
          root: "bg-[var(--games-surface-solid)] ring-2 ring-[var(--games-accent)]/40 text-[var(--games-text)]",
          icon: "text-[var(--games-accent)] size-5",
        },
      });
      $pwa?.cancelPrompt();
    }
  },
);
</script>

<template>
  <div v-if="$pwa">
    <!-- New version available → reload -->
    <Transition name="pwa-pop">
      <div
        v-if="$pwa.needRefresh"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-full pl-4 pr-2 py-2 shadow-2xl"
        :style="{
          background: 'var(--games-surface-solid)',
          border: '1px solid var(--games-border)',
        }"
      >
        <UIcon name="i-lucide-sparkles" :style="{ color: 'var(--games-accent)' }" />
        <span class="text-sm">{{ $ts("pwa.newVersion") }}</span>
        <UButton size="xs" color="primary" @click="$pwa.updateServiceWorker()">
          {{ $ts("pwa.reload") }}
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          @click="$pwa.cancelPrompt()"
        />
      </div>
    </Transition>

    <!-- Install app -->
    <Transition name="pwa-pop">
      <div
        v-if="$pwa.showInstallPrompt && !$pwa.needRefresh"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-3 rounded-full pl-4 pr-2 py-2 shadow-2xl"
        :style="{
          background: 'var(--games-surface-solid)',
          border: '1px solid var(--games-border)',
        }"
      >
        <UIcon name="i-lucide-download" :style="{ color: 'var(--games-accent)' }" />
        <span class="text-sm">{{ $ts("pwa.installPrompt") }}</span>
        <UButton size="xs" color="primary" @click="$pwa.install()">
          {{ $ts("pwa.install") }}
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          @click="$pwa.cancelInstall()"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pwa-pop-enter-active,
.pwa-pop-leave-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.pwa-pop-enter-from,
.pwa-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}
</style>
