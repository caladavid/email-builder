<template>
  <BaseSidebarPanel title="Bloque de video">
    <UFormField label="URL del video (src)">
      <UInput
        :model-value="data.props?.url ?? ''"
        placeholder="https://example.com/video.mp4"
        @update:model-value="updateProp('url', $event)"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Poster (imagen previa)">
      <UInput
        :model-value="data.props?.poster ?? ''"
        placeholder="https://example.com/poster.jpg"
        @update:model-value="updateProp('poster', $event)"
        class="w-full"
      />
    </UFormField>

    <div style="display:flex;gap:16px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--color-primary);cursor:pointer;">
        <input
          type="checkbox"
          :checked="data.props?.controls ?? true"
          @change="updateProp('controls', ($event.target as HTMLInputElement).checked)"
          style="width:14px;height:14px;accent-color:var(--color-primary);"
        />
        Controles
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--color-primary);cursor:pointer;">
        <input
          type="checkbox"
          :checked="data.props?.autoplay ?? false"
          @change="updateProp('autoplay', ($event.target as HTMLInputElement).checked)"
          style="width:14px;height:14px;accent-color:var(--color-primary);"
        />
        Autoplay
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <UFormField label="Ancho (px)" style="flex:1;">
        <UInput
          type="number"
          :model-value="String(data.props?.width ?? '')"
          placeholder="auto"
          @update:model-value="updateProp('width', toIntOrUndef($event))"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Alto (px)" style="flex:1;">
        <UInput
          type="number"
          :model-value="String(data.props?.height ?? '')"
          placeholder="auto"
          @update:model-value="updateProp('height', toIntOrUndef($event))"
          class="w-full"
        />
      </UFormField>
    </div>

    <MultiStylePropertyPanel
      :names="['backgroundColor', 'backgroundImage', 'padding']"
      :model-value="data.style"
      @update:model-value="emit('update:data', { ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import type { VideoProps } from '../../../../lib/email-builder/blocks/Video/VideoReader.vue';

const props = defineProps<{ data: VideoProps }>();
const emit = defineEmits<{ (e: 'update:data', args: VideoProps): void }>();

function updateProp(key: string, value: any) {
  emit('update:data', { ...props.data, props: { ...props.data.props, [key]: value } });
}

function toIntOrUndef(val: string | number): number | undefined {
  const n = parseInt(String(val));
  return isNaN(n) ? undefined : n;
}
</script>
