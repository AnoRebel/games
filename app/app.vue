<script setup lang="ts">
import { prePaintScript } from "~/vendor/crystal-neuo/runtime";

// Every page title carries the localized product name ("Bao · Games").
const { $ts } = useI18n();
useHead({
  titleTemplate: (title) => {
    const product = $ts("app.title");
    return title && title !== product ? `${title} · ${product}` : product;
  },
  // Stored appearance settings are applied before first paint so there is
  // no flash of the default material.
  script: [
    { innerHTML: prePaintScript, tagPosition: "head", tagPriority: "critical" },
    {
      innerHTML: themePrePaintScript("nuxt-color-mode"),
      tagPosition: "head",
      tagPriority: "critical",
    },
  ],
});

// Server-rendered defaults only: on the client the runtime owns these
// attributes (and useAppearance keeps theme-color on the material's page
// colour), and a client-side head entry would overwrite the stored choice.
if (import.meta.server) {
  useHead({
    meta: [{ name: "theme-color", content: "#eef0f5" }],
    htmlAttrs: {
      "data-material": "refraction",
      "data-platform": "web",
      "data-density": "comfortable",
      "data-theme": "light",
    },
  });
}
</script>

<template>
  <UApp :toaster="{ duration: 4500, position: 'top-center' }">
    <!-- Registers the web manifest link (PWA). -->
    <NuxtPwaManifest />
    <!-- Top progress bar on route navigation, themed to the active accent. -->
    <NuxtLoadingIndicator color="var(--games-accent)" :height="3" :duration="2000" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PwaPrompt />
  </UApp>
</template>
