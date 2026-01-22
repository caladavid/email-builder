import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

const INLINE_CONTENT_TAGS = ['a', 'span', 'b', 'strong', 'i', 'em', 'u', 'small', 'img', 'br', 'code', 'label'];

const VALID_CHILDREN: Record<string, string[]> = {
    'table': ['tbody', 'thead', 'tfoot', 'caption', 'colgroup', 'tr'], 
    'tbody': ['tr'],
    'thead': ['tr'],
    'tfoot': ['tr'],
    'tr': ['td', 'th']
};

export const TableBlockMatcher: BlockMatcher = {
    name: "TableBlockMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        const children = Array.from(element.children);

        // 1. DETECCIÓN DE CORRUPCIÓN
        if (tag === 'div' && children.some(c => ['tr', 'tbody', 'td', 'th'].includes(c.tagName.toLowerCase()))) return true;

        if (VALID_CHILDREN[tag]) {
            const hasInvalid = children.some(c => !VALID_CHILDREN[tag].includes(c.tagName.toLowerCase()) && !['script', 'style'].includes(c.tagName.toLowerCase()));
            if (hasInvalid) return true;
        }

        if (['tr', 'tbody', 'td', 'th'].includes(tag)) return true;

        // 2. DETECCIÓN ESTÁNDAR
        if (tag === 'table') return true;
        if (!element.getAttribute('style')?.includes('display: table')) return false;
        if (element.getAttribute('role') === 'presentation') return true;

        const style = element.getAttribute('style') || '';
        if (/display\s*:\s*table(?![-\w])/i.test(style)) {
             if (children.length === 0) return false;
             return children.some(child => !INLINE_CONTENT_TAGS.includes(child.tagName.toLowerCase()));
        }

        return false;
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        const tag = element.tagName.toLowerCase();
        const children = Array.from(element.children);
        const hasText = element.textContent?.trim().length || 0;
        const hasImg = element.querySelector('img');

        if (!hasText && !hasImg) {
            return null; 
        }

        let needsRescue = false;

        if (tag === 'div' && children.some(c => ['tr', 'tbody', 'td', 'th'].includes(c.tagName.toLowerCase()))) needsRescue = true;
        else if (VALID_CHILDREN[tag] && children.some(c => !VALID_CHILDREN[tag].includes(c.tagName.toLowerCase()) && !['script', 'style'].includes(c.tagName.toLowerCase()))) needsRescue = true;
        else if (['tr', 'tbody', 'td', 'th'].includes(tag)) needsRescue = true;

        if (needsRescue) {
            return processCorruptStructure(element, parser, inheritedStyles);
        }

        // --- LÓGICA ESTÁNDAR (Intacta) ---
        const anchors = element.querySelectorAll('a');
        if (anchors.length === 1 && element.textContent?.trim() === anchors[0].textContent?.trim()) {
             const tableStyles = parser.extractStyles(element, inheritedStyles);
             const cell = element.querySelector('td');
             const combinedStyles = cell ? parser.extractStyles(cell, tableStyles) : tableStyles;
             const cleanStyles = { ...combinedStyles, border: undefined, borderWidth: undefined, borderColor: undefined };
             const hasBg = combinedStyles.backgroundColor && combinedStyles.backgroundColor !== 'transparent';
             const hasBorder = combinedStyles.border && combinedStyles.border !== 'none';
             const hasVButton = anchors[0].classList.contains('v-button');

             if (hasBg || hasBorder || hasVButton) {
                 const btnRes = parser.parseElement(anchors[0], cleanStyles);
                 if (btnRes) { parser.processedElements.add(element); return btnRes; }
             }
        }

        const isRow = (el: Element) => el.tagName.toLowerCase() === 'tr' || /display\s*:\s*table-row/i.test(el.getAttribute('style') || '');
        const isCell = (el: Element) => ['td','th'].includes(el.tagName.toLowerCase()) || /display\s*:\s*table-cell/i.test(el.getAttribute('style')||'');

        let rawRows: Element[] = [];
        let areRowsVirtual = false;

        const directRows = children.filter(c => isRow(c));
        if (directRows.length > 0) {
            rawRows = directRows;
        } else {
            const sections = children.filter(c => ['tbody', 'thead', 'tfoot'].includes(c.tagName.toLowerCase()));
            sections.forEach(section => {
                rawRows.push(...Array.from(section.children).filter(r => isRow(r)));
                parser.processedElements.add(section);
            });
            if (rawRows.length === 0) {
                const directCells = children.filter(c => isCell(c));
                if (directCells.length > 0) {
                    rawRows = [element]; 
                    areRowsVirtual = true;
                }
            }
        }

        if (rawRows.length === 0) return null;

        const firstRowNode = areRowsVirtual ? element : rawRows[0];
        const cellsInFirstRow = Array.from(firstRowNode.children).filter(c => isCell(c));

        if (rawRows.length === 1 && cellsInFirstRow.length === 1) {
            return processAsWrapperContainer(element, cellsInFirstRow[0], parser, inheritedStyles);
        }
        if (rawRows.length === 1 && cellsInFirstRow.length > 1) {
            return processAsColumnsContainer(element, rawRows[0], cellsInFirstRow, parser, inheritedStyles);
        }
        return processAsLayoutTable(element, rawRows, areRowsVirtual, parser, inheritedStyles);
    }
};

// =============================================================================
// HELPER DE REPARACIÓN (Con Detección Inteligente de Layout ROW y Agrupamiento de Texto)
// =============================================================================
function processCorruptStructure(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
    const containerId = uuidv4();
    const styles = parser.extractStyles(element, inheritedStyles);

    // 1. ANÁLISIS DE CONTENIDO: ¿Es esto un grupo de iconos?
    let isIconGroup = false;
    let iconRow: Element | null = null;
    let iconCells: Element[] = [];
    
    const innerTable = element.querySelector('table') || element.querySelector('tbody') || element;
    const allImages = innerTable.querySelectorAll('img');
    
    if (allImages.length >= 2) {
        isIconGroup = true;
        const possibleRows = element.querySelectorAll('tr');
        if (possibleRows.length > 0) {
            iconRow = possibleRows[0];
            iconCells = Array.from(iconRow.children).filter(c => 
                ['td', 'th', 'div', 'span'].includes(c.tagName.toLowerCase())
            );
        } else {
            iconCells = Array.from(element.children).filter(c => 
                ['td', 'th', 'div', 'span'].includes(c.tagName.toLowerCase())
            );
        }
    }

    if (isIconGroup && iconCells.length >= 2) {
        const tempRow = iconRow || element;
        return processAsColumnsContainer(element, tempRow, iconCells, parser, inheritedStyles);
    }

    // Fix Alturas
    if (styles.height && styles.height !== 'auto' && !styles.height.includes('%')) {
        styles.minHeight = styles.height; 
        delete styles.height;
    }

    // 2. APLICACIÓN DINÁMICA DE ESTILOS FLEX
    const containerStyle = {
        ...styles,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: 'auto',
        minHeight: 'auto',
        boxSizing: 'border-box',
        borderCollapse: undefined,
        borderSpacing: undefined,
        tableLayout: undefined,
        verticalAlign: undefined,
        padding: styles.padding,
        margin: styles.margin,
        backgroundColor: styles.backgroundColor
    };

    if (element.tagName.toLowerCase() === 'td') {
        const vAlign = element.getAttribute('valign');
        if (vAlign === 'middle') containerStyle.justifyContent = 'center';
        if (vAlign === 'bottom') containerStyle.justifyContent = 'flex-end';
    }

    const childrenIds: string[] = [];
    const childNodes = Array.from(element.childNodes);
    
    const childInheritedStyles = { 
        ...styles, 
        display: undefined, width: undefined, height: undefined, 
        margin: undefined, padding: undefined, backgroundColor: undefined 
    };

    // --- 🚀 LÓGICA DE BUFFER (MODIFICADA SOLO AQUÍ PARA BOLDS) ---
    let textBuffer: Node[] = [];

    const flushTextBuffer = () => {
        if (textBuffer.length === 0) return;

        // Si es un solo elemento y NO es un tag de formato simple (b, strong, span), 
        // dejamos que el parser decida (útil para divs anidados con estilos complejos).
        // Pero si es texto mezclado con bolds, forzamos el bloque de texto.
        if (textBuffer.length === 1 && textBuffer[0].nodeType === Node.ELEMENT_NODE) {
             const node = textBuffer[0] as Element;
             const tag = node.tagName.toLowerCase();
             
             // Si NO es un contenedor de texto simple, procesamos normal
             if (!['span', 'b', 'strong', 'i', 'em', 'u', 'a'].includes(tag)) {
                 const res = parser.parseElement(node, childInheritedStyles);
                 if (res) childrenIds.push(res.id);
                 textBuffer = [];
                 return;
             }
        }

        // --- CAMBIO: Fusión Forzada para Bolds y Texto Continuo ---
        const wrapper = document.createElement('div');
        textBuffer.forEach((n, index) => {
            // [MODIFICADO] Solo rompemos línea si es div/p/li. 
            // Si es strong/b/span, pasamos directo para que quede pegado.
            if (index > 0 && n.nodeType === Node.ELEMENT_NODE) {
                const t = (n as Element).tagName.toLowerCase();
                if (['div', 'p', 'li'].includes(t)) {
                    wrapper.appendChild(document.createElement('br'));
                }
            }
            wrapper.appendChild(n.cloneNode(true));
        });
        
        // Usamos processInlineContent para obtener el texto + formatos (bold, italic, etc.)
        // Esto evita que se creen bloques separados.
        const { text, formats } = parser.processInlineContent(wrapper, childInheritedStyles);
        
        if (text && text.trim().length > 0) {
            // Creamos UN solo bloque de texto con todo el contenido
            const textId = parser.createTextBlock(text, formats, childInheritedStyles, true);
            if (textId) childrenIds.push(textId);
        }
        textBuffer = [];
    };

    const isMergeableContent = (node: Node): boolean => {
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent?.trim().length || 0) > 0;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();
            if (['img', 'table', 'tbody', 'thead', 'tfoot', 'tr'].includes(tag)) return false;
            if (['strong', 'b', 'i', 'em', 'span', 'u', 'small', 'sub', 'sup'].includes(tag)) return true;
            if (tag === 'a' && (el.className.includes('button') || el.getAttribute('style')?.includes('background-color') || el.querySelector('img'))) return false;
            if (el.querySelector('img')) return false;
            return true;
        }
        return false;
    };

    childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim() && textBuffer.length === 0) return;

        if (isMergeableContent(node)) {
            textBuffer.push(node);
        } else {
            flushTextBuffer();

            if (node.nodeType === Node.ELEMENT_NODE) {
                const childEl = node as Element;
                const childTag = childEl.tagName.toLowerCase();

                if (childTag === 'tr') {
                    const cells = Array.from(childEl.children).filter(c => ['td', 'th'].includes(c.tagName.toLowerCase()));
                    if (cells.length > 1) {
                        const colRes = processAsColumnsContainer(element, childEl, cells, parser, childInheritedStyles);
                        if (colRes) childrenIds.push(colRes.id);
                    } else if (cells.length === 1) {
                        const res = processCorruptStructure(cells[0], parser, childInheritedStyles); 
                        if (res) childrenIds.push(res.id);
                    }
                } 
                else if (['tbody', 'thead', 'tfoot'].includes(childTag)) {
                    const res = processCorruptStructure(childEl, parser, childInheritedStyles);
                    if (res) childrenIds.push(res.id);
                } 
                else {
                    const res = parser.parseElement(childEl, childInheritedStyles);
                    if (res) childrenIds.push(res.id);
                }
            }
        }
    });

    flushTextBuffer();

    // =========================================================
    // 🔥 LOGICA DE SPACER / VACÍOS (INTACTA) 🔥
    // =========================================================
    if (childrenIds.length === 0) {
        const attrHeight = element.getAttribute('height');
        const styleHeight = styles.height;
        
        let spacerHeight = 0;
        if (attrHeight && /^\d+$/.test(attrHeight)) {
            spacerHeight = parseInt(attrHeight);
        } else if (styleHeight && String(styleHeight).includes('px')) {
            spacerHeight = parseInt(String(styleHeight));
        }

        const bg = styles.backgroundColor;
        const hasVisibleBg = bg && bg !== 'transparent' && !bg.includes('rgba(0, 0, 0, 0)') && bg.toLowerCase() !== '#ffffff';

        if (spacerHeight > 5) {
            const spacerId = uuidv4();
            parser.addBlock(spacerId, {
                type: "Spacer",
                data: {
                    style: { 
                        backgroundColor: hasVisibleBg ? bg : undefined 
                    },
                    props: { height: spacerHeight }
                }
            });
            return { id: spacerId };
        }

        if (!hasVisibleBg) {
            return null;
        }
    }
    // =========================================================

    parser.addBlock(containerId, {
        type: "Container",
        data: {
            style: containerStyle,
            props: { childrenIds: childrenIds, tagName: 'div' }
        }
    });

    parser.processedElements.add(element);
    return { id: containerId };
}

function processAsWrapperContainer(tableEl: Element, cellEl: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const id = uuidv4();
    const tableStyles = parser.extractStyles(tableEl, inheritedStyles);
    const cellStyles = parser.extractStyles(cellEl, tableStyles);

    if ((tableStyles.borderWidth === 'medium' || tableStyles.border === 'medium') && !tableStyles.borderColor) {
        delete tableStyles.border;
        delete tableStyles.borderWidth;
        delete tableStyles.borderStyle;
        delete tableStyles.borderColor;
    }

    const mergedStyle = {
        ...tableStyles,
        ...cellStyles,
        display: 'block', 
        width: '100%',
        boxSizing: 'border-box',
        // 🔥 FIX: FORZAR ALTURA AUTOMÁTICA
        // Esto evita que contenedores como el del botón (icmyk) se queden fijos en 75px
        height: 'auto',
        minHeight: 'auto'
    };
    
    const align = cellEl.getAttribute('align') || cellEl.getAttribute('valign');
    if (align && align !== 'top') mergedStyle.textAlign = align === 'middle' ? 'center' : align;

    const childrenIds: string[] = [];
    const stylesForKids = { ...mergedStyle };
    // Limpiamos estilos peligrosos para los hijos
    [
        'padding', 'backgroundColor', 'width', 'height', 'margin', 'minHeight',
        'border', 'borderWidth', 'borderColor', 'borderStyle', 'borderRadius'
    ].forEach(p => delete stylesForKids[p]);

    // Limpieza de nodos vacíos
    Array.from(cellEl.childNodes).forEach(node => {
        if (node.nodeType === 3 && !node.textContent?.trim()) cellEl.removeChild(node);
    });

    // 🔥 FIX ADICIONAL: Limpiar altura del DOM antes de procesar hijos
    // Esto asegura que si hay tablas anidadas, no hereden la altura fija
    cellEl.removeAttribute('height');
    cellEl.style.height = 'auto';

    parser.processChildren(cellEl, childrenIds, stylesForKids);

    parser.addBlock(id, {
        type: "Container",
        data: {
            style: mergedStyle,
            props: {
                childrenIds: childrenIds,
                tagName: 'div',
                id: tableEl.id || cellEl.id,
                className: tableEl.className
            }
        }
    });

    parser.processedElements.add(tableEl);
    if (tableEl !== cellEl) parser.processedElements.add(cellEl);
    if (cellEl.parentElement && cellEl.parentElement !== tableEl) parser.processedElements.add(cellEl.parentElement);

    return { id };
}

function applyGenericCentering(element: Element, styles: any): any {
    const styleStr = element.getAttribute('style')?.toLowerCase() || '';
    const alignAttr = element.getAttribute('align')?.toLowerCase();
    const parentAlign = element.parentElement?.getAttribute('align')?.toLowerCase();

    const isFixedBlock = styles.maxWidth && styles.maxWidth !== '100%';

    const hasCenterIntent = alignAttr === 'center' || 
                            parentAlign === 'center' || 
                            styleStr.includes('margin:0 auto') || 
                            styleStr.includes('margin: 0 auto');

    if (isFixedBlock && hasCenterIntent) {
        return {
            ...styles,
            textAlign: 'center', 
            marginLeft: 'auto', 
            marginRight: 'auto', 
            display: 'block' 
        };
    }
    return styles;
}

function processAsColumnsContainer(tableEl: Element, rowEl: Element, cells: Element[], parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const id = uuidv4();

    let tableStyles = parser.extractStyles(tableEl, inheritedStyles);
    
    // 🎯 FUNCIÓN AUXILIAR GENÉRICA PARA VERIFICAR SI EL PADDING ES CERO
    const isZeroPadding = (padding: any): boolean => {
        if (!padding) return true;
        if (typeof padding === 'string') {
            return padding === '0' || padding === '0px' || padding === '0px 0px 0px 0px';
        }
        if (typeof padding === 'object') {
            // Verificar si es un objeto con propiedades top, right, bottom, left
            if ('top' in padding && 'right' in padding && 'bottom' in padding && 'left' in padding) {
                const top = parseFloat(padding.top?.toString() || '0');
                const right = parseFloat(padding.right?.toString() || '0');
                const bottom = parseFloat(padding.bottom?.toString() || '0');
                const left = parseFloat(padding.left?.toString() || '0');
                return top === 0 && right === 0 && bottom === 0 && left === 0;
            }
        }
        return true;
    };
    

    // 1. BUSCAR EN TABLAS HIJAS (si el elemento actual no es una tabla)
    if (tableEl.tagName.toLowerCase() !== 'table') {
        
        const childTables = tableEl.querySelectorAll('table');
        for (const childTable of childTables) {
            const childStyle = childTable.getAttribute('style');
            if (childStyle) {
                
                // Extraer estilos de la tabla hija
                const childStyles = parser.extractStyles(childTable, {});
                
                // 🎯 HEREDAR BACKGROUND-COLOR DE TABLA HIJA (solo si no tenemos o es transparente)
                if (childStyles.backgroundColor && 
                    childStyles.backgroundColor !== 'transparent' && 
                    childStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    (!tableStyles.backgroundColor || 
                     tableStyles.backgroundColor === 'transparent' || 
                     tableStyles.backgroundColor === 'rgba(0, 0, 0, 0)')) {
                    tableStyles.backgroundColor = childStyles.backgroundColor;
                }
                
                // 🎯 HEREDAR PADDING DE TABLA HIJA (solo si no tenemos o es cero)
                if (childStyles.padding && !isZeroPadding(childStyles.padding) && 
                    (isZeroPadding(tableStyles.padding) || !tableStyles.padding)) {
                    tableStyles.padding = childStyles.padding;
                }
                
                // Si ya tenemos ambos, podemos salir del bucle
                if (tableStyles.backgroundColor && 
                    tableStyles.backgroundColor !== 'transparent' &&
                    tableStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    tableStyles.padding && 
                    !isZeroPadding(tableStyles.padding)) {
                    break;
                }
            }
        }
    }
    
    let parent = tableEl.parentElement;
    let depth = 0;
    
    while (parent && depth < 3) {
        const parentStyle = parent.getAttribute('style');
        
        // Extraer estilos del padre
        const parentStyles = parser.extractStyles(parent, {});
        
        // 🎯 HERENCIA DE BACKGROUND-COLOR DEL PADRE (solo si aún no tenemos)
        if ((!tableStyles.backgroundColor || 
             tableStyles.backgroundColor === 'transparent' || 
             tableStyles.backgroundColor === 'rgba(0, 0, 0, 0)') &&
            parentStyles.backgroundColor && 
            parentStyles.backgroundColor !== 'transparent' && 
            parentStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            tableStyles.backgroundColor = parentStyles.backgroundColor;
        }
        
        // 🎯 HERENCIA DE PADDING DEL PADRE (solo si aún no tenemos)
        if ((isZeroPadding(tableStyles.padding) || !tableStyles.padding) &&
            parentStyles.padding && !isZeroPadding(parentStyles.padding)) {
            tableStyles.padding = parentStyles.padding;
        }
        
        // 🎯 HERENCIA DE ATRIBUTOS LEGACY (bgcolor) - solo si aún no tenemos background
        const bgcolor = parent.getAttribute('bgcolor');
        if (bgcolor && 
            (!tableStyles.backgroundColor || 
             tableStyles.backgroundColor === 'transparent' || 
             tableStyles.backgroundColor === 'rgba(0, 0, 0, 0)')) {
            tableStyles.backgroundColor = bgcolor;
        }
        
        // Si ya tenemos todos los estilos necesarios, podemos terminar
        if (tableStyles.backgroundColor && 
            tableStyles.backgroundColor !== 'transparent' &&
            tableStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            tableStyles.padding && 
            !isZeroPadding(tableStyles.padding)) {
            break;
        }
        
        parent = parent.parentElement;
        depth++;
    }
    
    // 🎯 EXTRACCIÓN GENÉRICA DE ESTILOS DEL ATRIBUTO STYLE (sobrescribe todo lo anterior)
    const styleAttr = tableEl.getAttribute('style');
    if (styleAttr) {
        
        // 🎯 EXTRACCIÓN DE BACKGROUND-COLOR (sobrescribe herencia)
        const bgMatch = styleAttr.match(/background-color\s*:\s*([^;]+)/i);
        if (bgMatch && bgMatch[1]) {
            const bgColor = bgMatch[1].trim();
            tableStyles.backgroundColor = bgColor;
        }
        
        // 🎯 EXTRACCIÓN DE PADDING (sobrescribe herencia)
        const paddingMatch = styleAttr.match(/padding\s*:\s*([^;]+)/i);
        if (paddingMatch && paddingMatch[1]) {
            const paddingValue = paddingMatch[1].trim();
            
            // Convertir a objeto si es necesario
            const parts = paddingValue.split(/\s+/);
            let paddingObj: any = null;
            
            if (parts.length === 1) {
                paddingObj = {
                    top: parts[0],
                    right: parts[0],
                    bottom: parts[0],
                    left: parts[0]
                };
            } else if (parts.length === 4) {
                paddingObj = {
                    top: parts[0],
                    right: parts[1],
                    bottom: parts[2],
                    left: parts[3]
                };
            }
            
            if (paddingObj && !isZeroPadding(paddingObj)) {
                tableStyles.padding = paddingObj;
            }
        }
    }

    tableStyles = applyGenericCentering(tableEl, tableStyles);

    const alignAttr = tableEl.getAttribute('align')?.toLowerCase();
    const parentAlign = tableEl.parentElement?.getAttribute('align')?.toLowerCase();
    const styleStr = tableEl.getAttribute('style')?.toLowerCase() || '';

    if (alignAttr === 'center' || parentAlign === 'center' || styleStr.includes('margin: 0 auto') || styleStr.includes('margin:0 auto')) {
        tableStyles.marginLeft = 'auto';
        tableStyles.marginRight = 'auto';
        tableStyles.textAlign = 'center';
        tableStyles.display = 'block';
    }
    
    // 🎯 CONFIGURACIÓN GENÉRICA DEL CONTENEDOR
    const containerStyle = {
        ...tableStyles,
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: tableStyles.maxWidth,
        padding: tableStyles.padding || { top: 0, bottom: 0, left: 0, right: 0 },
        backgroundColor: tableStyles.backgroundColor
    };

    const columnsData = cells.map((cell, index) => {
        const cellStyles = parser.extractStyles(cell, tableStyles);
        
        let width = cellStyles.width || cell.getAttribute('width');
        if (width && !String(width).includes('%') && !String(width).includes('px')) width += 'px';
        if (!width) width = '100%';

        const childrenIds: string[] = [];
        const contentStyles = { ...cellStyles };
        ['width', 'padding', 'backgroundColor'].forEach(p => delete contentStyles[p]);

        parser.processChildren(cell, childrenIds, contentStyles);

        return {
            childrenIds: childrenIds,
            width: width,
            style: {
                ...cellStyles,
                display: 'inline-block',
                width: width || 'auto',
                boxSizing: 'border-box'
            }
        };
    });

    parser.addBlock(id, {
        type: "ColumnsContainer",
        data: {
            style: containerStyle,
            props: {
                columnsCount: cells.length,
                columns: columnsData,
                layout: 'auto'
            }
        }
    });

    parser.processedElements.add(tableEl);
    parser.processedElements.add(rowEl);
    cells.forEach(c => parser.processedElements.add(c));

    return { id };
}

function processAsLayoutTable(element: Element, rows: Element[], areVirtual: boolean, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const tableId = uuidv4();
    const styles = parser.extractStyles(element, inheritedStyles);

    if ((styles.borderWidth === 'medium' || styles.border === 'medium') && !styles.borderColor) {
        delete styles.border;
        delete styles.borderWidth;
        delete styles.borderStyle;
        delete styles.borderColor;
    }

    if (styles.backgroundColor === 'transparent' || styles.backgroundColor === 'rgba(0, 0, 0, 0)') {
        styles.backgroundColor = null;
    }
    if (styles.color === 'transparent') {
        styles.color = null;
    }
    
    const align = element.getAttribute('align');
    if (align === 'center' && !styles.marginLeft) {
        styles.marginLeft = 'auto';
        styles.marginRight = 'auto';
    }

    const widthAttr = element.getAttribute('width');
    if (widthAttr && !styles.width) {
        styles.width = widthAttr.endsWith('%') ? widthAttr : `${widthAttr}px`;
    }

    const bgcolor = element.getAttribute('bgcolor');
    if (bgcolor && !styles.backgroundColor) {
        styles.backgroundColor = bgcolor;
    }

    const styleStr = element.getAttribute('style')?.toLowerCase() || '';
    
    if (align === 'center' || styleStr.includes('margin:0 auto') || styleStr.includes('margin: 0 auto')) {
        styles.marginLeft = 'auto';
        styles.marginRight = 'auto';
        styles.textAlign = 'center';
    }

    styles.display = 'table';
    if (!styles.width || styles.width === 'auto') styles.width = '100%';
    styles.borderCollapse = 'collapse';

    parser.addBlock(tableId, {
        type: "Table", 
        data: {
            style: styles,
            props: { childrenIds: [], tagName: element.tagName.toLowerCase(), align: element.getAttribute('align') }
        }
    });

    const rowIds: string[] = [];

    for (const row of rows) {
        let rId: string | null = null;
        if (areVirtual) {
            const vRowId = uuidv4();
            const cellIds: string[] = [];
            const isCell = (el: Element) => ['td','th'].includes(el.tagName) || /display\s*:\s*table-cell/i.test(el.getAttribute('style')||'');
            const cells = Array.from(element.children).filter(c => isCell(c));

            for (const cell of cells) {
                const cResult = parser.parseElement(cell, styles); 
                if (cResult) cellIds.push(cResult.id);
            }
            parser.addBlock(vRowId, {
                type: "TableRow",
                data: { style: { display: 'table-row', width: '100%' }, props: { childrenIds: cellIds } }
            });
            rId = vRowId;
        } else {
            const res = parser.parseElement(row, styles);
            if (res) rId = res.id;
        }
        if (rId) rowIds.push(rId);
    }

    parser.blocks[tableId].data.props.childrenIds = rowIds;
    parser.processedElements.add(element);
    return { id: tableId };
}

/* import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

const INLINE_CONTENT_TAGS = ['a', 'span', 'b', 'strong', 'i', 'em', 'u', 'small', 'img', 'br', 'code', 'label'];

export const TableBlockMatcher: BlockMatcher = {
    name: "TableBlockMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();

        const anchors = element.querySelectorAll('a');
        if (anchors.length === 1) {
            const tableText = element.textContent?.trim() || "";
            const anchorText = anchors[0].textContent?.trim() || "";
            
            // Si la tabla es solo un envoltorio del texto del botón
            if (tableText === anchorText && tableText !== "") {
                // En lugar de decir 'false', forzamos la detección del hijo ahora mismo
                return true; 
            }
        }
        
        // A. Detección básica
        if (tag === 'table') return true;
        
        if (!element.getAttribute('style')?.includes('display: table')) return false;

        // B. Si tiene role="presentation", casi siempre es estructura (Layout)
        if (element.getAttribute('role') === 'presentation') return true;

        // C. Detección por CSS (Div Tables)
        const style = element.getAttribute('style') || '';
        const isCssTable = /display\s*:\s*table(?![-\w])/i.test(style);

        if (isCssTable) {
            // Ignoramos tablas falsas que solo sirven para alinear texto inline
            const children = Array.from(element.children);
            if (children.length === 0) return false;
            
            // Si todos los hijos son inline puro, probablemente no es una tabla estructural
            const hasBlockChildren = children.some(child => 
                !INLINE_CONTENT_TAGS.includes(child.tagName.toLowerCase())
            );
            if (!hasBlockChildren) return false; 
            return true;
        }

        return false;
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        // --- 1. RECOLECCIÓN MANUAL DE FILAS (Saltando TBODY) ---
        let rawRows: Element[] = [];
        let areRowsVirtual = false;

        const anchors = element.querySelectorAll('a');
    
        // 🔥 EL TRUCO: Si detectamos que es una tabla envolvente de botón
        if (anchors.length === 1 && element.textContent?.trim() === anchors[0].textContent?.trim()) {
            
            // 1. Extraemos los estilos de la tabla y la celda
            const tableStyles = parser.extractStyles(element, inheritedStyles);
            const cell = element.querySelector('td');
            const combinedStyles = cell ? parser.extractStyles(cell, tableStyles) : tableStyles;

            // 🔥 CRITERIO DE VERIFICACIÓN: ¿Realmente parece un botón?
            // Un botón real DEBE tener un color de fondo o un borde visible.
            const hasBg = combinedStyles.backgroundColor && 
                        combinedStyles.backgroundColor !== 'transparent' && 
                        combinedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                        combinedStyles.backgroundColor !== '#ffffff';
            
            const hasBorder = combinedStyles.border && combinedStyles.border !== 'none' && combinedStyles.border !== '0px';
            const hasVButton = anchors[0].classList.contains('v-button');

            // 2. Solo hacemos el Túnel si tiene apariencia visual de botón
            if (hasBg || hasBorder || hasVButton) {
                const buttonResult = parser.parseElement(anchors[0], combinedStyles);
                
                if (buttonResult) {
                    parser.processedElements.add(element);
                    return buttonResult; 
                }
            }
        }
        
        const children = Array.from(element.children);
        
        // Helpers
        const isRow = (el: Element) => {
            const t = el.tagName.toLowerCase();
            return t === 'tr' || /display\s*:\s*table-row/i.test(el.getAttribute('style') || '');
        };
        const isCell = (el: Element) => {
            return ['td','th'].includes(el.tagName.toLowerCase()) || /display\s*:\s*table-cell/i.test(el.getAttribute('style')||'');
        };

        // A. Buscamos filas directas
        const directRows = children.filter(c => isRow(c));
        
        if (directRows.length > 0) {
            rawRows = directRows;
        } else {
            // B. Buscamos dentro de secciones (TBODY, THEAD, TFOOT)
            const sections = children.filter(c => ['tbody', 'thead', 'tfoot'].includes(c.tagName.toLowerCase()));
            
            sections.forEach(section => {
                const rowsInSec = Array.from(section.children).filter(r => isRow(r));
                rawRows.push(...rowsInSec);
                parser.processedElements.add(section); // Marcar TBODY como visto
            });

            // C. Caso Div Table (Fila Virtual)
            if (rawRows.length === 0) {
                const directCells = children.filter(c => isCell(c));
                if (directCells.length > 0) {
                    rawRows = [element]; // La tabla actúa como su propia fila
                    areRowsVirtual = true;
                }
            }
        }

        if (rawRows.length === 0) return null;

        // --- PREPARACIÓN DE DATOS ---
        const firstRowNode = areRowsVirtual ? element : rawRows[0];
        const cellsInFirstRow = Array.from(firstRowNode.children).filter(c => isCell(c));

        // --- CASO 2: WRAPPER 1x1 (Aplanado) ---
        // 1 Fila, 1 Columna -> Bloque Container simple
        if (rawRows.length === 1 && cellsInFirstRow.length === 1) {
            return processAsWrapperContainer(element, cellsInFirstRow[0], parser, inheritedStyles);
        }

        // --- CASO 3: COLUMNS CONTAINER (Layout) ---
        // 1 Fila, Varias Columnas -> Bloque de Columnas (Flex)
        if (rawRows.length === 1 && cellsInFirstRow.length > 1) {
            return processAsColumnsContainer(element, rawRows[0], cellsInFirstRow, parser, inheritedStyles);
        }

        // --- CASO 4: TABLA REAL (Grid/Datos) ---
        // Estructura compleja -> Bloque Table
        return processAsLayoutTable(element, rawRows, areRowsVirtual, parser, inheritedStyles);
    }
};

// --- Helpers de Procesamiento ---

function processAsWrapperContainer(tableEl: Element, cellEl: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const id = uuidv4();
    const tableStyles = parser.extractStyles(tableEl, inheritedStyles);
    const cellStyles = parser.extractStyles(cellEl, tableStyles);

    const mergedStyle = {
        ...tableStyles,
        ...cellStyles,
        display: 'block', 
        width: '100%',
        boxSizing: 'border-box'
    };
    
    // Fix Alineación
    const align = cellEl.getAttribute('align') || cellEl.getAttribute('valign');
    if (align && align !== 'top') mergedStyle.textAlign = align === 'middle' ? 'center' : align;

    const childrenIds: string[] = [];
    // Limpiamos estilos peligrosos para herencia
    const stylesForKids = { ...mergedStyle };
    ['padding', 'backgroundColor', 'width', 'height', 'margin'].forEach(p => delete stylesForKids[p]);

    // Limpieza de nodos vacíos
    Array.from(cellEl.childNodes).forEach(node => {
        if (node.nodeType === 3 && !node.textContent?.trim()) cellEl.removeChild(node);
    });

    parser.processChildren(cellEl, childrenIds, stylesForKids);

    parser.addBlock(id, {
        type: "Container",
        data: {
            style: mergedStyle,
            props: {
                childrenIds: childrenIds,
                tagName: 'div',
                id: tableEl.id || cellEl.id,
                className: tableEl.className
            }
        }
    });

    parser.processedElements.add(tableEl);
    if (tableEl !== cellEl) parser.processedElements.add(cellEl);
    if (cellEl.parentElement && cellEl.parentElement !== tableEl) parser.processedElements.add(cellEl.parentElement);

    return { id };
}

function applyGenericCentering(element: Element, styles: any): any {
    const styleStr = element.getAttribute('style')?.toLowerCase() || '';
    const alignAttr = element.getAttribute('align')?.toLowerCase();
    const parentAlign = element.parentElement?.getAttribute('align')?.toLowerCase();

    // 1. Detectamos si es un bloque con ancho restringido (ej: 187px)
    const isFixedBlock = styles.maxWidth && styles.maxWidth !== '100%';

    // 2. Buscamos intención de centrado (en el elemento o su padre inmediato)
    const hasCenterIntent = alignAttr === 'center' || 
                            parentAlign === 'center' || 
                            styleStr.includes('margin:0 auto') || 
                            styleStr.includes('margin: 0 auto');

    // 3. Si es pequeño y quiere centrarse, forzamos márgenes automáticos
    if (isFixedBlock && hasCenterIntent) {
        return {
            ...styles,
            textAlign: 'center',     // Corrige la alineación de texto
            marginLeft: 'auto',      // Centra el bloque
            marginRight: 'auto',     // Centra el bloque
            display: 'block'         // Necesario para que margin:auto funcione
        };
    }
    return styles;
}

function processAsColumnsContainer(tableEl: Element, rowEl: Element, cells: Element[], parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const id = uuidv4();
    let tableStyles = parser.extractStyles(tableEl, inheritedStyles);

    tableStyles = applyGenericCentering(tableEl, tableStyles);

    const alignAttr = tableEl.getAttribute('align')?.toLowerCase();
    const parentAlign = tableEl.parentElement?.getAttribute('align')?.toLowerCase();
    const styleStr = tableEl.getAttribute('style')?.toLowerCase() || '';

    // Si explícitamente pide centro, o tiene margin auto en inline styles
    if (alignAttr === 'center' || parentAlign === 'center' || styleStr.includes('margin: 0 auto') || styleStr.includes('margin:0 auto')) {
        tableStyles.marginLeft = 'auto';
        tableStyles.marginRight = 'auto';
        tableStyles.textAlign = 'center';
        tableStyles.display = 'block';
    
    }
    
    // Configuración Flexbox
    const containerStyle = {
        ...tableStyles,
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        // Aseguramos que el padding de la tabla se mantenga
        maxWidth: tableStyles.maxWidth,
        padding: tableStyles.padding || { top: 0, bottom: 0, left: 0, right: 0 }
    };

    const columnsData = cells.map(cell => {
        const cellStyles = parser.extractStyles(cell, tableStyles);
        
        // Calcular ancho
        let width = cellStyles.width || cell.getAttribute('width');
        if (width && !String(width).includes('%') && !String(width).includes('px')) width += 'px';
        if (!width) width = '100%';

        const childrenIds: string[] = [];
        const contentStyles = { ...cellStyles };
        ['width', 'padding', 'backgroundColor'].forEach(p => delete contentStyles[p]);

        parser.processChildren(cell, childrenIds, contentStyles);

        return {
            childrenIds: childrenIds,
            width: width,
            style: {
                ...cellStyles,
                display: 'inline-block', // Para que los iconos se alineen horizontalmente
                width: width || 'auto',
                boxSizing: 'border-box'
            }
        };
    });

    parser.addBlock(id, {
        type: "ColumnsContainer",
        data: {
            style: containerStyle,
            props: {
                columnsCount: cells.length,
                columns: columnsData,
                layout: 'auto'
            }
        }
    });

    parser.processedElements.add(tableEl);
    parser.processedElements.add(rowEl);
    cells.forEach(c => parser.processedElements.add(c));

    return { id };
}

function processAsLayoutTable(element: Element, rows: Element[], areVirtual: boolean, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const tableId = uuidv4();
    const styles = parser.extractStyles(element, inheritedStyles);

    if (styles.backgroundColor === 'transparent' || styles.backgroundColor === 'rgba(0, 0, 0, 0)') {
        styles.backgroundColor = null;
    }
    if (styles.color === 'transparent') {
        styles.color = null;
    }
    
    // --- NUEVO FIX: Capturar atributos legacy para centrado y layout ---
    const align = element.getAttribute('align');
    if (align === 'center' && !styles.marginLeft) {
        styles.marginLeft = 'auto';
        styles.marginRight = 'auto';
    }

    const widthAttr = element.getAttribute('width');
    if (widthAttr && !styles.width) {
        styles.width = widthAttr.endsWith('%') ? widthAttr : `${widthAttr}px`;
    }

    const bgcolor = element.getAttribute('bgcolor');
    if (bgcolor && !styles.backgroundColor) {
        styles.backgroundColor = bgcolor;
    }

    const styleStr = element.getAttribute('style')?.toLowerCase() || '';
    
    if (align === 'center' || styleStr.includes('margin:0 auto') || styleStr.includes('margin: 0 auto')) {
        styles.marginLeft = 'auto';
        styles.marginRight = 'auto';
        styles.textAlign = 'center';
    }

    // ... (el resto de la función queda igual)
    styles.display = 'table';
    if (!styles.width || styles.width === 'auto') styles.width = '100%';
    // -------------------------------------------------------------

    styles.display = 'table';
    if (!styles.width || styles.width === 'auto') styles.width = '100%';
    styles.borderCollapse = 'collapse';

    parser.addBlock(tableId, {
        type: "Table", // Asegúrate que tu renderer soporta 'Table', si no usa 'Container'
        data: {
            style: styles,
            props: { childrenIds: [], tagName: element.tagName.toLowerCase(), align: element.getAttribute('align') }
        }
    });

    const rowIds: string[] = [];

    for (const row of rows) {
        let rId: string | null = null;
        if (areVirtual) {
            const vRowId = uuidv4();
            const cellIds: string[] = [];
            const isCell = (el: Element) => ['td','th'].includes(el.tagName) || /display\s*:\s*table-cell/i.test(el.getAttribute('style')||'');
            const cells = Array.from(element.children).filter(c => isCell(c));

            for (const cell of cells) {
                const cResult = parser.parseElement(cell, styles); 
                if (cResult) cellIds.push(cResult.id);
            }
            parser.addBlock(vRowId, {
                type: "TableRow",
                data: { style: { display: 'table-row', width: '100%' }, props: { childrenIds: cellIds } }
            });
            rId = vRowId;
        } else {
            const res = parser.parseElement(row, styles);
            if (res) rId = res.id;
        }
        if (rId) rowIds.push(rId);
    }

    parser.blocks[tableId].data.props.childrenIds = rowIds;
    parser.processedElements.add(element);
    return { id: tableId };
} */