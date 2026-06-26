<template>
  <!-- Iframe mode: trait manager (element attributes) -->
  <div v-if="inspectorDrawer.rawHtml && inspectorDrawer.selectedElementPath" class="p-3 space-y-2 overflow-y-auto h-full">
    <div style="font-size:11px;font-weight:600;color:var(--color-blue);margin-bottom:8px;">
      Atributos — &lt;{{ inspectorDrawer.selectedElementTagName.toLowerCase() }}&gt;
    </div>
    <div v-if="!attrEntries.length" style="font-size:12px;color:#888;">
      Sin atributos editables.
    </div>
    <div v-for="[attrName, attrVal] in attrEntries" :key="attrName" class="flex flex-col gap-1">
      <label style="font-size:10px;font-weight:600;color:var(--ui-text-muted);">{{ attrName }}</label>
      <input
        :value="attrVal"
        class="w-full text-xs border rounded px-2 py-1"
        style="border-color:var(--ui-border);background:var(--ui-bg);color:var(--ui-text);"
        @change="setAttr(attrName, ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Image upload (only when IMG selected) -->
    <div v-if="inspectorDrawer.selectedElementTagName === 'IMG'" style="margin-top:12px;border-top:1px solid var(--ui-border);padding-top:10px;">
      <label style="font-size:10px;font-weight:600;color:var(--ui-text-muted);display:block;margin-bottom:4px;">Subir imagen</label>
      <input
        type="file"
        accept="image/*"
        style="font-size:11px;width:100%;"
        @change="onImageFileChange"
      />
      <p v-if="uploadError" style="color:#ef4444;font-size:11px;margin-top:4px;">{{ uploadError }}</p>
      <div
        v-if="showUploadWarning"
        style="margin-top:6px;font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:4px;padding:6px 8px;"
      >
        ⚠️ Sin token de servicios — imagen guardada como base64.
      </div>
    </div>
  </div>

  <!-- Iframe mode: nothing selected -->
  <div v-else-if="inspectorDrawer.rawHtml" class="p-4 text-center" style="font-size:12px;color:#888;">
    Haz click en un elemento para ver sus atributos.
  </div>

  <!-- Block mode: original panels -->
  <template v-else>
    <UAlert v-if="!inspectorDrawer.selectedBlockId" type="warning" title="Haz clic en un bloque para inspeccionarlo." />
    <UAlert v-else-if="!block" type="warning" :title="`Block with id ${inspectorDrawer.selectedBlockId} not found. Click on a block to reset.`" />

    <AvatarSidebarPanel v-else-if="block.type === 'Avatar'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ButtonSidebarPanel v-else-if="block.type === 'Button'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ColumnsContainerSidebarPanel v-else-if="block.type === 'ColumnsContainer'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ContainerSidebarPanel v-else-if="block.type === 'Container'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <DividerSidebarPanel v-else-if="block.type === 'Divider'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <HeadingSidebarPanel v-else-if="block.type === 'Heading'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <HtmlSidebarPanel v-else-if="block.type === 'Html'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ImageSidebarPanel v-else-if="block.type === 'Image'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <EmailLayoutSidebarPanel v-else-if="block.type === 'EmailLayout'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <SpacerSidebarPanel v-else-if="block.type === 'Spacer'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <TextSidebarPanel v-else-if="block.type === 'Text'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <VideoSidebarPanel v-else-if="block.type === 'Video'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ListSidebarPanel v-else-if="block.type === 'List'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />
    <ListItemSidebarPanel v-else-if="block.type === 'ListItem'" :data="block.data" @update:data="handleUpdateData({ type: block.type, data: $event })" />

    <pre v-else>{{ JSON.stringify(block, null, '  ') }}</pre>
  </template>
</template>

<script setup lang="ts">
import type { TEditorBlock } from '../../../documents/editor/core';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import { sendToCanvas } from '../../../composables/useCanvasBridge';
import { computed, ref } from 'vue';
import AvatarSidebarPanel from './input-panels/AvatarSidebarPanel.vue';
import ButtonSidebarPanel from './input-panels/ButtonSidebarPanel.vue';
import ColumnsContainerSidebarPanel from './input-panels/ColumnsContainerSidebarPanel.vue';
import ContainerSidebarPanel from './input-panels/ContainerSidebarPanel.vue';
import DividerSidebarPanel from './input-panels/DividerSidebarPanel.vue';
import HeadingSidebarPanel from './input-panels/HeadingSidebarPanel.vue';
import HtmlSidebarPanel from './input-panels/HtmlSidebarPanel.vue';
import ImageSidebarPanel from './input-panels/ImageSidebarPanel.vue';
import EmailLayoutSidebarPanel from './input-panels/EmailLayoutSidebarPanel.vue';
import SpacerSidebarPanel from './input-panels/SpacerSidebarPanel.vue';
import TextSidebarPanel from './input-panels/TextSidebarPanel.vue';
import VideoSidebarPanel from './input-panels/VideoSidebarPanel.vue';
import ListSidebarPanel from './input-panels/ListSidebarPanel.vue';
import ListItemSidebarPanel from './input-panels/ListItemSidebarPanel.vue';

const inspectorDrawer = useInspectorDrawer()

const block = computed(() => inspectorDrawer.document[inspectorDrawer.selectedBlockId!])

const SKIP_ATTRS = new Set(['style', 'contenteditable']);

const uploadError = ref<string | null>(null);
const showUploadWarning = ref(false);

async function onImageFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadError.value = null;
  showUploadWarning.value = false;

  let url = await inspectorDrawer.uploadImage(file);
  if (!url) {
    showUploadWarning.value = true;
    url = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
  }
  if (!inspectorDrawer.selectedElementPath) return;
  sendToCanvas({ type: 'set-attr', path: inspectorDrawer.selectedElementPath, property: 'src', value: url });
  inspectorDrawer.selectedElementAttrs = { ...inspectorDrawer.selectedElementAttrs, src: url };
}

const attrEntries = computed(() => {
  const attrs = inspectorDrawer.selectedElementAttrs ?? {};
  return Object.entries(attrs).filter(([k]) => !SKIP_ATTRS.has(k));
});

function setAttr(name: string, value: string) {
  if (!inspectorDrawer.selectedElementPath) return;
  sendToCanvas({ type: 'set-attr', path: inspectorDrawer.selectedElementPath, property: name, value });
  inspectorDrawer.selectedElementAttrs = { ...inspectorDrawer.selectedElementAttrs, [name]: value };
}

function handleUpdateData(data: TEditorBlock) {
  inspectorDrawer.setDocument({
    [inspectorDrawer.selectedBlockId!]: data,
  })
}
</script>
