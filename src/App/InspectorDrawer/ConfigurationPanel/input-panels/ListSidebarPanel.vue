<template>
  <BaseSidebarPanel title="Bloque de lista">

    <!-- Tipo de lista -->
    <div>
      <label style="font-size:11px;font-weight:600;color:var(--color-primary);display:block;margin-bottom:6px;">Tipo de lista</label>
      <div style="display:flex;gap:8px;">
        <button @click="setOrdered(false)" :style="btnStyle(!ordered)">• Sin orden</button>
        <button @click="setOrdered(true)" :style="btnStyle(ordered)">1. Ordenada</button>
      </div>
    </div>

    <!-- Elementos -->
    <div>
      <label style="font-size:11px;font-weight:600;color:var(--color-primary);display:block;margin-bottom:6px;">
        Elementos ({{ childrenIds.length }})
      </label>

      <div v-if="!childrenIds.length" style="font-size:11px;color:#94a3b8;padding:8px 0;">
        Sin elementos. Agrega uno abajo.
      </div>

      <div v-for="(id, idx) in childrenIds" :key="id" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-size:11px;color:#94a3b8;min-width:18px;text-align:right;">{{ idx + 1 }}.</span>
        <div
          style="flex:1;font-size:11px;padding:5px 8px;border:1px solid #c7d8f5;border-radius:6px;background:white;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;"
          :title="itemText(id)"
        >
          {{ itemText(id) || '(vacío)' }}
        </div>
        <button
          @click="removeItem(idx)"
          style="font-size:18px;line-height:1;color:#ef4444;background:none;border:none;cursor:pointer;padding:2px 6px;flex-shrink:0;border-radius:4px;"
          title="Eliminar elemento"
        >×</button>
      </div>

      <button
        @click="addItem"
        style="display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 12px;border-radius:7px;border:1.5px dashed #c7d8f5;background:white;color:var(--color-primary);font-size:11px;font-weight:600;cursor:pointer;width:100%;margin-top:4px;transition:background 0.15s;"
        @mouseenter="($event.currentTarget as HTMLElement).style.background = '#f0f5ff'"
        @mouseleave="($event.currentTarget as HTMLElement).style.background = 'white'"
      >
        + Agregar elemento
      </button>
    </div>

    <MultiStylePropertyPanel
      :names="['backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontFamily', 'padding']"
      :model-value="data.style"
      @update:model-value="emit('update:data', { ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import { useInspectorDrawer } from '../../../../documents/editor/editor.store';

type ListData = {
  style?: any;
  props?: { childrenIds?: string[] | null; ordered?: boolean | null } | null;
};

const props = defineProps<{ data: ListData }>();
const emit = defineEmits<{ (e: 'update:data', args: ListData): void }>();

const store = useInspectorDrawer();

const ordered = computed(() => props.data.props?.ordered ?? false);
const childrenIds = computed(() => props.data.props?.childrenIds ?? []);

function itemText(id: string): string {
  return store.document[id]?.data?.props?.text ?? '';
}

function btnStyle(active: boolean) {
  return {
    flex: '1',
    padding: '5px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    border: '1.5px solid',
    borderColor: active ? 'var(--color-primary)' : '#c7d8f5',
    background: active ? 'var(--color-primary)' : 'white',
    color: active ? 'white' : 'var(--color-primary)',
    transition: 'all 0.15s',
  };
}

function setOrdered(value: boolean) {
  emit('update:data', { ...props.data, props: { ...props.data.props, ordered: value } });
}

function addItem() {
  const id = `listitem-${Date.now()}`;
  store.setDocument({
    [id]: {
      type: 'ListItem',
      data: {
        props: { text: 'Nuevo elemento', formats: [], ordered: ordered.value },
        style: {},
      },
    } as any,
    [store.selectedBlockId!]: {
      type: 'List',
      data: {
        ...props.data,
        props: {
          ...props.data.props,
          childrenIds: [...childrenIds.value, id],
        },
      },
    } as any,
  });
}

function removeItem(idx: number) {
  const newIds = childrenIds.value.filter((_, i) => i !== idx);
  emit('update:data', { ...props.data, props: { ...props.data.props, childrenIds: newIds } });
}
</script>
