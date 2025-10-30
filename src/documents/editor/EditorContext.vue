<script setup lang="ts">
    import getConfiguration from "../../getConfiguration";  
    import type { TEditorConfiguration } from "./core";  
    import { defineStore } from "pinia";  
    import { ref } from "vue";  
    
    type TReceivedMessage = {  
    type: string;  
    document?: TEditorConfiguration;  
    variables?: { [key: string]: any };  
    };  
    
    type TValue = {  
    document: TEditorConfiguration;  
    selectedBlockId: string | null;  
    selectedSidebarTab: 'block-configuration' | 'styles';  
    selectedMainTab: 'editor' | 'preview' | 'json' | 'html';  
    selectedScreenSize: 'desktop' | 'mobile';  
    inspectorDrawerOpen: boolean;  
    samplesDrawerOpen: boolean;  
    INSPECTOR_DRAWER_WIDTH: number;  
    globalVariables: Record<string, string>;  
    };  
    
    const STORAGE_KEY = 'email-builder-variables';  
    
    function loadVariablesFromStorage(): Record<string, string> {  
    try {  
        const stored = localStorage.getItem(STORAGE_KEY);  
        return stored ? JSON.parse(stored) : {};  
    } catch {  
        return {};  
    }  
    }  
    
    function saveVariablesToStorage(variables: Record<string, string>) {  
    try {  
        localStorage.setItem(STORAGE_KEY, JSON.stringify(variables));  
    } catch (error) {  
        console.error('Error saving variables to localStorage:', error);  
    }  
    }  
    
    export const useInspectorDrawer = defineStore('inspectorDrawer', () => {  
    // State - Inicializado igual que en Zustand  
    const document = ref<TValue['document']>(  
        getConfiguration(typeof window !== 'undefined' ? window.location.hash : '')  
    );  
    const selectedBlockId = ref<TValue['selectedBlockId']>(null);  
    const selectedSidebarTab = ref<TValue['selectedSidebarTab']>('styles');  
    const selectedMainTab = ref<TValue['selectedMainTab']>('editor');  
    const selectedScreenSize = ref<TValue['selectedScreenSize']>('desktop');  
    const inspectorDrawerOpen = ref<boolean>(true); // true como en Zustand  
    const samplesDrawerOpen = ref<boolean>(true); // NUEVO - true como en Zustand  
    const INSPECTOR_DRAWER_WIDTH = 335;  
    const receivedVariables = ref<{ [key: string]: any } | null>(null);  
    /* const globalVariables = ref<TValue['globalVariables']>(loadVariablesFromStorage()); */  
    const globalVariables = ref<TValue['globalVariables']>({});  
    
    function initializeGlobalVariables(variables: Record<string, string>) {  
        /* const merged = { ...loadVariablesFromStorage(), ...variables };  
        globalVariables.value = merged;  
        saveVariablesToStorage(merged);   */
        globalVariables.value = variables  
        saveVariablesToStorage(variables) 
    }  
    
    if (typeof window !== 'undefined') {  
        window.addEventListener('message', (event) => {  
        if (  
            event.origin !== 'http://localhost:3000' &&  
            event.origin !== 'http://email-builder.multinetlabs.com/' &&  
            event.origin !== "http://localhost:5173"
        )  
            return;  
    
        const data = event.data as TReceivedMessage;  
    
        if (data.type === 'loadDocument') {  
            if (data.document) {  
            resetDocument(data.document);  
            }  
            if (data.variables) {  
            receivedVariables.value = data.variables;  
            console.log('Variables recibidas desde la app principal:', data.variables);  
            }  
        }  
        });  
    }  
    
    function sendToParent(data: TReceivedMessage) {  
        if (window.parent) {  
        window.parent.postMessage(data, '*');  
        }  
    }  
    
    function setGlobalVariables(variables: Record<string, string>) {  
        globalVariables.value = variables;  
        saveVariablesToStorage(variables);  
    }  
    
    // Equivalente a setSelectedBlockId de Zustand  
    function setSelectedBlockId(blockId: TValue['selectedBlockId']) {  
        const tab = blockId === null ? 'styles' : 'block-configuration';  
        if (blockId !== null) {  
        inspectorDrawerOpen.value = true;  
        }  
        selectedBlockId.value = blockId;  
        selectedSidebarTab.value = tab;  
    }  
    
    // NUEVO - Equivalente a setSidebarTab de Zustand  
    function setSidebarTab(tab: TValue['selectedSidebarTab']) {  
        selectedSidebarTab.value = tab;  
    }  
    
    // NUEVO - Equivalente a setSelectedMainTab de Zustand  
    function setSelectedMainTab(tab: TValue['selectedMainTab']) {  
        selectedMainTab.value = tab;  
    }  
    
    // NUEVO - Equivalente a setSelectedScreenSize de Zustand  
    function setSelectedScreenSize(size: TValue['selectedScreenSize']) {  
        selectedScreenSize.value = size;  
    }  
    
    // Equivalente a setDocument de Zustand  
    function setDocument(newDocument: TValue['document']) {  
        const originalDocument = document.value;  
        document.value = {  
        ...originalDocument,  
        ...newDocument,  
        };  
    }  
    
    // Equivalente a resetDocument de Zustand  
    function resetDocument(newDocument: TValue['document']) {  
        document.value = newDocument;  
        selectedSidebarTab.value = 'styles';  
        selectedBlockId.value = null;  
    }  
    
    // Equivalente a toggleInspectorDrawerOpen de Zustand  
    function toggleInspectorDrawerOpen() {  
        inspectorDrawerOpen.value = !inspectorDrawerOpen.value;  
    }  
    
    // NUEVO - Equivalente a toggleSamplesDrawerOpen de Zustand  
    function toggleSamplesDrawerOpen() {  
        samplesDrawerOpen.value = !samplesDrawerOpen.value;  
    }  
    
    function addVariableFromParent(key: string, value: string) {  
        const cleanValue = value.replace(/^{+|}+$/g, '');
        const newVariables = {  
        ...globalVariables.value,  
        [key]: cleanValue,  
        };  
        setGlobalVariables(newVariables);  
    }  
    
    function receiveVariablesFromParent(variables: Record<string, string>) {  
        const mergedVariables = {  
        ...globalVariables.value,  
        ...variables,  
        };  
        setGlobalVariables(mergedVariables);  
    }  
    
    return {  
        // State - Todas las propiedades del store de Zustand  
        document,  
        globalVariables,  
        receivedVariables,  
        selectedBlockId,  
        selectedSidebarTab,  
        selectedMainTab,  
        selectedScreenSize,  
        inspectorDrawerOpen,  
        samplesDrawerOpen, // NUEVO  
        INSPECTOR_DRAWER_WIDTH,  
    
        // Actions - Todas las funciones del store de Zustand  
        setSelectedBlockId,  
        setSidebarTab, // NUEVO  
        setSelectedMainTab, // NUEVO  
        setSelectedScreenSize, // NUEVO  
        setDocument,  
        resetDocument,  
        toggleInspectorDrawerOpen,  
        toggleSamplesDrawerOpen, // NUEVO  
        sendToParent,  
        setGlobalVariables,  
        initializeGlobalVariables,  
        receiveVariablesFromParent,  
        addVariableFromParent,  
    };  
    });
</script>