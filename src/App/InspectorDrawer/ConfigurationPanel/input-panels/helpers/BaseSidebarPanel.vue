<template>
  <div class="p-2">
    <h1 class="text-xl mb-3 font-semibold">
      {{ title }}
    </h1>

    <div class="space-y-5">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style scoped>  
  
:deep(label) {  
  color: var(--sidebar-text) !important;  
}   

:deep(button.bg-primary) {  
  color: var(--color-white) !important;   
}

:deep(button.bg-inverted) {  
  color: black !important;  
  border-top-width: 1px !important;  
  border-bottom-width: 1px !important;  
}

:deep(.bg-elevated[role="tablist"]) { 
  background-color: red !important; 
  color: aqua;
}

:deep(.bg-primary) {  
  background-color: var(--sidebar-bg) !important;  
}  
  

:deep(button[data-state="unchecked"]) { 
  background-color: rgb(211,213,215) !important; 
}
  


:deep(.u-button-group .u-button) {  
  border-top-width: 1px !important;  
  border-bottom-width: 1px !important;  
  border-color: var(--sidebar-border) !important;  
}  

/* [data-v-90f2b3ec]  { 
  --sidebar-bg: var(--color-secondary) !important;
} */

:deep(span.ring-primary) { 
  --tw-ring-color: var(--color-white) !important; 
}


</style>