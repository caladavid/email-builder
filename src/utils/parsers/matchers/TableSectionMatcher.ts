import { v4 as uuidv4 } from "uuid";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const TableSectionMatcher: BlockMatcher = {
    name: "TableSectionMatcher",

    isComponent(element: Element): boolean {
        return ['thead', 'tbody', 'tfoot'].includes(element.tagName.toLowerCase());
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const tag = element.tagName.toLowerCase(); // 'thead' | 'tbody' | 'tfoot'
        const styles = parser.extractStyles(element, inheritedStyles);

        const childrenIds: string[] = [];
        // Sus hijos serán típicamente 'tr' (TableRow)
        parser.processChildren(element, childrenIds, styles);

        parser.addBlock(id, {
            type: "TableSection", // Necesitas un componente TableSectionReader.vue
            data: {
                style: { ...styles, display: 'table-row-group' }, // CSS default para tbody
                props: {
                    childrenIds,
                    tagName: tag, // Pasamos el tag para usar <component :is="tagName">
                    id: element.id,
                    className: element.className
                }
            }
        });

        parser.processedElements.add(element);
        return { id };
    }
};