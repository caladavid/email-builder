<template>
  <div style="display:flex;flex-direction:column;gap:5px;">
    <!-- Label -->
    <label style="font-size:11px;font-weight:600;color:#0045B0;line-height:1.2;">{{ label }}</label>

    <!-- COLOR -->
    <div v-if="type === 'color'" style="display:flex;gap:6px;align-items:center;">
      <!-- "Elegir color" button — native picker overlaid via opacity:0 input -->
      <div style="position:relative;flex-shrink:0;">
        <button
          type="button"
          style="display:flex;align-items:center;gap:6px;background:#0045B0;color:white;border:none;border-radius:7px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;"
        >
          <span :style="{
            width: '14px', height: '14px', borderRadius: '50%',
            background: hexDisplay || '#000000',
            border: '2px solid rgba(255,255,255,0.6)',
            flexShrink: 0, display: 'inline-block',
          }" />
          Elegir color
        </button>
        <!-- invisible overlay — opens native color picker -->
        <input
          type="color"
          :value="hexDisplay"
          style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0;"
          @input="onColorPick"
        />
      </div>
      <!-- Hex text input -->
      <input
        type="text"
        v-model="hexDisplay"
        placeholder="#RRGGBB"
        maxlength="7"
        style="flex:1;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;"
        @change="onHexChange"
        @keydown.enter.prevent="onHexChange"
      />
    </div>

    <!-- SELECT -->
    <div v-else-if="type === 'select'" style="position:relative;">
      <select
        :value="value"
        style="width:100%;font-size:12px;font-weight:600;padding:6px 30px 6px 12px;border:none;border-radius:7px;background:#0045B0;color:white;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;"
        @change="emit('change', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value" style="background:white;color:#111;">
          {{ opt.label }}
        </option>
      </select>
      <svg style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"
           width="12" height="12" viewBox="0 0 12 12" fill="none">
        <polyline points="2,4 6,8 10,4" stroke="white" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- SLIDER -->
    <div v-else-if="type === 'slider'" style="display:flex;align-items:center;gap:8px;">
      <input
        type="range"
        :min="0"
        :max="max ?? 100"
        step="1"
        :value="numericVal"
        style="flex:1;accent-color:#0045B0;height:4px;cursor:pointer;"
        @input="onSliderInput"
      />
      <span style="min-width:38px;font-size:11px;font-weight:600;text-align:right;color:#0045B0;">
        {{ value || '0px' }}
      </span>
    </div>

    <!-- SLIDER + TEXT (slider for quick px, text input for freeform values like %, auto) -->
    <div v-else-if="type === 'slider-text'" style="display:flex;align-items:center;gap:6px;">
      <input
        type="range"
        :min="0"
        :max="max ?? 800"
        step="1"
        :value="numericVal"
        style="flex:1;accent-color:#0045B0;height:4px;cursor:pointer;"
        @input="onSliderInput"
      />
      <input
        type="text"
        :value="value"
        :placeholder="placeholder || 'ej. 100%'"
        style="width:64px;font-size:11px;padding:4px 6px;border:1px solid #c7d8f5;border-radius:6px;color:#111;background:white;outline:none;text-align:center;"
        @change="emit('change', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('change', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- TEXT -->
    <input
      v-else
      type="text"
      :value="value"
      :placeholder="placeholder || 'ej. 16px'"
      style="width:100%;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;"
      @change="emit('change', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  label: string;
  type: 'color' | 'text' | 'select' | 'slider' | 'slider-text';
  value?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  max?: number;
}>();

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

// ── Color helpers ──────────────────────────────────────────────────────────

function toHex(color: string): string {
  if (!color) return '#000000';
  const c = color.trim();
  if (c.startsWith('#')) {
    const h = c.slice(0, 7);
    return h.length === 7 ? h : '#000000';
  }
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]]
      .map(n => parseInt(n).toString(16).padStart(2, '0'))
      .join('');
  }
  return '#000000';
}

const hexDisplay = ref(toHex(props.value ?? ''));

watch(() => props.value, (v) => {
  hexDisplay.value = toHex(v ?? '');
});

let colorTimer: ReturnType<typeof setTimeout> | null = null;
function onColorPick(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  hexDisplay.value = hex; // immediate local update (no lag)
  if (colorTimer) clearTimeout(colorTimer);
  colorTimer = setTimeout(() => {
    emit('change', hex);
    colorTimer = null;
  }, 30);
}

function onHexChange() {
  let h = hexDisplay.value.trim();
  if (!h.startsWith('#')) h = '#' + h;
  if (/^#[0-9a-fA-F]{6}$/.test(h)) {
    emit('change', h);
  }
}

// ── Slider helpers ─────────────────────────────────────────────────────────

const numericVal = computed(() => {
  const n = parseFloat(props.value ?? '0');
  return isNaN(n) ? 0 : Math.round(n);
});

function onSliderInput(e: Event) {
  const n = (e.target as HTMLInputElement).value;
  const hasPercent = (props.value ?? '').includes('%');
  emit('change', n + (hasPercent ? '%' : 'px'));
}
</script>
