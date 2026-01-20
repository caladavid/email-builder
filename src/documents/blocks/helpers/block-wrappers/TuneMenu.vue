<template>
  <div :style="sx" @click.stop>
    <div style="display: flex; gap: 8px; flex-direction: column;">
      <UButton class="tune-menu-button" icon="material-symbols:arrow-upward" size="xl" @click="handleMoveClick('up')" />
      <UButton class="tune-menu-button" icon="material-symbols:arrow-downward" size="xl" @click="handleMoveClick('down')" />
      <UButton class="tune-menu-button" icon="material-symbols:content-copy" size="xl" @click="handleDuplicateClick" />  
      <UButton class="tune-menu-button" icon="material-symbols:delete-outline" size="xl" @click="handleDeleteClick" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { ColumnsContainerProps } from '../../ColumnsContainer/ColumnsContainerPropsSchema';
import type { TEditorBlock, TEditorConfiguration } from '../../../editor/core';
import { useInspectorDrawer } from '../../../editor/editor.store';

const sx: HTMLAttributes['style'] = {
  backgroundColor: 'white',
  position: 'absolute',
  top: 0,
  left: '-56px',
  borderRadius: '256px',
  padding: '8px 4px',
  zIndex: 1000,
  boxShadow: 'rgba(33, 36, 67, 0.04) 0px 10px 20px, rgba(33, 36, 67, 0.04) 0px 2px 6px, rgba(33, 36, 67, 0.04) 0px 0px 1px',
}

const props = defineProps<{ blockId: string }>()

const inspectorDrawer = useInspectorDrawer()
let idCounter = 0;  
const generateId = () => `block-${Date.now()}-${++idCounter}`; 

function handleDeleteClick() {
  inspectorDrawer.saveToHistory();
  const filterChildrenIds = (childrenIds: string[] | null | undefined) => {
    if (!childrenIds) return childrenIds

    return childrenIds.filter(childId => childId !== props.blockId)
  }

  const nDocument = { ...inspectorDrawer.document }

  for (const [id, b] of Object.entries(nDocument)) {
    const block = b as TEditorBlock

    if (id === props.blockId) {
      continue
    }

    switch (block.type) {
      case 'EmailLayout':
        nDocument[id] = {
          ...block,
          data: {
            ...block.data,
            childrenIds: filterChildrenIds(block.data.childrenIds),
          },
        }
        break
      case 'Container':
        nDocument[id] = {
          ...block,
          data: {
            ...block.data,
            props: {
              ...block.data.props,
              childrenIds: filterChildrenIds(block.data.props?.childrenIds),
            }
          },
        }
        break
      case 'ColumnsContainer':
        nDocument[id] = {
          type: 'ColumnsContainer',
          data: {
            style: block.data.style,
            props: {
              ...block.data.props,
              columns: block.data.props?.columns?.map((c) => ({
                childrenIds: filterChildrenIds(c.childrenIds),
              }))
            }
          } as ColumnsContainerProps
        }
        break
      default:
        nDocument[id] = block
    }
  }

  delete nDocument[props.blockId]

  inspectorDrawer.document = nDocument
  inspectorDrawer.selectedSidebarTab = 'styles'
  inspectorDrawer.setSelectedBlockId(null)
}

function handleMoveClick(direction: 'up' | 'down') {
  inspectorDrawer.debouncedSaveToHistory();

  const moveChildrenIds = (ids: string[] | null | undefined) => {
    if (!ids) return ids

    const index = ids.indexOf(props.blockId)

    if (index === -1) return ids

    const  childrenIds = [...ids]

    if (direction === 'up' && index > 0) {
      [childrenIds[index], childrenIds[index - 1]] = [childrenIds[index - 1], childrenIds[index]]
    } else if (direction === 'down' && index < childrenIds.length - 1) {
      [childrenIds[index], childrenIds[index + 1]] = [childrenIds[index + 1], childrenIds[index]]
    }

    return childrenIds
  }

  const nDocument = { ...inspectorDrawer.document }

  for (const [id, b] of Object.entries(nDocument)) {
    const block = b as TEditorBlock

    if (id === props.blockId) {
      continue
    }

    switch (block.type) {
      case 'EmailLayout':
        nDocument[id] = {
          ...block,
          data: {
            ...block.data,
            childrenIds: moveChildrenIds(block.data.childrenIds),
          }
        }
        break
      case 'Container':
        nDocument[id] = {
          ...block,
          data: {
            ...block.data,
            props: {
              ...block.data.props,
              childrenIds: moveChildrenIds(block.data.props?.childrenIds),
            }
          },
        }
        break
      case 'ColumnsContainer':
        nDocument[id] = {
          type: 'ColumnsContainer',
          data: {
            style: block.data.style,
            props: {
              ...block.data.props,
              columns: block.data.props?.columns?.map((c) => ({
                childrenIds: moveChildrenIds(c.childrenIds),
              }))
            }
          } as ColumnsContainerProps
        }
        break
      default:
        nDocument[id] = block
    }
  }

  inspectorDrawer.document = nDocument  
  inspectorDrawer.setSelectedBlockId(props.blockId)
}

function deepCloneBlock(blockId: string, document: TEditorConfiguration): { newId: string, newBlocks: Record<string, TEditorBlock> } {  
  const block = document[blockId];  
  const newId = generateId();  
  const newBlocks: Record<string, TEditorBlock> = {};  
    
  // Clonar el bloque actual  
  const clonedBlock = JSON.parse(JSON.stringify(block));  
  newBlocks[newId] = clonedBlock;  
    
  // Si tiene hijos, clonarlos recursivamente  
  if (block.type === 'Container' && block.data.props?.childrenIds) {  
    const newChildrenIds: string[] = [];  
    for (const childId of block.data.props.childrenIds) {  
      const { newId: newChildId, newBlocks: childBlocks } = deepCloneBlock(childId, document);  
      newChildrenIds.push(newChildId);  
      Object.assign(newBlocks, childBlocks);  
    }  
    newBlocks[newId].data.props.childrenIds = newChildrenIds;  
  }  
    
  if (block.type === 'ColumnsContainer' && block.data.props?.columns) {  
    const newColumns = block.data.props.columns.map(col => {  
      const newChildrenIds: string[] = [];  
      for (const childId of col.childrenIds) {  
        const { newId: newChildId, newBlocks: childBlocks } = deepCloneBlock(childId, document);  
        newChildrenIds.push(newChildId);  
        Object.assign(newBlocks, childBlocks);  
      }  
      return { childrenIds: newChildrenIds };  
    });  
    newBlocks[newId].data.props.columns = newColumns;  
  }  
    
  return { newId, newBlocks };  
}  
  
function handleDuplicateClick() { 
  inspectorDrawer.saveToHistory(); 
  const currentDocument = inspectorDrawer.document;  
  const { newId, newBlocks } = deepCloneBlock(props.blockId, currentDocument);  
    
  // Encontrar el contenedor padre e insertar después del bloque actual  
  const newDocument = { ...currentDocument, ...newBlocks };  
    
  for (const [blockId, block] of Object.entries(newDocument)) {  
    if (block.type === 'EmailLayout' && block.data.childrenIds) {  
      const index = block.data.childrenIds.indexOf(props.blockId);  
      if (index !== -1) {  
        const newChildrenIds = [...block.data.childrenIds];  
        newChildrenIds.splice(index + 1, 0, newId);  
        newDocument[blockId] = {  
          ...block,  
          data: { ...block.data, childrenIds: newChildrenIds }  
        };  
        inspectorDrawer.setDocument(newDocument);  
        return;  
      }  
    }  
      
    if (block.type === 'Container' && block.data.props?.childrenIds) {  
      const index = block.data.props.childrenIds.indexOf(props.blockId);  
      if (index !== -1) {  
        const newChildrenIds = [...block.data.props.childrenIds];  
        newChildrenIds.splice(index + 1, 0, newId);  
        newDocument[blockId] = {  
          ...block,  
          data: {  
            ...block.data,  
            props: { ...block.data.props, childrenIds: newChildrenIds }  
          }  
        };  
        inspectorDrawer.setDocument(newDocument);  
        return;  
      }  
    }  
      
    if (block.type === 'ColumnsContainer' && block.data.props?.columns) {  
      for (let colIndex = 0; colIndex < block.data.props.columns.length; colIndex++) {  
        const column = block.data.props.columns[colIndex];  
        const index = column.childrenIds.indexOf(props.blockId);  
        if (index !== -1) {  
          const newColumns = [...block.data.props.columns];  
          const newChildrenIds = [...column.childrenIds];  
          newChildrenIds.splice(index + 1, 0, newId);  
          newColumns[colIndex] = { childrenIds: newChildrenIds };  
          newDocument[blockId] = {  
            ...block,  
            data: {  
              ...block.data,  
              props: { ...block.data.props, columns: newColumns }  
            }  
          };  
          inspectorDrawer.setDocument(newDocument); 
          inspectorDrawer.setSelectedBlockId(newId); 
          return;  
        }  
      }  
    }  
  }  
}
</script>

<style>
.tune-menu-button {
  font-size: 1.2rem;
  border-radius: 50px;
  cursor: pointer;
  background-color: transparent;

  &:hover {
    background-color: rgba(50, 50, 50, 0.06);
  }
}
</style>
