<template>
  <BaseSidebarPanel title="Elemento de lista">
    <UFormField label="Texto">
      <RichTextEditor
        label=""
        :rows="4"
        :model-value="data.props?.text ?? ''"
        @update:model-value="handleTextUpdate"
        @update:formats="handleFormatsUpdate"
        placeholder="Texto del elemento..."
      />
    </UFormField>

    <MultiStylePropertyPanel
      :names="['color', 'fontSize', 'fontFamily']"
      :model-value="data.style"
      @update:model-value="emit('update:data', { ...data, style: $event })"
    />
  </BaseSidebarPanel>
</template>

<script setup lang="ts">
import BaseSidebarPanel from './helpers/BaseSidebarPanel.vue';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel.vue';
import RichTextEditor from './RichTextEditor.vue';

type ListItemData = {
  style?: any;
  props?: { text?: string | null; formats?: any[]; ordered?: boolean | null } | null;
};

const props = defineProps<{ data: ListItemData }>();
const emit = defineEmits<{ (e: 'update:data', args: ListItemData): void }>();

function handleTextUpdate(newText: string) {
  emit('update:data', { ...props.data, props: { ...props.data.props, text: newText } });
}

function handleFormatsUpdate(newFormats: any[]) {
  emit('update:data', { ...props.data, props: { ...props.data.props, formats: newFormats } });
}
</script>
