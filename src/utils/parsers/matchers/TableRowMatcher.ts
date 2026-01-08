import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const TableRowMatcher: BlockMatcher = {
    name: "TableRowMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        // Detectar TR o div que actúa como fila
        if (tag === 'tr') return true;
        const style = element.getAttribute('style') || '';
        return /display\s*:\s*table-row/i.test(style);
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        
        // Normalización estructural
        styles.display = 'table-row';
        styles.width = '100%'; // Las filas siempre ocupan todo el ancho de la tabla

        const childrenIds: string[] = [];
        
        // Procesamos los hijos. Esto delegará al TableCellMatcher.
        parser.processChildren(element, childrenIds, styles);

        // Si por alguna razón no hay hijos, intentamos rescatar texto huérfano (raro en TR, pero posible en HTML sucio)
        if (childrenIds.length === 0 && element.textContent?.trim()) {
             const textId = parser.createTextBlock(element.textContent, [], styles);
             if (textId) childrenIds.push(textId);
        }

        parser.addBlock(id, {
            type: "TableRow",
            data: {
                style: styles,
                props: {
                    childrenIds: childrenIds,
                    tagName: element.tagName.toLowerCase()
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    }
};