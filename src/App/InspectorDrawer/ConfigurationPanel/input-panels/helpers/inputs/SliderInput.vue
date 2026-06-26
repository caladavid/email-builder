<template>
  <div style="display:flex;flex-direction:column;gap:6px;">
    <label style="font-size:11px;font-weight:600;color:var(--color-primary);line-height:1.2;">{{ label }}</label>
    <RawSliderInput
      v-bind="rest"
      :model-value="value ?? undefined"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import RawSliderInput from './raw/RawSliderInput.vue';
import { computed, ref } from 'vue';

type Props = {
  label: string;
  iconLabel: string;
  step?: number;
  units?: string;
  min?: number;
  max?: number;
  defaultValue: number | null;
};

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'change', value: number): void; }>();

const value = ref(props.defaultValue);

const rest = computed(() => {
  const { label: _, defaultValue: __, ...r } = props;
  return r;
});

function handleChange(v: number) {
  value.value = v;
  emit('change', v);
}
</script>
