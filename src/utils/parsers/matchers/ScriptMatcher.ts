import { v4 as uuidv4 } from "uuid";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";


export const ScriptMatcher: BlockMatcher = {
    name: "ScriptMatcher",

    isComponent(element: Element): boolean {
        return element.tagName.toLowerCase() === 'script';
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        
        // Extraemos el contenido (código JS) o el src (archivo externo)
        const content = element.textContent || "";
        const src = element.getAttribute('src');
        const type = element.getAttribute('type') || 'text/javascript';

        parser.addBlock(id, {
            type: "Script", // Necesitas un componente ScriptReader que inyecte esto con cuidado
            data: {
                style: { display: 'none' }, // Los scripts no se ven
                props: {
                    content: content,
                    src: src,
                    type: type,
                    attributes: parser.extractAttributes(element) // Helper opcional para data-attrs
                }
            }
        });

        parser.processedElements.add(element);
        return { id };
    }
};