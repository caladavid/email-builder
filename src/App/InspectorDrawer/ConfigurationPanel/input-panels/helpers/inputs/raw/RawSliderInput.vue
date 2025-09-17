<template>
  <div class="flex gap-2 items-center justify-between w-full">
    <UIcon :name="iconLabel" class="text-3xl" />
    <USlider
      v-bind="rest"
      @update:model-value="emit('update:model-value', $event as number)"
    />
    <div>
      <span class="text-right">{{ modelValue }}{{ units }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type SliderInputProps = {
  iconLabel: string,

  step?: number,
  units?: string,
  min?: number,
  max?: number,

  modelValue: number | undefined,
}

const props = defineProps<SliderInputProps>()

const emit = defineEmits<{
  (e: 'update:model-value', args: number): void
}>()

const rest = computed(() => {
  const { iconLabel: _1, units: _2, ...rest} = props;

  return rest
})
</script>
