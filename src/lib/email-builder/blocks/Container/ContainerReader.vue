<template>
  <BaseContainer :style="props.style" class="reader-block">
    <ReaderBlock v-for="childId in childrenIds" :key="childId" :id="childId" :document="document" />
  </BaseContainer>
</template>

<script setup lang="ts">
import BaseContainer from '../../../../components/BaseContainer.vue';
import ReaderBlock from '../../Reader/ReaderBlock.vue';
import type { ContainerProps } from './ContainerPropsSchema';
import { computed, type CSSProperties } from 'vue';

const props = defineProps<ContainerProps>();
const childrenIds = computed(() => props.props?.childrenIds ?? []);

</script>