import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";

export const TextElementsMatcher: BlockMatcher = {
    name: "TextElements",

    isComponent(element: Element, parser: HTMLToBlockParser) {
        const tag = element.tagName.toLowerCase();
        const textTags = ['p', 'blockquote', 'li', 'td', 'th', 'div', 'span', 'pre', 'a', 'strong', 'b', 'em', 'i', 'font'];
        
        if (!textTags.includes(tag)) return false;

        // Filtro crítico: Si tiene hijos que son componentes pesados, NO es un bloque de texto puro
        const hasBlockOrComplexChildren = element.querySelector(`
            img, table, video, hr, form, button,
            p, div, h1, h2, h3, h4, h5, h6, ul, ol, blockquote
        `);
        if (hasBlockOrComplexChildren) return false;

        // Si es un div o span, solo lo aceptamos si tiene texto real (no solo espacios)
        if (['div', 'span', 'td', 'th', 'p'].includes(tag)) {
            const textContent = element.textContent || "";
            const hasVisibleText = textContent.trim().length > 0;
            // Permitimos &nbsp;
            const hasHardSpace = textContent.includes('\u00A0') || element.innerHTML.includes('&nbsp;');

            if (!hasVisibleText && !hasHardSpace) return false;
        }

        if (tag === 'span') {
            const hasText = element.textContent?.trim().length || 0;
            if (!hasText) return false;
        }

        return true;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const tag = element.tagName.toLowerCase();
        
        // 1. Extraer estilos del elemento (incluyendo los heredados)
        // Esto captura la fuente MODERN_SANS, colores de CSS global, etc.
        const currentStyles = parser.extractStyles(element, inheritedStyles);

        // 2. USAR LA LÓGICA DEL PARSER ANTIGUO
        // Llamamos a la función que recorre hijos, detecta etiquetas inline y llena el array 'formats'
        const { text, formats, hasListStructure } = parser.processInlineContent(element, currentStyles);

        let finalText = text;
        // Si después de procesar no hay texto, abortamos para que no cree bloques vacíos
        if (!finalText || finalText.trim().length === 0) return null;

        const id = uuidv4();
        const isHeading = /^h[1-6]$/.test(tag);

        let finalStyles = { ...currentStyles };
        let finalFormats = [...formats];
        const fullLength = finalText.length;

        // Filtramos formatos que cubren TODO el texto (start: 0, end: length)
        const globalFormats = finalFormats.filter(f => f.start === 0 && f.end === fullLength);

        // Promovemos esos formatos al estilo del bloque
        globalFormats.forEach(fmt => {
            if (fmt.bold) finalStyles.fontWeight = "bold";
            if (fmt.italic) finalStyles.fontStyle = "italic";
            // Solo aplicamos color si viene del formato y no es negro por defecto
            if (fmt.color) finalStyles.color = fmt.color; 
            if (fmt.fontFamily && fmt.fontFamily !== "MODERN_SANS") finalStyles.fontFamily = fmt.fontFamily;
            if (fmt.fontSize) finalStyles.fontSize = fmt.fontSize;
            
            // Extra: Underline no suele ser estilo de bloque en CSS estándar, pero si tu editor lo soporta:
            if (fmt.underline) finalStyles.textDecoration = "underline"; 
        });

        let explicitAlign = element.getAttribute('align') || element.style.textAlign;
        
        // Si no hay explícita, usamos la calculada por extractStyles
        if (!explicitAlign) {
            explicitAlign = currentStyles.textAlign;
        }
        
        // Si sigue sin haber, usamos la heredada
        if (!explicitAlign || explicitAlign === 'inherit') {
            explicitAlign = inheritedStyles.textAlign || 'left';
        }

        if (!explicitAlign || explicitAlign === 'inherit') {
            explicitAlign = currentStyles.textAlign; // Fallback a lo extraído
        }
        
        if (!explicitAlign || explicitAlign === 'inherit') {
            explicitAlign = inheritedStyles.textAlign || 'left'; // Fallback a herencia
        }
        
        finalStyles.textAlign = explicitAlign;

        // Eliminamos los formatos globales de la lista de formatos inline para no duplicar
        finalFormats = finalFormats.filter(f => f.start !== 0 || f.end !== fullLength);

        const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(finalText);
        
        const hasLineBreaks = finalText.includes('\n');

        // 3. Crear el bloque con el formato exacto del parser antiguo
        parser.addBlock(id, {
            type: isHeading ? "Heading" : "Text",
            data: {
                style: {
                    ...currentStyles,
                    // Aseguramos alineación y colores base si vienen del heredado
                    padding: typeof currentStyles.padding === 'object' ? currentStyles.padding : { top: 0, bottom: 0, left: 0, right: 0 },
                    textAlign: currentStyles.textAlign || inheritedStyles.textAlign || explicitAlign || "left",
                    color: currentStyles.color || inheritedStyles.color || "#000000",
                    fontSize: currentStyles.fontSize || inheritedStyles.fontSize || 16,
                    fontFamily: currentStyles.fontFamily || inheritedStyles.fontSize || "MODERN_SANS",
                    lineHeight: currentStyles.lineHeight || 1.5,
                    whiteSpace: hasListStructure ? "normal" : "pre-wrap",
                },
                props: {
                    text: finalText,
                    formats: finalFormats, // Aquí van tus negritas, links, etc. detectados
                    level: isHeading ? tag : undefined,
                    // Activamos markdown si es una lista o tiene links manuales
                    markdown: hasMarkdownLinks || hasLineBreaks
                }
            }
        });

        return { id };
    }
};



