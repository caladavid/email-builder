import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";

export const TextElementsMatcher: BlockMatcher = {
    name: "TextElements",

    isComponent(element: Element, parser: HTMLToBlockParser) {
        const tag = element.tagName.toLowerCase();
        const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'td', 'div', 'span'];
        
        if (!textTags.includes(tag)) return false;

        // Filtro crítico: Si tiene hijos que son componentes pesados, NO es un bloque de texto puro
        const hasComplexChildren = element.querySelector('img, table, button, video, hr');
        if (hasComplexChildren) return false;

        // Si es un div o span, solo lo aceptamos si tiene texto real (no solo espacios)
        if (['div', 'span'].includes(tag)) {
            return (element.textContent?.trim().length || 0) > 0;
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

        // Si después de procesar no hay texto, abortamos para que no cree bloques vacíos
        if (!text || text.trim().length === 0) return null;

        const id = uuidv4();
        const isHeading = /^h[1-6]$/.test(tag);

        // 3. Crear el bloque con el formato exacto del parser antiguo
        parser.addBlock(id, {
            type: isHeading ? "Heading" : "Text",
            data: {
                style: {
                    ...currentStyles,
                    // Aseguramos alineación y colores base si vienen del heredado
                    padding: typeof currentStyles.padding === 'object' ? currentStyles.padding : { top: 0, bottom: 0, left: 0, right: 0 },
                    textAlign: currentStyles.textAlign || inheritedStyles.textAlign || "left",
                    color: currentStyles.color || inheritedStyles.color || "#000000",
                    fontSize: currentStyles.fontSize || inheritedStyles.fontSize || 16,
                    fontFamily: currentStyles.fontFamily || inheritedStyles.fontSize || "MODERN_SANS",
                    lineHeight: currentStyles.lineHeight || 1.5
                },
                props: {
                    text: text,
                    formats: formats, // Aquí van tus negritas, links, etc. detectados
                    level: isHeading ? tag : undefined,
                    // Activamos markdown si es una lista o tiene links manuales
                    markdown: hasListStructure || text.includes('[') 
                }
            }
        });

        return { id };
    }
};



