<template>
  <div style="display:flex;flex-direction:column;gap:6px;">
    <label style="font-size:11px;font-weight:600;color:var(--color-primary);line-height:1.2;">{{ label }}</label>
    <div style="position:relative;">
      <select
        :value="value"
        style="width:100%;font-size:12px;font-weight:600;padding:8px 32px 8px 12px;border:none;border-radius:8px;background:var(--color-primary);color:white;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;"
        @change="handleChange(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value"
          :style="{ fontFamily: getFontFamily(opt.value as any), background: 'white', color: '#111' }">
          {{ opt.label }}
        </option>
      </select>
      <svg style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"
           width="14" height="14" viewBox="0 0 14 14" fill="none">
        <polyline points="3,5 7,9 11,5" stroke="white" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FONT_FAMILIES, getFontFamily } from '@flyhub/email-core';
import { ref } from 'vue';

const props = defineProps<{
  label: string;
  defaultValue: string | null;
}>();

const emit = defineEmits<{ (e: 'change', value: string): void; }>();

const value = ref(props.defaultValue ?? 'inherit');

const options = FONT_FAMILIES.map((f: any) => ({
  label: f.label as string,
  value: f.key as string,
})).concat({ label: 'Coincidir configuración del correo', value: 'inherit' });

function handleChange(v: string) {
  value.value = v;
  emit('change', v);
}
</script>
