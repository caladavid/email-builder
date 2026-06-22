<template>
  <div style="display:flex;align-items:center;gap:8px;width:100%;">
    <UIcon :name="iconLabel" style="font-size:22px;color:#0045B0;flex-shrink:0;" />
    <input
      type="range"
      :min="min ?? 0"
      :max="max ?? 100"
      :step="step ?? 1"
      :value="modelValue ?? 0"
      style="flex:1;accent-color:#0045B0;height:4px;cursor:pointer;"
      @input="emit('update:model-value', +($event.target as HTMLInputElement).value)"
    />
    <span style="min-width:36px;font-size:11px;font-weight:600;color:#0045B0;text-align:right;flex-shrink:0;">
      {{ modelValue ?? 0 }}{{ units }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  iconLabel: string;
  step?: number;
  units?: string;
  min?: number;
  max?: number;
  modelValue: number | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:model-value', value: number): void;
}>();
</script>
