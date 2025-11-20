import type { TEditorConfiguration } from "../documents/editor/core";
import { textWithFormatsToMarkdownRobust, validateFormats } from "./markdown-formatter";

/* function textWithFormatsToMarkdown(text: string, formats: any[]): string {  
  if (!formats || formats.length === 0) return text;  
    
  // Ordenar formatos por posición de inicio (de mayor a menor para insertar de atrás hacia adelante)  
  const sortedFormats = [...formats].sort((a, b) => b.start - a.start);  
    
  let result = text.trim();  
    
  sortedFormats.forEach(fmt => {  
    const before = result.substring(0, fmt.start);  
    const content = result.substring(fmt.start, fmt.end);  
    const after = result.substring(fmt.end);  
      
    let wrappedContent = content;  
      
    // Aplicar markdown según los formatos  
    if (fmt.bold && fmt.italic) {  
      wrappedContent = `***${content}***`; // Bold + Italic  
    } else if (fmt.bold) {  
      wrappedContent = `**${content}**`; // Bold  
    } else if (fmt.italic) {  
      wrappedContent = `*${content}*`; // Italic  
    }  
      
    result = before + wrappedContent + after;  
  });  
    
  return result;  
} */

export const createProcessedDocument = (document: TEditorConfiguration, globalVariables: Record<string, string>): TEditorConfiguration => {
    const processedDoc = JSON.parse(JSON.stringify(document)); // Deep clone  

    // Procesar todos los bloques que contienen texto  
    Object.keys(processedDoc).forEach(blockId => {
        const block = processedDoc[blockId];

        // Procesar diferentes tipos de bloques con texto  
        if (block.data?.props?.text) {  
            let processedText = processDocumentVariables(  
                block.data.props.text,  
                globalVariables || {}  
            );  
              
            // ✅ CAMBIO: Convertir a MARKDOWN en lugar de HTML  
            if (block.type === 'Text' && block.data.props.formats && block.data.props.formats.length > 0) {  
                
                const validation = validateFormats(processedText, block.data.props.formats);
                if (!validation.isValid) {
                    console.warn('Formatos inválidos detectados:', validation.errors);
                }

                processedText = textWithFormatsToMarkdownRobust(processedText, block.data.props.formats);  
                  
                // ✅ IMPORTANTE: Activar el flag de markdown  
                block.data.props.markdown = true;  
            }  
              
            block.data.props.text = processedText;  
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
    return text.replace(/\{(\w+)\}/g, (match, varName) => {
        return variables[varName] || match;
    });
}