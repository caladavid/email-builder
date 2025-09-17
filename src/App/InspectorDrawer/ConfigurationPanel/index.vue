<template>
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

  <pre v-else>{{ JSON.stringify(block, null, '  ') }}</pre>
</template>

<script setup lang="ts">
import type { TEditorBlock } from '../../../documents/editor/core';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import { computed } from 'vue';
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

const inspectorDrawer = useInspectorDrawer()

const block = computed(() => inspectorDrawer.document[inspectorDrawer.selectedBlockId!])

/** Functions */

function handleUpdateData(data: TEditorBlock) {
  inspectorDrawer.setDocument({
    [inspectorDrawer.selectedBlockId!]: data,
  })
}
</script>
