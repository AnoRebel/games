<script setup lang="ts">
// Every page title carries the localized product name ("Bao · Games").
const { $ts } = useI18n();
useHead({
  titleTemplate: (title) => {
    const product = $ts("app.title");
    return title && title !== product ? `${title} · ${product}` : product;
  },
});
</script>

<template>
  <UApp :toaster="{ duration: 4500, position: 'top-center' }">
    <!-- Registers the web manifest link (PWA). -->
    <NuxtPwaManifest />
    <!-- Top progress bar on route navigation, themed to the active accent. -->
    <NuxtLoadingIndicator color="var(--cg-accent)" :height="3" :duration="2000" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PwaPrompt />
  </UApp>
</template>
