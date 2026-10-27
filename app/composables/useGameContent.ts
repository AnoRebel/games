/**
 * Per-game learnability content for the active locale and rule variant.
 * Content switches as soon as the locale or variant changes.
 */
import { lookupGameContent } from "~/utils/gameContent";

export function useGameContent(
  gameId: MaybeRefOrGetter<string>,
  variant?: MaybeRefOrGetter<string | null | undefined>,
) {
  const { $getLocale } = useI18n();

  const content = computed(() =>
    lookupGameContent(toValue(gameId), toValue(variant), $getLocale()),
  );

  return {
    rules: computed(() => content.value.rules),
    tutorial: computed(() => content.value.tutorial),
    missing: computed(() => content.value.missing),
  };
}
