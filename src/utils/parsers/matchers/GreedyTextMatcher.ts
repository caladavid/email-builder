import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const GreedyTextMatcher: BlockMatcher = {
    name: "GreedyTextMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        
        // Buscamos contenedores que suelen agrupar texto
        if (!['div', 'td', 'th', 'li'].includes(tag)) return false;

        // Si está vacío, lo ignoramos
        if (!element.textContent?.trim()) return false;

        // VERIFICACIÓN INTELIGENTE:
        // Si el contenedor tiene hijos "bloque" (tablas, imagenes, videos, botones), 
        // NO podemos fusionarlo, debe seguir siendo un contenedor.
        const allDescendants = Array.from(element.querySelectorAll('*'));
        
        const hasHeavyContent = allDescendants.some(node => {
            const nodeTag = node.tagName.toLowerCase();
            
            // Lista negra: Si contiene esto, NO es un bloque de texto puro
            const heavyTags = [
                'table', 'img', 'video', 'iframe', 'svg', 
                'form', 'input', 'select', 'textarea', 'hr',
                'ul', 'ol' 
            ];
            
            if (heavyTags.includes(nodeTag)) return true;

            // Detectar si hay un enlace que parece botón (con padding/background)
            if (nodeTag === 'a') {
                const style = node.getAttribute('style') || '';
                if ((style.includes('display: block') || style.includes('display: inline-block')) && 
                    style.includes('padding') && style.includes('background')) {
                    return true; // Es un botón, no texto
                }
            }
            return false;
        });

        // Si NO tiene contenido pesado, nos lo "comemos" entero como un solo texto
        return !hasHeavyContent;
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);

        // TRUCO: Usamos innerHTML para capturar todo el formato (b, strong, span colors, br) de una vez.
        // Esto crea un solo bloque editable en lugar de múltiples bloques hijos.
        const content = element.innerHTML.trim();

        if (!content) return null;

        parser.addBlock(id, {
            type: "Text", // Usamos el bloque Text genérico
            data: {
                style: {
                    ...styles,
                    display: styles.display || 'block', 
                    // Aseguramos que el padding del contenedor se aplique al texto
                    padding: styles.padding,
                    boxSizing: 'border-box'
                },
                props: {
                    text: content, // El contenido HTML completo
                    // Importante: Asegúrate que tu componente Text soporte renderizar HTML (v-html)
                    markdown: false 
                }
            }
        });

        // Marcamos el elemento Y TODOS sus hijos como procesados para que el parser no siga bajando
        parser.processedElements.add(element);
        Array.from(element.querySelectorAll('*')).forEach(child => parser.processedElements.add(child));

        return { id };
    }
};