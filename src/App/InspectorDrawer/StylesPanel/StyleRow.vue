<template>
  <div style="display:flex;flex-direction:column;gap:5px;">
    <!-- Label -->
    <label style="font-size:11px;font-weight:600;color:var(--color-primary);line-height:1.2;">{{ label }}</label>

    <!-- COLOR -->
    <div v-if="type === 'color'" style="display:flex;gap:6px;align-items:center;">
      <!-- "Elegir color" button — native picker overlaid via opacity:0 input -->
      <div style="position:relative;flex-shrink:0;">
        <button
          type="button"
          style="display:flex;align-items:center;gap:6px;background:var(--color-primary);color:white;border:none;border-radius:7px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;"
        >
          <!-- Unset (no concrete color) shows a diagonal-stripe swatch instead
               of a color dot — a solid black/white circle here used to be
               indistinguishable from "the user actually chose black/white". -->
          <span :style="{
            width: '14px', height: '14px', borderRadius: '50%',
            background: isUnset
              ? 'repeating-linear-gradient(45deg, #fff, #fff 2px, #cbd5e1 2px, #cbd5e1 4px)'
              : swatchHex,
            border: '2px solid rgba(255,255,255,0.6)',
            flexShrink: 0, display: 'inline-block',
          }" />
          Elegir color
        </button>
        <!-- invisible overlay — opens native color picker, seeded with the
             RESOLVED color (real or inherited/computed fallback) so it opens
             on what the user actually sees. Emits nothing on its own — only
             an explicit pick (the 'input' event) writes a value. -->
        <input
          type="color"
          :value="swatchHex"
          style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0;"
          @input="onColorPick"
        />
      </div>
      <!-- Text input shows the LITERAL declared value ('inherit', 'red',
           'rgba(0,0,0,.5)', or empty when unset) — not a forced hex
           conversion. computedValue (when unset) is shown as a grey hint,
           matching the computed-value idiom the Padding/Margin rows use. -->
      <input
        type="text"
        v-model="colorText"
        :placeholder="computedValue ? `heredado: ${computedValue}` : '#RRGGBB'"
        style="flex:1;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;"
        @change="onColorTextChange"
        @keydown.enter.prevent="onColorTextChange"
      />
      <button
        v-if="value"
        type="button"
        title="Quitar color"
        @click="onColorClear"
        style="flex-shrink:0;width:22px;height:22px;border:1px solid #c7d8f5;border-radius:6px;background:white;color:#64748b;font-size:13px;line-height:1;cursor:pointer;"
      >×</button>
    </div>

    <!-- SELECT -->
    <div v-else-if="type === 'select'" style="position:relative;">
      <select
        :value="value"
        style="width:100%;font-size:12px;font-weight:600;padding:6px 30px 6px 12px;border:none;border-radius:7px;background:var(--color-primary);color:white;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;"
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
        :min="min ?? 0"
        :max="max ?? 100"
        :step="step ?? 1"
        :value="sliderDisplayVal"
        style="flex:1;accent-color:var(--color-primary);height:4px;cursor:pointer;"
        @input="onSliderInput"
        @pointerdown="isDragging = true"
        @pointerup="onSliderRelease"
        @pointercancel="onSliderRelease"
      />
      <span
        :style="{ color: value ? 'var(--color-primary)' : '#94a3b8' }"
        style="min-width:38px;font-size:11px;font-weight:600;text-align:right;"
      >
        {{ value || computedValue || '0px' }}
      </span>
    </div>

    <!-- SELECT + TEXT (preset dropdown + freeform text input) -->
    <div v-else-if="type === 'select-text'" style="display:flex;flex-direction:column;gap:4px;">
      <div style="position:relative;">
        <select
          :value="selectTextMatch"
          style="width:100%;font-size:12px;font-weight:600;padding:6px 30px 6px 12px;border:none;border-radius:7px;background:var(--color-primary);color:white;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;"
          @change="onSelectTextChange"
        >
          <option value="" disabled style="background:white;color:#999;">Seleccionar...</option>
          <option v-for="opt in options" :key="opt.value" :value="opt.value" style="background:white;color:#111;">{{ opt.label }}</option>
          <option value="__custom__" style="background:white;color:#111;">Personalizada...</option>
        </select>
        <svg style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"
             width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polyline points="2,4 6,8 10,4" stroke="white" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <input
        type="text"
        :value="value"
        :placeholder="placeholder || ''"
        style="width:100%;font-size:11px;padding:5px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;"
        @change="emit('change', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('change', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- SLIDER + TEXT (slider for quick px, text input for freeform values like %, auto) -->
    <div v-else-if="type === 'slider-text'" style="display:flex;align-items:center;gap:6px;">
      <input
        type="range"
        :min="min ?? 0"
        :max="max ?? 800"
        :step="step ?? 1"
        :value="sliderDisplayVal"
        style="flex:1;accent-color:var(--color-primary);height:4px;cursor:pointer;"
        @input="onSliderInput"
        @pointerdown="isDragging = true"
        @pointerup="onSliderRelease"
        @pointercancel="onSliderRelease"
      />
      <input
        type="text"
        :value="value"
        :placeholder="computedValue || placeholder || 'ej. 100%'"
        style="width:64px;font-size:11px;padding:4px 6px;border:1px solid #c7d8f5;border-radius:6px;color:#111;background:white;outline:none;text-align:center;"
        @change="emit('change', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('change', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- TEXTAREA (long text — a paragraph, HTML markup) -->
    <textarea
      v-else-if="type === 'textarea'"
      :value="value"
      :placeholder="computedValue || placeholder || ''"
      style="width:100%;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;resize:vertical;min-height:60px;font-family:inherit;"
      @change="emit('change', ($event.target as HTMLTextAreaElement).value)"
    />

    <!-- TEXT -->
    <input
      v-else
      type="text"
      :value="value"
      :placeholder="computedValue || placeholder || 'ej. 16px'"
      style="width:100%;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;"
      @change="emit('change', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { parseCssColor, toHex6, formatColor } from '../../../utils/css-color';

const props = defineProps<{
  label: string;
  type: 'color' | 'text' | 'textarea' | 'select' | 'slider' | 'slider-text' | 'select-text';
  value?: string;
  // Read-only computed value shown as a placeholder/hint when `value` is empty —
  // distinguishes "the browser resolved this to 600px" from "the user set 600px".
  computedValue?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  max?: number;
  min?: number;
  step?: number;
  // Unit appended to the emitted slider value. Defaults to 'px' (every prior
  // usage was px-calibrated). Pass '' for a unitless value (e.g. line-height,
  // where the CSS multiplier itself has no unit).
  unit?: string;
}>();

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

// ── Select-text helpers ─────────────────────────────────────────────────────

const selectTextMatch = computed(() => {
  if (!props.value) return '';
  const found = props.options?.find(o => o.value === props.value);
  return found ? found.value : '__custom__';
});

function onSelectTextChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  if (v && v !== '__custom__') emit('change', v);
}

// ── Color helpers ──────────────────────────────────────────────────────────
// See src/utils/css-color.ts for why this exists: the previous toHex()
// returned '#000000' for anything it couldn't parse (empty, 'inherit', named
// colors, rgba() with alpha) — an unset/inherited color and a genuinely black
// one looked identical, and the first touch of the picker silently
// overwrote the real value with black.

const parsed = computed(() => parseCssColor(props.value ?? ''));
const fallback = computed(() => parseCssColor(props.computedValue ?? ''));
// a===0 (transparent) counts as "nothing to show a real swatch for" too.
const isUnset = computed(() => !parsed.value || parsed.value.a === 0);
const swatchHex = computed(() => {
  if (parsed.value && parsed.value.a > 0) return toHex6(parsed.value);
  if (fallback.value) return toHex6(fallback.value);
  return '#ffffff';
});

// Shows the LITERAL declared value as typed/received ('inherit', 'red',
// 'rgba(0,0,0,.5)') — kept as a separate local ref (not a computed off
// props.value) so the user can type freely without each keystroke being
// reformatted mid-edit; re-synced whenever the prop changes underneath it
// (selection change, or the round-trip after a picker/text commit).
const colorText = ref(props.value ?? '');
watch(() => props.value, (v) => { colorText.value = v ?? ''; });

let colorTimer: ReturnType<typeof setTimeout> | null = null;
function onColorPick(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  // Preserve any existing alpha — the native <input type=color> is opaque-only,
  // so without this a semi-transparent color would silently become fully opaque.
  const alpha = parsed.value ? parsed.value.a : 1;
  const picked = parseCssColor(hex)!; // <input type=color> always yields a valid #rrggbb
  const value = alpha < 1 ? formatColor({ ...picked, a: alpha }) : hex;
  colorText.value = value; // immediate local update (no lag)
  if (colorTimer) clearTimeout(colorTimer);
  colorTimer = setTimeout(() => {
    emit('change', value);
    colorTimer = null;
  }, 30);
}

function onColorTextChange() {
  const raw = colorText.value.trim();
  if (raw === '') { emit('change', ''); return; } // explicit clear
  let candidate = raw;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(candidate)) candidate = '#' + candidate;
  if (parseCssColor(candidate)) {
    emit('change', candidate);
  }
  // Unparseable: don't emit — the field re-syncs back to the last real value
  // via the `props.value` watcher above rather than silently writing garbage.
}

function onColorClear() {
  colorText.value = '';
  emit('change', '');
}

// ── Slider helpers ─────────────────────────────────────────────────────────

// Round-tripping the emitted value straight back into the same range input's
// :value on every 'input' tick fights the browser's own native drag tracking —
// each reactive update forces the thumb to the last known *external* value,
// which visibly lags behind the mouse and snaps back mid-drag (note: binding
// :value to `undefined` to "skip" the update does NOT work — Vue's DOM prop
// patcher coerces null/undefined to '' for form elements, which is itself a
// forced value, not a no-op). Fix: `sliderDisplayVal` is a local ref that only
// listens to prop changes while NOT dragging; during the drag it is driven
// solely by the input's own 'input' events, so external reactivity never
// touches the DOM value until the user actually releases.
const isDragging = ref(false);

// Round to the nearest step, then strip float garbage (0.1 + 0.1 + 0.1 style
// imprecision) by rounding to the step's own decimal precision rather than a
// fixed integer — a step of 1 (the default) still rounds to a whole number.
function roundToStep(n: number, step: number): number {
  const rounded = Math.round(n / step) * step;
  const decimals = (String(step).split('.')[1] || '').length;
  return parseFloat(rounded.toFixed(decimals));
}

const numericVal = computed(() => {
  const raw = props.value || props.computedValue || '0';
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : roundToStep(n, props.step ?? 1);
});

const sliderDisplayVal = ref(numericVal.value);
watch(numericVal, (v) => {
  if (!isDragging.value) sliderDisplayVal.value = v;
});

function onSliderRelease() {
  isDragging.value = false;
  sliderDisplayVal.value = numericVal.value; // snap to the authoritative value once settled
}

function onSliderInput(e: Event) {
  const n = (e.target as HTMLInputElement).value;
  // Track the drag position locally so a mid-drag reactive re-render (from the
  // optimistic store write elsewhere) can't force the DOM value back to a
  // stale point — see the comment above sliderDisplayVal.
  sliderDisplayVal.value = Number(n);
  emit('change', n + (props.unit ?? 'px'));
}
</script>
