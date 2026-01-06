<template>
  <ReaderBlock v-for="childId in childrenIds" :key="childId" :id="childId" :document="document" />
</template>

<script lang="ts">
export type EditorChildrenChange = {
  childrenIds: string[]
}
</script>

<script setup lang="ts">
import { TReaderProps } from '..';
import ReaderBlock from '../Reader/ReaderBlock.vue'

type EditorChildrenIdsProps = {
  document: TReaderProps['document']
  childrenIds: string[] | null | undefined
}

defineProps<EditorChildrenIdsProps>()
</script>
