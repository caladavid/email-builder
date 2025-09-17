import { computed } from "vue";
import { interpolateVariables } from "./variableInterpolator";
import type { TEditorConfiguration } from "../documents/editor/core";

/* export function processDocumentVariables(document: any, variables: Record<string, string>) {
    const processedDocument = JSON.parse(JSON.stringify(document)); // Deep clone

    // Procesar todos los bloques Text en el documento  
    Object.keys(processedDocument).forEach(blockId => {
        console.log("block", blockId);
        const block = processedDocument[blockId];
        if (block.type === 'Text') {
            console.log('📋 Text block structure:', {
                hasData: !!block.data,
                hasProps: !!block.data?.props,
                hasText: !!block.data?.props?.text,
                actualText: block.data?.props?.text
            });

            if (block.data?.props?.text) {
                console.log('📝 BEFORE interpolation:', block.data.props.text);
                block.data.props.text = interpolateVariables(block.data.props.text, variables);
                console.log('📝 AFTER interpolation:', block.data.props.text);
            }
        }

        console.log('🔍 Block type:', block.type, 'Block data:', block.data);
        if (block === "Text" && block.data?.props.text) {
            console.log('📝 Before processing:', block.data.props.text);
            block.data.props.text = interpolateVariables(block.data.props.text, variables);
            console.log('✅ Processed text:', block.data.props.text);
        }
    })

    return processedDocument;
}; */

/* export function processDocumentVariables(document: any, variables: Record<string, string>) {
    const processedDocument = JSON.parse(JSON.stringify(document)); // Deep clone

    // Función recursiva para procesar bloques y sus hijos
    const processBlock = (block: any) => {
        if (block.type === 'Text' || block.type === 'Heading' || block.type === 'Button' && block.data?.props?.text) {

            // Interpolación de variables en el texto del bloque
            block.data.props.text = interpolateVariables(block.data.props.text, variables);
        }

        // Procesar los children si existen
        if (block.children && Array.isArray(block.children)) {
            block.children.forEach((child: any) => {
                processBlock(child);  // Llamada recursiva para procesar el hijo
            });
        }
    };

    // Itera a través de todos los bloques del documento
    Object.keys(processedDocument).forEach(blockId => {
        const block = processedDocument[blockId];
        processBlock(block);  // Procesa cada bloque y sus posibles hijos
    });

    return processedDocument;
    
} */

export const createProcessedDocument = (document: TEditorConfiguration, globalVariables: Record<string, string>): TEditorConfiguration => {
    const processedDoc = JSON.parse(JSON.stringify(document)); // Deep clone  

    // Procesar todos los bloques que contienen texto  
    Object.keys(processedDoc).forEach(blockId => {
        const block = processedDoc[blockId];

        // Procesar diferentes tipos de bloques con texto  
        if (block.data?.props?.text) {
            // Para bloques Text, Heading, Button  
            block.data.props.text = processDocumentVariables(
                block.data.props.text,
                globalVariables || {}
            );
        }

        if (block.data?.props?.contents) {
            // Para bloques Html  
            block.data.props.contents = processDocumentVariables(
                block.data.props.contents,
                globalVariables || {}
            );
        }
    });

    return processedDoc;
};

export function processDocumentVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] || match;
    });
}