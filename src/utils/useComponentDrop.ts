
import { ref, computed } from 'vue';
import { useInspectorDrawer } from '../documents/editor/editor.store';
import { useDragAndDrop } from '../composables/useDragAndDrop';

export function useComponentDrop(currentBlockId: string) {
  const inspectorDrawer = useInspectorDrawer();
  const dragAndDrop = useDragAndDrop(() => currentBlockId);
  const showDropZone = ref(false);

  function handleDragOver(event: DragEvent) {
    const draggedId = event.dataTransfer?.getData('text/plain');
    
    // Solo manejar nuevos bloques desde el sidebar
    if (draggedId?.startsWith('block-type:')) {
      event.preventDefault();
      showDropZone.value = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    
    if (!currentTarget.contains(relatedTarget)) {
      showDropZone.value = false;
    }
  }

  function handleDrop(event: DragEvent, insertAfter: boolean = true) {
    const draggedId = event.dataTransfer?.getData('text/plain');
    
    if (draggedId?.startsWith('block-type:')) {
      event.preventDefault();
      event.stopPropagation();
      showDropZone.value = false;

      const blockType = draggedId.replace('block-type:', '');
      insertNewBlockAfterCurrent(blockType, currentBlockId, insertAfter);
      return;
    }
  }

  function insertNewBlockAfterCurrent(blockType: string, currentBlockId: string, insertAfter: boolean = true) {
    console.log('🎯 Insertando nuevo bloque:', { blockType, currentBlockId, insertAfter });

    // 1. Crear nuevo bloque
    const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newBlock = dragAndDrop.createBlockFromType(blockType);
    
    if (!newBlock) return;

    // 2. Encontrar el contenedor padre
    const parentId = dragAndDrop.findParentId(inspectorDrawer.document, currentBlockId);
    
    if (!parentId) {
      console.error('No se encontró el contenedor padre');
      return;
    }

    // 3. Obtener los hijos actuales del padre
    const parentBlock = inspectorDrawer.document[parentId];
    const childrenIds = parentBlock.data.props?.childrenIds || [];
    
    // 4. Encontrar la posición del bloque actual
    const currentIndex = childrenIds.indexOf(currentBlockId);
    
    if (currentIndex === -1) {
      console.error('El bloque actual no está en los hijos del padre');
      return;
    }

    // 5. Insertar el nuevo bloque después o antes del actual
    const insertIndex = insertAfter ? currentIndex + 1 : currentIndex;
    const newChildrenIds = [
      ...childrenIds.slice(0, insertIndex),
      newBlockId,
      ...childrenIds.slice(insertIndex)
    ];

    // 6. Actualizar el documento
    const nDocument = { ...inspectorDrawer.document };
    nDocument[newBlockId] = newBlock;
    nDocument[parentId] = {
      ...parentBlock,
      data: {
        ...parentBlock.data,
        props: {
          ...parentBlock.data.props,
          childrenIds: newChildrenIds
        }
      }
    };

    inspectorDrawer.setDocument(nDocument);
    inspectorDrawer.setSelectedBlockId(newBlockId);
  }

  return {
    showDropZone,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}