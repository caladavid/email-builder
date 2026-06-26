<template>
  <div style="display:flex;flex-direction:column;gap:5px;">
    <label style="font-size:11px;font-weight:600;color:var(--color-primary);line-height:1.2;">{{ label }}</label>
    <div style="display:flex;gap:6px;align-items:center;">
      <!-- "Elegir color" trigger button with native color picker overlaid -->
      <div style="position:relative;flex-shrink:0;">
        <button
          type="button"
          style="display:flex;align-items:center;gap:6px;background:var(--color-primary);color:white;border:none;border-radius:7px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;"
        >
          <span :style="{
            width: '14px', height: '14px', borderRadius: '50%',
            background: value ?? '#FFFFFF',
            border: '2px solid rgba(255,255,255,0.6)',
            flexShrink: 0, display: 'inline-block',
          }" />
          Elegir color
        </button>
        <input
          type="color"
          :value="hexValue"
          style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0;"
          @input="onColorPick"
        />
      </div>

      <!-- Hex text input -->
      <input
        type="text"
        :value="value ?? ''"
        placeholder="#RRGGBB"
        maxlength="7"
        style="flex:1;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;"
        @change="onHexChange"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />

      <!-- Nullable reset -->
      <button
        v-if="nullable && value !== null"
        type="button"
        style="padding:4px 6px;border:1px solid #c7d8f5;border-radius:6px;background:white;cursor:pointer;font-size:11px;color:#64748b;"
        @click="handleChange(null)"
      >✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type Props =
  | { nullable: true;  label: string; defaultValue: string | null }
  | { nullable: false; label: string; defaultValue: string };

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'change', value: string | null): void;
}>();

const value = ref<string | null>(props.defaultValue);

watch(() => props.defaultValue, (v) => { value.value = v; });

const hexValue = computed(() => {
  const v = value.value ?? '#000000';
  if (v.startsWith('#')) return v.slice(0, 7);
  const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return '#000000';
});

let colorTimer: ReturnType<typeof setTimeout> | null = null;
function onColorPick(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  value.value = hex;
  if (colorTimer) clearTimeout(colorTimer);
  colorTimer = setTimeout(() => { handleChange(hex); colorTimer = null; }, 30);
}

function onHexChange(e: Event) {
  let h = (e.target as HTMLInputElement).value.trim();
  if (!h.startsWith('#')) h = '#' + h;
  if (/^#[0-9a-fA-F]{6}$/.test(h)) { value.value = h; handleChange(h); }
}

function handleChange(v: string | null) {
  emit('change', v as any);
}
</script>
