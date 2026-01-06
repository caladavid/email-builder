import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

// Lista de etiquetas que consideramos "contenido inline" y no deben convertirse en bloques separados
const INLINE_TAGS = ['a', 'span', 'strong', 'b', 'em', 'i', 'u', 'br', 'img', 'small', 'sub', 'sup'];

export const ContainerMatcher: BlockMatcher = {
    name: "ContainerMatcher",

    isComponent(element: Element): boolean {
        const tags = [
            'div', 'section', 'article', 'aside', 'main', 
            'header', 'footer', 'nav', 'address'
        ];
        return tags.includes(element.tagName.toLowerCase());
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        // 1. HEURÍSTICA DE DETECCION DE "LEAF CONTAINER" (CONTENEDOR HOJA)
        // Verificamos si este div contiene solo elementos inline o texto.
        // Si es así, NO debemos dividirlo en sub-bloques, o el menú se romperá (se apilará).
        
        const children = Array.from(element.children);
        const hasBlockChildren = children.some(child => 
            !INLINE_TAGS.includes(child.tagName.toLowerCase())
        );

        // Si NO tiene hijos de bloque (ej: solo tiene <a> y <span>), 
        // cambiamos la estrategia: Esto no es un Container, es un TEXT BLOCK complejo.
        if (!hasBlockChildren && children.length > 0) {
             // Opcional: Podrías delegar esto al TextMatcher si prefieres, 
             // o manejarlo aquí como un bloque de "RawHTML" o "RichText".
             return processAsRichText(element, parser, inheritedStyles);
        }

        // --- LÓGICA ESTÁNDAR DE CONTENEDOR (Solo si hay estructura compleja dentro) ---
        
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        const childrenIds: string[] = [];

        // Procesamos hijos recursivamente (porque sabemos que hay bloques dentro)
        parser.processChildren(element, childrenIds, styles);

        parser.addBlock(id, {
            type: "Container",
            data: {
                style: {
                    ...styles,
                    display: styles.display || 'block',
                    boxSizing: 'border-box'
                },
                props: {
                    childrenIds: childrenIds,
                    tagName: element.tagName.toLowerCase(),
                    className: element.getAttribute('class'),
                    id: element.getAttribute('id')
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    },

    // Método auxiliar para manejar divs que actúan como párrafos (tu caso del menú)
    
};

function processAsRichText(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        
        // AQUÍ ESTÁ LA CLAVE: Tomamos el innerHTML completo.
        // Preservamos la relación entre <a> y <span> tal cual.
        const content = element.innerHTML.trim(); 

        parser.addBlock(id, {
            type: "Text", // O "RichText", según tu editor
            data: {
                style: {
                    ...styles,
                    // Aseguramos que el texto fluya
                    display: styles.display || 'block', 
                },
                props: {
                    content: content, // Guardamos el HTML interno (<a...>Home</a> | <a...>Page</a>)
                    tagName: 'div' // Renderizaremos un div que contiene HTML
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        
        // Marcamos también todos los hijos como procesados para que el parser principal no intente
        // crear bloques para los <a> y <span> después.
        Array.from(element.querySelectorAll('*')).forEach(child => {
            parser.processedElements.add(child);
        });

        return { id };
    }