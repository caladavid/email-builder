import type { TEditorConfiguration } from "../documents/editor/core";

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
    return text.replace(/\[\[\[(\w+)\]\]\]/g, (match, varName) => {
        return variables[varName] || match;
    });
}