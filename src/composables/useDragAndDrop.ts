import { ref, computed } from 'vue';  
import { useInspectorDrawer } from '../documents/editor/editor.store';  
import type { TEditorBlock, TEditorConfiguration } from '../documents/editor/core';  
import type { ColumnsContainerProps } from '../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema';  
import { BUTTONS } from '../documents/blocks/helpers/buttons';
  
export function useDragAndDrop(getCurrentBlockId: () => string) {  
  const inspectorDrawer = useInspectorDrawer();  
    
  const isDragging = ref(false);  
  const showDropIndicator = ref(false);  
  const dropPosition = ref<'before' | 'after'>('after');  
  const draggedBlockId = ref<string | null>(null);  
  const validationCache = new Map<string, boolean>();  
  const activeWrapperId = ref<string | null>(null);
  const wrapperDepth = ref<number>(0);
  const activeDropTarget = ref<string | null>(null);
  let cleanupTimer: NodeJS.Timeout | null = null;

      
const dropIndicatorStyle = computed(() => ({    
  position: 'absolute' as const,    
  left: 0,    
  right: 0,  
  height: '60px', // ✅ Altura similar a un bloque real  
  backgroundColor: 'rgba(0, 51, 160, 0.1)', // ✅ Fondo semitransparente  
  border: '2px dashed rgba(0, 121, 204, 0.5)', // ✅ Borde punteado  
  borderRadius: '8px', // ✅ Bordes redondeados  
  zIndex: 10,    
  display: 'flex',  
  alignItems: 'center',  
  justifyContent: 'center',  
  fontSize: '12px',  
  color: 'rgba(0, 121, 204, 0.8)',  
  fontFamily: 'monospace',  
  [dropPosition.value === 'before' ? 'top' : 'bottom']: '-30px', // ✅ Desplazar más  
  transform: 'translateY(0)', // ✅ Sin transformación adicional  
  transition: 'all 0.2s ease' // ✅ Transición suave  
}));
      
  function findParentContainer(  
    document: TEditorConfiguration,  
    blockId: string  
  ): {  
    parentId: string | null;  
    parentBlock: TEditorBlock | null;  
    childIndex: number;  
    columnIndex?: number;  
  } {  
    for (const [id, block] of Object.entries(document)) {  
      if (block.type === 'EmailLayout' && block.data.childrenIds) {  
        const index = block.data.childrenIds.indexOf(blockId);  
        if (index !== -1) {  
          return { parentId: id, parentBlock: block, childIndex: index };  
        }  
      }  
          
      if (block.type === 'Container' && block.data.props?.childrenIds) {  
        const index = block.data.props.childrenIds.indexOf(blockId);  
        if (index !== -1) {  
          return { parentId: id, parentBlock: block, childIndex: index };  
        }  
      }  
          
      if (block.type === 'ColumnsContainer' && block.data.props?.columns) {  
        for (let colIndex = 0; colIndex < block.data.props.columns.length; colIndex++) {  
          const column = block.data.props.columns[colIndex];  
          const index = column.childrenIds.indexOf(blockId);  
          if (index !== -1) {  
            return { parentId: id, parentBlock: block, childIndex: index, columnIndex: colIndex };  
          }  
        }  
      }  
    }  
        
    return { parentId: null, parentBlock: null, childIndex: -1 };  
  }  
      
  function isDescendant(  
    potentialDescendantId: string,  
    ancestorId: string,  
    document: TEditorConfiguration  
  ): boolean {  
    const ancestorBlock = document[ancestorId];  
    if (!ancestorBlock) return false;  
    
    let childrenIds: string[] = [];  
    
    if (ancestorBlock.type === 'EmailLayout') {  
      childrenIds = ancestorBlock.data.childrenIds || [];  
    } else if (ancestorBlock.type === 'Container') {  
      childrenIds = ancestorBlock.data.props?.childrenIds || [];  
    } else if (ancestorBlock.type === 'ColumnsContainer') {  
      childrenIds = ancestorBlock.data.props?.columns?.flatMap(col => col.childrenIds) || [];  
    }  
    
    for (const childId of childrenIds) {  
      if (childId === potentialDescendantId) return true;  
      if (isDescendant(potentialDescendantId, childId, document)) return true;  
    }  
    
    return false;  
  }  

  function getAllDescendants(  
    blockId: string,  
    document: TEditorConfiguration,  
    visited: Set<string> = new Set()  
  ): Set<string> {  
    // Prevenir ciclos infinitos  
    if (visited.has(blockId)) return visited;  
    visited.add(blockId);  
      
    const block = document[blockId];  
    if (!block) return visited;  
      
    let childrenIds: string[] = [];  
      
    // ✅ Extraer hijos según tipo de bloque (igual que htmlParser)  
    if (block.type === 'EmailLayout') {  
      childrenIds = block.data.childrenIds || [];  
    } else if (block.type === 'Container') {  
      childrenIds = block.data.props?.childrenIds || [];  
    } else if (block.type === 'ColumnsContainer') {  
      // ✅ CRÍTICO: Aplanar todas las columnas (como en htmlParser)  
      childrenIds = block.data.props?.columns?.flatMap(col => col.childrenIds) || [];  
    }  
      
    // Recursión profunda  
    for (const childId of childrenIds) {  
      getAllDescendants(childId, document, visited);  
    }  
      
    return visited;  
  }  

  function handleDragLeave(event: DragEvent): void{
    const relatedTarget = event.relatedTarget as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;

    if (!currentTarget || !currentTarget.contains) return;

    if (!currentTarget.contains(relatedTarget)){
      showDropIndicator.value = false;
      activeWrapperId.value = null;
      wrapperDepth.value = 0;
    }
  }
    
  function isValidDrop(draggedId: string, targetId: string): boolean {  
  const document = inspectorDrawer.document;  
      
  if (draggedId === targetId) {  
      console.log('Cannot drop block on itself');  
      return false;  
  }  
      
  if (!document[draggedId] || !document[targetId]) {  
      console.log('Dragged or target block not found');  
      return false;  
  }  
      
  // ✅ CORRECCIÓN: Verificar AMBAS direcciones  
  const draggedDescendants = getAllDescendants(draggedId, document);  
  const targetDescendants = getAllDescendants(targetId, document);  
      
  // Si target está en descendientes de dragged, es inválido  
  if (draggedDescendants.has(targetId)) {  
      console.log('Cannot drop container into its own descendant');  
      return false;  
  }  
      
  // ✅ NUEVO: Si dragged está en descendientes de target, también es inválido  
  if (targetDescendants.has(draggedId)) {  
      console.log('Cannot drop block into its ancestor');  
      return false;  
  }  
      
  // Permitir drops entre hermanos  
  const draggedParent = findParentContainer(document, draggedId);  
  const targetParent = findParentContainer(document, targetId);  
      
  if (draggedParent.parentId && draggedParent.parentId === targetParent.parentId) {  
      return true;  
  }  
      
  return true;  
  }
      
  function removeBlockFromParent(  
    document: TEditorConfiguration,  
    blockId: string  
  ): TEditorBlock | null {  
    inspectorDrawer.saveToHistory();
    const parentInfo = findParentContainer(document, blockId);  
        
    if (!parentInfo.parentId || !parentInfo.parentBlock) {  
      return null;  
    }  
        
    const removedBlock = document[blockId];  
    const { parentId, parentBlock, childIndex, columnIndex } = parentInfo;  
        
    if (parentBlock.type === 'EmailLayout') {  
      const newChildrenIds = [...(parentBlock.data.childrenIds || [])];  
      newChildrenIds.splice(childIndex, 1);  
          
      document[parentId] = {  
        ...parentBlock,  
        data: {  
          ...parentBlock.data,  
          childrenIds: newChildrenIds  
        }  
      };  
    }  
    else if (parentBlock.type === 'Container') {  
      const newChildrenIds = [...(parentBlock.data.props?.childrenIds || [])];  
      newChildrenIds.splice(childIndex, 1);  
          
      document[parentId] = {  
        ...parentBlock,  
        data: {  
          ...parentBlock.data,  
          props: {  
            ...parentBlock.data.props,  
            childrenIds: newChildrenIds  
          }  
        }  
      };  
    }  
    else if (parentBlock.type === 'ColumnsContainer' && columnIndex !== undefined) {  
      const newColumns = [...(parentBlock.data.props?.columns || [])];  
      const newChildrenIds = [...newColumns[columnIndex].childrenIds];  
      newChildrenIds.splice(childIndex, 1);  
      newColumns[columnIndex] = { childrenIds: newChildrenIds };  
          
      document[parentId] = {  
        type: 'ColumnsContainer',  
        data: {  
          style: parentBlock.data.style,  
          props: {  
            ...parentBlock.data.props,  
            columns: newColumns  
          }  
        } as ColumnsContainerProps  
      };  
    }  
        
    return removedBlock;  
  }  
      
  function insertBlockAtPosition(  
    document: TEditorConfiguration,  
    blockId: string,  
    targetId: string,  
    position: 'before' | 'after'  
  ): boolean {  
    inspectorDrawer.debouncedSaveToHistory();
    const targetParentInfo = findParentContainer(document, targetId);  
        
    if (!targetParentInfo.parentId || !targetParentInfo.parentBlock) {  
      return false;  
    }  
        
    const { parentId, parentBlock, childIndex, columnIndex } = targetParentInfo;  
    const insertIndex = position === 'before' ? childIndex : childIndex + 1;  
        
    if (parentBlock.type === 'EmailLayout') {  
      const newChildrenIds = [...(parentBlock.data.childrenIds || [])];  
      newChildrenIds.splice(insertIndex, 0, blockId);  
          
      document[parentId] = {  
        ...parentBlock,  
        data: {  
          ...parentBlock.data,  
          childrenIds: newChildrenIds  
        }  
      };  
      return true;  
    }  
        
    if (parentBlock.type === 'Container') {  
      const newChildrenIds = [...(parentBlock.data.props?.childrenIds || [])];  
      newChildrenIds.splice(insertIndex, 0, blockId);  
          
      document[parentId] = {  
        ...parentBlock,  
        data: {  
          ...parentBlock.data,  
          props: {  
            ...parentBlock.data.props,  
            childrenIds: newChildrenIds  
          }  
        }  
      };  
      return true;  
    }  
        
    if (parentBlock.type === 'ColumnsContainer' && columnIndex !== undefined) {  
      const newColumns = [...(parentBlock.data.props?.columns || [])];  
      const newChildrenIds = [...newColumns[columnIndex].childrenIds];  
      newChildrenIds.splice(insertIndex, 0, blockId);  
      newColumns[columnIndex] = { childrenIds: newChildrenIds };  
          
      document[parentId] = {  
        type: 'ColumnsContainer',  
        data: {  
          style: parentBlock.data.style,  
          props: {  
            ...parentBlock.data.props,  
            columns: newColumns  
          }  
        } as ColumnsContainerProps  
      };  
      return true;  
    }  
        
    return false;  
  }  
  
  function appendBlockToContainer(  
    document: TEditorConfiguration,  
    blockId: string,  
    containerId: string  
  ): boolean {  
    inspectorDrawer.debouncedSaveToHistory();
    const containerBlock = document[containerId];  
      
    if (!containerBlock) {  
      console.log(`Container ${containerId} not found`);  
      return false;  
    }  
      
    if (containerBlock.type === 'Container') {  
      const currentChildrenIds = containerBlock.data.props?.childrenIds || [];  
        
      document[containerId] = {  
        ...containerBlock,  
        data: {  
          ...containerBlock.data,  
          props: {  
            ...containerBlock.data.props,  
            childrenIds: [...currentChildrenIds, blockId]  
          }  
        }  
      };  
      return true;  
    }  
      
    if (containerBlock.type === 'EmailLayout') {  
      const currentChildrenIds = containerBlock.data.childrenIds || [];  
        
      document[containerId] = {  
        ...containerBlock,  
        data: {  
          ...containerBlock.data,  
          childrenIds: [...currentChildrenIds, blockId]  
        }  
      };  
      return true;  
    }  
      
    return false;  
  }  
  
  function appendBlockToColumn(  
    document: TEditorConfiguration,  
    blockId: string,  
    containerId: string,  
    columnIndex: number  
  ): boolean {  
    inspectorDrawer.debouncedSaveToHistory();
    const containerBlock = document[containerId];  
      
    if (!containerBlock || containerBlock.type !== 'ColumnsContainer') {  
      return false;  
    }  
      
    const newColumns = [...(containerBlock.data.props?.columns || [])];  
    if (columnIndex >= newColumns.length) {  
      return false;  
    }  
      
    const currentChildrenIds = newColumns[columnIndex].childrenIds || [];  
    newColumns[columnIndex] = {   
      childrenIds: [...currentChildrenIds, blockId]   
    };  
      
    document[containerId] = {  
      type: 'ColumnsContainer',  
      data: {  
        style: containerBlock.data.style,  
        props: {  
          ...containerBlock.data.props,  
          columns: newColumns  
        }  
      } as ColumnsContainerProps  
    };  
      
    return true;  
  }  
      
  function moveBlock(  
    draggedId: string,  
    targetId: string,  
    position: 'before' | 'after'  
  ): void {  
    console.log('🔄 moveBlock llamado:', { draggedId, targetId, position });
    inspectorDrawer.debouncedSaveToHistory();

    const nDocument = { ...inspectorDrawer.document };  
      
    // ✅ Obtener información de ambos bloques  
    const draggedParent = findParentContainer(nDocument, draggedId);  
    const targetParent = findParentContainer(nDocument, targetId);  
      
    // ✅ CASO 1: Mismo contenedor - usar swap directo (patrón TuneMenu)  
    if (draggedParent.parentId && draggedParent.parentId === targetParent.parentId) {  
      const parentBlock = nDocument[draggedParent.parentId];  
        
      if (parentBlock.type === 'Container') {  
        const childrenIds = [...(parentBlock.data.props?.childrenIds || [])];  
        const draggedIndex = childrenIds.indexOf(draggedId);  
        const targetIndex = childrenIds.indexOf(targetId);  
          
        // Remover el dragged  
        childrenIds.splice(draggedIndex, 1);  
          
        // Calcular nuevo índice después de remover  
        const newTargetIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;  
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1;  
          
        // Insertar en nueva posición  
        childrenIds.splice(insertIndex, 0, draggedId);  
          
        nDocument[draggedParent.parentId] = {  
          ...parentBlock,  
          data: {  
            ...parentBlock.data,  
            props: {  
              ...parentBlock.data.props,  
              childrenIds  
            }  
          }  
        };  
          
        inspectorDrawer.setDocument(nDocument);  
        return;  
      }  
        
      if (parentBlock.type === 'EmailLayout') {  
        const childrenIds = [...(parentBlock.data.childrenIds || [])];  
        const draggedIndex = childrenIds.indexOf(draggedId);  
        const targetIndex = childrenIds.indexOf(targetId);  
          
        childrenIds.splice(draggedIndex, 1);  
        const newTargetIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;  
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1;  
        childrenIds.splice(insertIndex, 0, draggedId);  
          
        nDocument[draggedParent.parentId] = {  
          ...parentBlock,  
          data: {  
            ...parentBlock.data,  
            childrenIds  
          }  
        };  
          
        inspectorDrawer.setDocument(nDocument);  
        return;  
      }  
        
      if (parentBlock.type === 'ColumnsContainer' &&   
          draggedParent.columnIndex !== undefined &&   
          targetParent.columnIndex !== undefined &&  
          draggedParent.columnIndex === targetParent.columnIndex) {  
          
        const newColumns = [...(parentBlock.data.props?.columns || [])];  
        const childrenIds = [...newColumns[draggedParent.columnIndex].childrenIds];  
        const draggedIndex = childrenIds.indexOf(draggedId);  
        const targetIndex = childrenIds.indexOf(targetId);  
          
        childrenIds.splice(draggedIndex, 1);  
        const newTargetIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;  
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1;  
        childrenIds.splice(insertIndex, 0, draggedId);  
          
        newColumns[draggedParent.columnIndex] = { childrenIds };  
          
        nDocument[draggedParent.parentId] = {  
          type: 'ColumnsContainer',  
          data: {  
            style: parentBlock.data.style,  
            props: {  
              ...parentBlock.data.props,  
              columns: newColumns  
            }  
          }  
        };  
          
        inspectorDrawer.setDocument(nDocument);  
        return;  
      }  
    }  
      
    // ✅ CASO 2: Diferentes contenedores - usar remove + insert  
    const draggedBlock = removeBlockFromParent(nDocument, draggedId);  
    if (!draggedBlock) {  
      console.log(`Block ${draggedId} not found in any parent container`);  
      return;  
    }  
      
    const inserted = insertBlockAtPosition(nDocument, draggedId, targetId, position);  
    if (!inserted) {  
      console.log(`Could not insert block ${draggedId} at target ${targetId}`);  
      return;  
    }  
      
    inspectorDrawer.setDocument(nDocument);  
  }
      
  function handleDragStart(event: DragEvent): void {  
    isDragging.value = true;  
    const blockId = getCurrentBlockId();  
    draggedBlockId.value = blockId;  

    const block = inspectorDrawer.document[blockId];  
/*   console.log('🎯 Arrastrando bloque:', {  
    id: blockId,  
    type: block?.type,  
    isRoot: blockId === 'root'  
  }); */
        
    if (event.dataTransfer) {  
      event.dataTransfer.effectAllowed = 'move';  
      event.dataTransfer.setData('text/plain', blockId);  
    }  
  } 
  
  function showDropIndicatorTemporarily(){
    showDropIndicator.value = true;

    if (cleanupTimer){
      clearTimeout(cleanupTimer)
    }

    cleanupTimer = setTimeout(() => {
      showDropIndicator.value = false;
      cleanupTimer = null
    }, 500)
  }
      
  function handleDragOver(event: DragEvent): void {  
    event.preventDefault();  
      
    if (event.dataTransfer) {  
      event.dataTransfer.dropEffect = 'move';  
    }  
      
    // ✅ NUEVO: Detectar si el cursor está sobre contenido hijo  
    const target = event.target as HTMLElement;  
    const currentElement = event.currentTarget as HTMLElement;  
    const isOverChildContent = target.closest('[draggable="true"]') !== currentElement;  
      
    // Si está sobre contenido hijo, no mostrar preview en este nivel  
    if (isOverChildContent) {  
      showDropIndicator.value = false;  
      return;  
    }  
      
    const rect = currentElement.getBoundingClientRect();  
    const midpoint = rect.top + rect.height / 2;  
    dropPosition.value = event.clientY < midpoint ? 'before' : 'after';  
    showDropIndicatorTemporarily();  
  }
      
  function handleDrop(event: DragEvent): void {  
    event.preventDefault();  
    showDropIndicator.value = false;  
        
    const draggedId = event.dataTransfer?.getData('text/plain');  
    const targetId = getCurrentBlockId();  
        
    if (!draggedId) {  
      console.log('No dragged block ID found');  
      return;  
    }  
        
    if (!isValidDrop(draggedId, targetId)) {  
      console.log('Invalid drop operation');  
      return;  
    }  
        
    moveBlock(draggedId, targetId, dropPosition.value);  
  }  
      
  function handleDragEnd(): void {  
    isDragging.value = false;  
    showDropIndicator.value = false;  
    draggedBlockId.value = null;  
    dropPosition.value = 'after';
    activeWrapperId.value = null;  
    wrapperDepth.value = 0;  
  }  

function createBlockFromType(blockType: string): TEditorBlock | null {  
/*   console.log('🔍 Buscando bloque:', blockType);  
  console.log('📋 BUTTONS disponibles:', BUTTONS.map(b => b.label));   */
    
  const blockConfig = BUTTONS.find(b => b.label.toLowerCase() === blockType.toLowerCase());  
    
  if (!blockConfig) {  
    console.log('❌ No se encontró configuración para:', blockType);  
    return null;  
  }  
    
  const block = blockConfig.block();  
/*   console.log('✅ Bloque creado:', block);   */
  return block;  
}

function calculateWrapperDepth(blockId: string): number {  
  let depth = 0;  
  let currentId = blockId;  
    
  while (currentId) {  
    const parent = findParentContainer(inspectorDrawer.document, currentId);  
    if (!parent.parentId) break;  
      
    depth++;  
    currentId = parent.parentId;  
  }  
    
  return depth;  
}  

// Función para solicitar mostrar preview  
function requestDropIndicator(blockId: string): boolean {  
  if (!activeDropTarget.value) {  
    activeDropTarget.value = blockId;  
    return true;  
  }  
  return false;  
}  
  
// Función para liberar preview  
function releaseDropIndicator(blockId: string): void {  
  if (activeDropTarget.value === blockId) {  
    activeDropTarget.value = null;  
  }  
}
      
  return {  
    isDragging,  
    showDropIndicator,  
    dropPosition,  
    draggedBlockId,  
    dropIndicatorStyle,  
    handleDragStart,  
    handleDragOver,  
    handleDrop,  
    handleDragEnd,  
    handleDragLeave,
    findParentContainer,
    insertBlockAtPosition,
    // Funciones helper para ContainerEditor  
    removeBlockFromParent,  
    appendBlockToContainer,  
    appendBlockToColumn,  
    isDescendant,
    createBlockFromType,
    moveBlock,
    activeWrapperId,
    requestDropIndicator,
    releaseDropIndicator
  };  
}