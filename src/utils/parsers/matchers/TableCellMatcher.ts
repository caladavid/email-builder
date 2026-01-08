import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const TableCellMatcher: BlockMatcher = {
    name: "TableCellMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        
        // 1. Identificación básica
        if (!['td', 'th'].includes(tag) && !element.getAttribute('style')?.includes('display: table-cell')) {
            return false;
        }

        // 2. 🔥 SMART UNWRAP: Si es solo texto, DEJAR PASAR.
        // Esto permite que TextElementsMatcher lo agarre.
        // Pero si TextElementsMatcher falla o no está, esto podría causar que el texto desaparezca.
        // Así que somos cuidadosos: Solo dejamos pasar si estamos SEGUROS que es texto simple.
        
        const hasBlockChildren = Array.from(element.children).some(child => {
            const t = child.tagName.toLowerCase();
            const s = child.getAttribute('style') || '';
            return ['table', 'img', 'div', 'ul', 'ol', 'form', 'hr', 'blockquote'].includes(t) || 
                   /display\s*:\s*(block|inline-block|flex|grid)/i.test(s) ||
                   (t === 'a' && /\b(btn|button)\b/i.test(child.className));
        });

        // Si NO tiene bloques hijos y tiene texto, devolvemos false para que TextElementsMatcher lo tome.
        if (!hasBlockChildren && (element.textContent?.trim().length || 0) > 0) {
            return false; 
        }

        return true;
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        
        // --- Normalización ---
        let w = styles.width || element.getAttribute('width');
        if (w && !isNaN(Number(w))) w += 'px';
        const finalWidth = w || '100%';

        // --- Decisión de Tipo de Bloque ---
        // Si no tiene atributos de fusión (colspan/rowspan), lo tratamos como un Container
        // para máxima compatibilidad con el sistema Legacy y flexibilidad.
        const hasSpans = element.hasAttribute('colspan') || element.hasAttribute('rowspan');
        
        // NOTA: Cambiamos a 'Container' por defecto para evitar estructuras rígidas de tabla
        // a menos que sea explícitamente necesario.
        const blockType = hasSpans ? "TableCell" : "Container";

        // Ajustes de estilo según tipo
        if (blockType === "Container") {
            styles.display = 'block';
            styles.width = '100%';
            styles.boxSizing = 'border-box';
        } else {
            styles.display = 'table-cell';
            styles.verticalAlign = element.getAttribute('valign') || styles.verticalAlign || 'top';
        }

        // --- Procesar Hijos ---
        const childrenIds: string[] = [];
        const stylesForChildren = { ...styles };
        // Limpiar estilos que no deben heredarse (padding, borde, fondo)
        ['padding', 'border', 'background', 'backgroundColor', 'width', 'height', 'verticalAlign', 'textAlign'].forEach(p => delete stylesForChildren[p]);

        // Limpieza de espacios vacíos (Text nodes que son solo saltos de línea)
        Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === 3 && !node.textContent?.trim()) {
                // No hacemos nada, efectivamente ignorándolo en el loop de procesamiento
                return;
            }
        });

        // Procesamos los hijos
        parser.processChildren(element, childrenIds, stylesForChildren);

        // 🔥 PROTECCIÓN CONTRA CELDAS VACÍAS
        // Si después de procesar hijos no hay IDs, y la celda tenía texto que fue "ignorado"
        // o limpiado, debemos recuperar ese texto.
        if (childrenIds.length === 0) {
            const textContent = element.textContent?.trim();
            if (textContent) {
                // Crear manualmente un bloque de texto si algo falló
                const textId = parser.createTextBlock(textContent, [], stylesForChildren);
                if (textId) childrenIds.push(textId);
            }
        }

        // --- Crear Bloque ---
        const blockData: any = {
            style: styles,
            props: {
                childrenIds: childrenIds,
                tagName: blockType === 'TableCell' ? element.tagName.toLowerCase() : 'div',
            }
        };

        if (blockType === "TableCell") {
            blockData.props.colspan = parseInt(element.getAttribute('colspan') || '1');
            blockData.props.rowspan = parseInt(element.getAttribute('rowspan') || '1');
            blockData.props.width = finalWidth;
            blockData.props.align = styles.textAlign;
            blockData.props.valign = styles.verticalAlign;
        } else {
             // Container props
             blockData.props.id = element.id;
             blockData.props.className = element.className;
        }

        parser.addBlock(id, {
            type: blockType,
            data: blockData
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    }
};