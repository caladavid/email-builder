import { v4 as uuidv4 } from "uuid";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const HeadingMatcher: BlockMatcher = {
    name: "Heading",

    // 1. Detección Exclusiva para Encabezados
    isComponent(element: Element) {
        return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName.toLowerCase());
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        
        // Extraemos estilos base del elemento
        const currentStyles = parser.extractStyles(element, inheritedStyles);
        const tag = element.tagName.toLowerCase();

        // 2. Procesamiento de Contenido Inline (Aquí detectamos el <strong> interno)
        // Usamos la misma función robusta que ya tienes en el parser para texto
        const { text, formats } = parser.processInlineContent(element, currentStyles);

        const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
        
        if (!cleanText) return null; // Ignorar encabezados vacíos

        // 3. Normalización de Estilos para Encabezados
        const finalStyles = { ...currentStyles };
        
        // Si el parser detectó que TODO el texto es bold (por el <strong> envolvente),
        // promovemos ese estilo al bloque y limpiamos el formato inline redundante.
        const isAllBold = formats.length === 1 && formats[0].bold && formats[0].start === 0 && formats[0].end === cleanText.length;
        
        if (isAllBold) {
            finalStyles.fontWeight = 'bold';
            formats.length = 0; // Vaciamos formats porque ya lo aplicamos al estilo
        } else {
            // Si el H1 tiene font-weight normal pero tiene un strong adentro, 
            // processInlineContent ya habrá llenado 'formats' correctamente.
            // Aseguramos que el estilo base sea el del H1 original.
            finalStyles.fontWeight = currentStyles.fontWeight || 'normal';
        }

        // Mapeo de niveles (h1 -> h1, etc.)
        const level = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) ? tag : 'h2';

        parser.addBlock(id, {
            type: "Heading",
            data: {
                style: {
                    ...finalStyles,
                    // Aseguramos propiedades críticas
                    display: 'block',
                    wordBreak: 'break-word',
                    // Si no hay alineación explícita, los headings suelen centrarse o ir a la izquierda según el email
                    textAlign: finalStyles.textAlign || 'left' 
                },
                props: {
                    text: cleanText,
                    level: level,
                    formats: formats, // ✅ Pasamos los formatos (negritas parciales, itálicas, etc.)
                    markdown: false // Por defecto false, a menos que detectes links MD
                }
            }
        });

        return { id };
    }
};