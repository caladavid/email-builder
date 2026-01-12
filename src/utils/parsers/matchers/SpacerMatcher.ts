import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";

export const SpacerMatcher: BlockMatcher = {
    name: "Spacer",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();
        
        // Puede ser un div vacío, un hr invisible o un br con estilo
        if (!['div', 'br', 'hr', 'table'].includes(tag)) return false;

        const styles = StyleUtils.extractUnifiedStyles(element, {});
        
        // Condiciones para ser Spacer:
        // 1. Debe tener altura definida
        const hasHeight = styles.height && parseInt(styles.height) > 0;
        // 2. Debe estar vacío de texto
        const isEmpty = !element.textContent?.trim() && element.children.length === 0;
        
        // Caso especial: <br> siempre es vacío, si tiene display block es candidato
        if (tag === 'br' && styles.display === 'block' && hasHeight) return true;

        // Caso especial: HR invisible (sin borde) es un espaciador
        if (tag === 'hr') {
            const isInvisible = styles.border === 'none' || styles.border === '0px' || styles.visibility === 'hidden';
            if (isInvisible && hasHeight) return true;
            return false; // Si es visible, es un Separator, no Spacer
        }

        return isEmpty && hasHeight;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);
        
        const height = parseInt(styles.height) || 20;

        parser.addBlock(id, {
            type: "Spacer", // Mapea a tu bloque "Espaciador"
            data: {
                style: {
                    // El espaciador suele ser transparente
                    backgroundColor: styles.backgroundColor || null,
                    display: 'block',
                    width: '100%'
                },
                props: {
                    height: height
                }
            }
        });

        console.log(`📏 [SpacerMatcher] Espaciador de ${height}px creado`);
        return { id };
    }
};