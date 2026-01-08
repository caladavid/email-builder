import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

// Detectamos displays modernos
const LAYOUT_DISPLAYS = ['flex', 'inline-flex', 'grid', 'inline-grid'];

export const LayoutTableMatcher: BlockMatcher = {
    name: "LayoutTableMatcher",

    isComponent(element: Element): boolean {
        // Ignoramos tablas reales
        if (element.tagName.toLowerCase() === 'table') return false;

        const style = element.getAttribute('style') || '';
        
        // Regex seguro para detectar flex/grid
        // Busca "display: flex" o "display: grid"
        return LAYOUT_DISPLAYS.some(d => new RegExp(`display\\s*:\\s*${d}(?![-\\w])`, 'i').test(style));
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);

        if (!styles.width || styles.width === 'auto') styles.width = '100%';

        // Preservamos propiedades de layout vitales
        const layoutProps = {
            display: styles.display,
            flexDirection: styles.flexDirection,
            justifyContent: styles.justifyContent,
            alignItems: styles.alignItems,
            flexWrap: styles.flexWrap,
            gap: styles.gap,
            gridTemplateColumns: styles.gridTemplateColumns
        };

        const childrenIds: string[] = [];
        parser.processChildren(element, childrenIds, styles);

        // Si es un layout vacío, lo ignoramos
        if (childrenIds.length === 0 && !styles.backgroundColor && !styles.height) {
            return null;
        }

        parser.addBlock(id, {
            type: "Container", // Usamos Container genérico pero con estilos de layout
            data: {
                style: {
                    ...styles,
                    ...layoutProps, 
                    boxSizing: 'border-box'
                },
                props: {
                    childrenIds: childrenIds,
                    tagName: element.tagName.toLowerCase(),
                    id: element.id,
                    className: element.className
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    }
};