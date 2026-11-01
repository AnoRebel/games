/**
 * Appearance on the client: read the stored Crystal Neuo settings into the
 * shared state and keep data-theme in step with light/dark mode.
 */
export default defineNuxtPlugin(() => {
  const appearance = useAppearance();
  const colorMode = useColorMode();
  appearance.load();
  watch(
    () => colorMode.value,
    () => appearance.applyTheme(),
  );
});
