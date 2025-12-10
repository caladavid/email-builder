import { ref, computed } from 'vue';  
import { useInspectorDrawer } from '../documents/editor/editor.store';  
import { BUTTONS } from '../documents/blocks/helpers/buttons';  
  
export function useGlobalDragManager() {  
  const inspectorDrawer = useInspectorDrawer();  
    
  const isDragging = ref(false);  
  const showDropIndicator = ref(false);  
  const dropPosition = ref<'before' | 'after'>('after');  
  const activeTargetId = ref<string | null>(null);  
  const draggedBlockId = ref<string | null>(null);  
    
  const dropIndicatorStyle = computed(() => {  
    if (!showDropIndicator.value || !activeTargetId.value) {  
      return { display: 'none' };  
    }  
      
    const targetElement = document.querySelector(`[data-block-id="${activeTargetId.value}"]`);  
    if (!targetElement) return { display: 'none' };  
      
    const rect = targetElement.getBoundingClientRect();  
    const isDraggingFromSidebar = draggedBlockId.value?.startsWith('block-type:');  
      
    return {  
      position: 'fixed' as const,  
      left: `${rect.left}px`,  
      width: `${rect.width}px`,  
      height: isDraggingFromSidebar ? '80px' : '3px',  
      backgroundColor: isDraggingFromSidebar ? 'rgba(0, 121, 204, 0.1)' : 'rgba(0, 121, 204, 1)',  
      border: isDraggingFromSidebar ? '2px dashed rgba(0, 121, 204, 0.5)' : 'none',  
      borderRadius: isDraggingFromSidebar ? '8px' : '0',  
      zIndex: 1000,  
      top: dropPosition.value === 'before'   
        ? `${rect.top - (isDraggingFromSidebar ? 40 : 2)}px`  
        : `${rect.bottom - (isDraggingFromSidebar ? 40 : 2)}px`,  
      display: 'flex',  
      alignItems: 'center',  
      justifyContent: 'center',  
      fontSize: '12px',  
      color: 'rgba(0, 121, 204, 0.8)',  
      fontFamily: 'monospace'  
    };  
  });  
    
  function findDeepestWrapper(element: HTMLElement): HTMLElement | null {  
    let deepest = element;  
    let current = element;  
      
    while (current) {  
      if (current.hasAttribute('data-block-id') &&   
          current.classList.contains('editor-block-wrapper')) {  
        deepest = current;  
      }  
      current = current.parentElement;  
    }  
      
    return deepest;  
  }  
    
  function handleDragOver(event: DragEvent) {  
    event.preventDefault();  
      
    if (event.dataTransfer) {  
      event.dataTransfer.dropEffect = 'move';  
    }  
      
    const target = event.target as HTMLElement;  
    const wrapper = findDeepestWrapper(target);  
      
    if (!wrapper) {  
      showDropIndicator.value = false;  
      activeTargetId.value = null;  
      return;  
    }  
      
    const blockId = wrapper.getAttribute('data-block-id');  
    if (!blockId) return;  
      
    const rect = wrapper.getBoundingClientRect();  
    const midpoint = rect.top + rect.height / 2;  
    dropPosition.value = event.clientY < midpoint ? 'before' : 'after';  
      
    activeTargetId.value = blockId;  
    showDropIndicator.value = true;  
  }  
    
  function handleDrop(event: DragEvent) {  
    event.preventDefault();  
    showDropIndicator.value = false;  
      
    const draggedData = event.dataTransfer?.getData('text/plain');  
    if (!draggedData || !activeTargetId.value) return;  
      
    // Lógica para manejar el drop...  
    // Aquí iría la lógica existente de handleDrop  
      
    activeTargetId.value = null;  
  }  
    
  function handleDragEnd() {  
    isDragging.value = false;  
    showDropIndicator.value = false;  
    activeTargetId.value = null;  
    draggedBlockId.value = null;  
  }  
    
  return {  
    isDragging,  
    showDropIndicator,  
    dropIndicatorStyle,  
    handleDragOver,  
    handleDrop,  
    handleDragEnd  
  };  
}