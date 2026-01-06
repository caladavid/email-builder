import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

// Etiquetas que consideramos contenido inline (que deben ir juntas)
const INLINE_TAGS = ['a', 'span', 'strong', 'b', 'em', 'i', 'u', 'br', 'small', 'sub', 'sup', 'code', 'label'];

export const MixedContentMatcher: BlockMatcher = {
    name: "MixedContentMatcher",

    isComponent(element: Element): boolean {
        // Ignoramos tablas y filas, eso lo maneja TableBlockMatcher
        if (['table', 'tbody', 'tr', 'td', 'th', 'img'].includes(element.tagName.toLowerCase())) return false;

        const children = Array.from(element.children);
        
        // Si no tiene hijos pero tiene texto, lo atrapamos aquí (o TextMatcher)
        if (children.length === 0 && element.textContent?.trim()) return true;

        // Verificamos si tiene algún hijo que SEA UN BLOQUE (div, p, table, h1...)
        // Si encontramos un bloque dentro, dejamos que el ContainerMatcher lo maneje.
        const hasBlockChildren = children.some(child => 
            !INLINE_TAGS.includes(child.tagName.toLowerCase())
        );

        // Si NO tiene hijos de bloque, es contenido mezclado seguro para el bloque Html
        return !hasBlockChildren && (children.length > 0 || (element.textContent || '').trim().length > 0);
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        
        // Obtenemos el HTML interno tal cual
        const rawHtml = element.innerHTML;

        parser.addBlock(id, {
            type: "Html", 
            data: {
                style: {
                    ...styles,
                    // Forzamos display block en el contenedor para que ocupe el espacio
                    display: styles.display || 'block', 
                },
                props: {
                    // --- LA CORRECCIÓN ---
                    // Tu esquema Zod exige 'contents'.
                    contents: rawHtml, 
                    
                    tagName: element.tagName.toLowerCase()
                }
            }
        });

        // Marcamos este elemento y todos sus hijos como procesados para evitar duplicados
        if (parser.processedElements) {
            parser.processedElements.add(element);
            const descendants = element.querySelectorAll('*');
            descendants.forEach(d => parser.processedElements.add(d));
        }

        return { id };
    }
};