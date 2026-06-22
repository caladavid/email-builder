<template>
  <div>
    <div
      :style="rowStyle"
      @click.stop="handleSelect"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <!-- Indent -->
      <span :style="{ width: depth * 12 + 'px', flexShrink: 0 }" />

      <!-- Expand toggle -->
      <span
        v-if="node.children && node.children.length"
        style="cursor:pointer;width:16px;flex-shrink:0;user-select:none;font-size:10px;"
        @click.stop="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }}
      </span>
      <span v-else style="width:16px;flex-shrink:0;" />

      <!-- Tag badge -->
      <span :style="tagBadgeStyle">{{ node.tag }}</span>

      <!-- Snippet -->
      <span
        v-if="node.snippet"
        style="font-size:10px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;"
      >
        {{ node.snippet }}
      </span>
    </div>

    <!-- Children -->
    <div v-if="expanded && node.children && node.children.length">
      <LayerItem
        v-for="(child, i) in node.children"
        :key="i"
        :node="child"
        :depth="depth + 1"
        :selected-path="selectedPath"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export interface DomNode {
  tag: string;
  id: string | null;
  className: string | null;
  path: string;
  snippet: string;
  children: DomNode[];
}

const props = defineProps<{
  node: DomNode;
  depth: number;
  selectedPath: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', path: string): void;
}>();

const expanded = ref(props.depth < 2);
const hovered = ref(false);

const isSelected = computed(() => props.selectedPath === props.node.path);

const rowStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 6px',
  cursor: 'pointer',
  borderRadius: '4px',
  background: isSelected.value
    ? 'rgba(0,121,204,0.15)'
    : hovered.value
    ? 'rgba(0,0,0,0.04)'
    : 'transparent',
  userSelect: 'none' as const,
}));

const tagBadgeStyle = computed(() => ({
  fontSize: '10px',
  fontFamily: 'monospace',
  padding: '0 4px',
  borderRadius: '3px',
  background: isSelected.value ? 'rgba(0,121,204,0.2)' : 'rgba(0,0,0,0.06)',
  color: isSelected.value ? 'rgba(0,121,204,1)' : '#555',
  flexShrink: 0,
}));

function handleSelect() {
  emit('select', props.node.path);
}
</script>
