<script setup lang="ts">
const { $ts, $switchLocale, $getLocales, $getLocale, $localePath } = useI18n();
const { isDark, toggle } = useThemeMode();
const settings = useSettingsPanel();

const locales = computed(() => $getLocales());
</script>

<template>
  <div
    class="min-h-dvh flex flex-col"
    :style="{ background: 'var(--games-bg)', color: 'var(--games-text)' }"
  >
    <header
      class="sticky top-0 z-40 border-b"
      :style="{
        borderColor: 'var(--games-border)',
        background: 'color-mix(in oklch, var(--games-bg) 82%, transparent)',
        backdropFilter: 'blur(10px)',
      }"
    >
      <nav class="mx-auto max-w-5xl px-3 h-12 flex items-center justify-between gap-2">
        <NuxtLink
          :to="$localePath('/')"
          class="font-display font-bold tracking-tight inline-flex items-center gap-1.5"
        >
          <span class="text-lg leading-none">🂡</span>
          <span class="hidden xs:inline">{{ $ts("app.title") }}</span>
        </NuxtLink>

        <div class="flex items-center gap-0.5">
          <UDropdownMenu
            :items="
              locales.map((l) => ({
                label: l.code.toUpperCase(),
                onSelect: () => $switchLocale(l.code),
              }))
            "
          >
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-languages"
              :title="$ts('common.language')"
            >
              {{ $getLocale().toUpperCase() }}
            </UButton>
          </UDropdownMenu>

          <ClientOnly>
            <UButton
              :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
              variant="ghost"
              color="neutral"
              size="sm"
              :title="isDark ? $ts('theme.lightMode') : $ts('theme.darkMode')"
              :aria-label="isDark ? $ts('theme.lightMode') : $ts('theme.darkMode')"
              @click="(e: MouseEvent) => toggle(e)"
            />
            <template #fallback>
              <UButton icon="i-lucide-sun" variant="ghost" color="neutral" size="sm" />
            </template>
          </ClientOnly>
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-lucide-settings"
            :title="$ts('common.settings')"
            :aria-label="$ts('common.settings')"
            @click="settings.show()"
          />
        </div>
      </nav>
    </header>

    <main
      class="flex-1 mx-auto w-full max-w-5xl px-3 py-4"
      :style="{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }"
    >
      <ClientOnly><DataMigrationNotice /></ClientOnly>
      <slot />
    </main>

    <AppFooter />

    <GlobalSettings />
  </div>
</template>
