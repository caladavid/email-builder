<template>
  <div :style="containerStyle" @mousedown.prevent @click.stop>
    <button
      v-for="btn in formatButtons"
      :key="btn.cmd"
      :title="btn.label"
      :style="btnStyle"
      @mousedown.prevent
      @click.prevent="execute(btn.cmd)"
    >
      <span v-html="btn.icon" style="pointer-events:none;" />
    </button>

    <div style="width:1px;height:20px;background:#d1d5db;margin:0 2px;flex-shrink:0;" />

    <button
      title="Enlace"
      :style="{ ...btnStyle, background: showLink ? '#eff6ff' : 'white', borderColor: showLink ? '#93c5fd' : '#e5e7eb' }"
      @mousedown.prevent
      @click.prevent="toggleLink"
    >
      <span style="font-size:13px;pointer-events:none;">🔗</span>
    </button>

    <button
      v-if="showLink"
      title="Quitar enlace"
      :style="btnStyle"
      @mousedown.prevent
      @click.prevent="execute('unlink')"
    >
      <span style="font-size:11px;text-decoration:line-through;pointer-events:none;">🔗</span>
    </button>

    <div v-if="showLink" style="display:flex;gap:4px;align-items:center;margin-left:4px;">
      <input
        ref="linkInputRef"
        v-model="linkUrl"
        type="url"
        placeholder="https://..."
        style="font-size:11px;padding:2px 6px;border:1px solid #d1d5db;border-radius:4px;width:160px;outline:none;background:white;color:#111;"
        @mousedown.stop
        @click.stop
        @keydown.enter.prevent="applyLink"
        @keydown.escape.prevent="showLink = false"
      />
      <button
        :style="{ ...btnStyle, background: '#22c55e', borderColor: '#16a34a', color: 'white', fontWeight: '700' }"
        @mousedown.prevent
        @click.prevent="applyLink"
      >✓</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

const props = defineProps<{
  rect: { top: number; left: number; width: number; height: number };
}>();

const emit = defineEmits<{
  (e: 'format', command: string, value?: string): void;
}>();

const showLink = ref(false);
const linkUrl = ref('');
const linkInputRef = ref<HTMLInputElement | null>(null);

const formatButtons = [
  { cmd: 'bold',          label: 'Negrita (Ctrl+B)',   icon: '<b style="font-weight:800;font-size:13px;">B</b>' },
  { cmd: 'italic',        label: 'Cursiva (Ctrl+I)',   icon: '<i style="font-size:13px;">I</i>' },
  { cmd: 'underline',     label: 'Subrayado (Ctrl+U)', icon: '<u style="font-size:12px;">U</u>' },
  { cmd: 'strikeThrough', label: 'Tachado',            icon: '<s style="font-size:12px;">S</s>' },
  { cmd: 'removeFormat',  label: 'Limpiar formato',    icon: '<span style="font-size:11px;">T<s style="font-size:9px;vertical-align:super;">✕</s></span>' },
];

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: '1px solid #e5e7eb',
  borderRadius: '5px',
  background: 'white',
  cursor: 'pointer',
  fontFamily: 'serif',
  padding: '0',
  color: '#1f2937',
  flexShrink: '0',
};

const TOOLBAR_H = 40;

const containerStyle = computed(() => {
  const top = props.rect.top - TOOLBAR_H - 6;
  return {
    position: 'absolute' as const,
    top: Math.max(2, top) + 'px',
    left: props.rect.left + 'px',
    zIndex: 300,
    background: 'white',
    borderRadius: '8px',
    padding: '4px 6px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '2px',
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    userSelect: 'none' as const,
    pointerEvents: 'all' as const,
    minHeight: TOOLBAR_H + 'px',
    flexWrap: 'nowrap' as const,
  };
});

function execute(cmd: string) {
  emit('format', cmd);
  if (cmd === 'unlink') showLink.value = false;
}

function toggleLink() {
  showLink.value = !showLink.value;
  if (showLink.value) {
    nextTick(() => linkInputRef.value?.focus());
  }
}

function applyLink() {
  const url = linkUrl.value.trim();
  if (url) emit('format', 'createLink', url);
  showLink.value = false;
  linkUrl.value = '';
}
</script>
