<script setup lang="ts">
/** Reports a failed or conflicting data migration, with a way forward. */
const migration = useDataMigration();
</script>

<template>
  <UAlert
    v-if="migration.state.value === 'failed' || migration.state.value === 'conflict'"
    color="warning"
    variant="subtle"
    icon="i-lucide-database"
    class="mb-3"
    :title="$ts('migration.title')"
    :description="
      migration.state.value === 'conflict'
        ? $ts('migration.conflict')
        : migration.result.value?.status === 'failed' &&
            migration.result.value.reason === 'quota'
          ? $ts('migration.quota')
          : $ts('migration.failed')
    "
    :actions="[
      {
        label: $ts('migration.retry'),
        color: 'warning',
        onClick: () => migration.retry(),
      },
      ...(migration.state.value === 'conflict'
        ? [
            {
              label: $ts('migration.keepCurrent'),
              variant: 'outline' as const,
              onClick: () => migration.keepCurrent(),
            },
          ]
        : []),
    ]"
    data-testid="migration-notice"
  />
</template>
