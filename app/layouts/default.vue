<script setup lang="ts">
const { $ts, $switchLocale, $getLocales, $getLocale, $localePath } = useI18n();
const { isDark, toggle } = useThemeMode();
const settings = useSettingsPanel();
const customize = useCustomizePanel();

const locales = computed(() => $getLocales());
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <!-- Floating glass bar: frosted in glass materials, solid in the others. -->
    <header
      class="sticky z-40 px-2 sm:px-3"
      :style="{ top: 'max(0.5rem, env(safe-area-inset-top))' }"
    >
      <nav
        class="cn-glass games-topbar mx-auto max-w-5xl flex items-center justify-between gap-2"
        :aria-label="$ts('nav.primary')"
      >
        <NuxtLink
          :to="$localePath('/')"
          class="games-brand inline-flex items-center gap-2 no-underline"
        >
          <span class="games-brand__mark" aria-hidden="true">🂡</span>
          <span class="hidden xs:inline">{{ $ts("app.title") }}</span>
        </NuxtLink>

        <div class="flex items-center gap-1">
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
              :aria-label="$ts('common.language')"
            >
              <span class="hidden sm:inline">{{ $getLocale().toUpperCase() }}</span>
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
            variant="outline"
            color="neutral"
            size="sm"
            icon="i-lucide-sliders-horizontal"
            :title="$ts('appearance.customizeHint')"
            :aria-label="$ts('appearance.customize')"
            aria-haspopup="dialog"
            data-testid="open-customize"
            @click="customize.show()"
          >
            <span class="hidden sm:inline">{{ $ts("appearance.customize") }}</span>
          </UButton>
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
      class="flex-1 mx-auto w-full max-w-5xl px-3 pt-5 pb-4"
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
    <AppearanceCustomizer v-model:open="customize.open.value" />
  </div>
</template>

<style scoped>
.games-topbar {
  margin-block-start: 0;
  min-height: calc(var(--size-control-md) + var(--space-3));
  padding-block: var(--space-1);
  padding-inline: var(--space-3);
  border-radius: var(--radius-xl);
}
.games-brand {
  font-family: var(--font-family-display);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--content-primary);
  font-size: var(--type-body-lg);
}
.games-brand__mark {
  display: inline-grid;
  place-items: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  border-radius: var(--radius-sm);
  background: var(--accent-primary-base);
  color: var(--content-on-accent);
  font-size: 1.1rem;
  line-height: 1;
}
</style>
