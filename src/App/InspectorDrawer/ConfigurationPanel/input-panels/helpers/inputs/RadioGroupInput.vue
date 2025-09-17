<template>
  <div class="space-y-2">
    <UFormField :label="label">
      <UButtonGroup class="w-full">
        <UButton
          v-for="item in items"
          :key="item.value"
          :icon="item.icon"
          :label="item.label"
          :color="item.value === modelValue ? 'primary' : 'neutral'"
          class="flex-1 justify-center border-x"
          @click="$emit('update:model-value', item.value)"
        />
      </UButtonGroup>
    </UFormField>
  </div>
</template>

<script setup generic="T extends string" lang="ts">
type Props = {
  label: string,
  modelValue: T | null,
  items: Array<{ label: string, value: T, icon?: never } | { icon: string, value: T, label?: never }>,
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'update:model-value', args: typeof props.items[number]['value']): void
}>()
</script>
