<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <pre v-if="code !== null" class="m-0 p-4 text-gray-500" @click="handleClick" v-html="code"/>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { html, json } from './highlighters'

type Props = {
  type: 'json' | 'html' | 'javascript';
  value: string;
}

const props = defineProps<Props>()

const code = ref<string | null>(null)

function handleClick(e: MouseEvent) {
  const s = window.getSelection()

  if (s === null) return

  // FIXME: type
  s.selectAllChildren(e.currentTarget)
}

watch([() => props.value, () => props.type], async ([value, type]) => {
let result: string | null = null

  if (type === 'html') {
    result = await html(value)
  } else if (type === 'json') {
    result = await json(value)
  } else {
    console.error('invalid type:', type)
    return
  }

  code.value = result
}, {
    immediate: true
  })
</script>
