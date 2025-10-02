<template>
<UButton   
    style="display: flex; flex-direction: column; align-items: center;"   
    class="bg-transparent cursor-pointer hover:bg-white/10 rounded-none py-3"  
    @click.prevent.stop="handleClick"  
  >  
    <UButton   
      color="neutral"   
      class="cursor-pointer rounded-none pointer-events-none"  
    >  
      <UIcon :name="icon" style="font-size: 1.5rem" />  
    </UButton>  
    <span class="text-white">{{ label }}</span>  
  </UButton>   
</template>

<script setup lang="ts">
import { ref } from 'vue';

type BlockMenuButtonProps = {
  label: string;
  icon: string;
}

const isProcessing = ref(false);

const emit = defineEmits<{
  (e: 'click'): void
}>();

async function handleClick() {
  if (isProcessing.value) return;

  isProcessing.value = true;
  emit('click');

  setTimeout(() => {
    isProcessing.value = false;
  }, 300);
}

defineProps<BlockMenuButtonProps>()
</script>
