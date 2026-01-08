import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

const INLINE_CONTENT_TAGS = ['a', 'span', 'b', 'strong', 'i', 'em', 'u', 'small', 'img', 'br', 'code', 'label'];

export const TableBlockMatcher: BlockMatcher = {
    name: "TableBlockMatcher",

    isComponent(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        
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
    ['padding', 'border', 'backgroundColor', 'width', 'height', 'margin'].forEach(p => delete stylesForKids[p]);

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

function processAsColumnsContainer(tableEl: Element, rowEl: Element, cells: Element[], parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult {
    const id = uuidv4();
    const tableStyles = parser.extractStyles(tableEl, inheritedStyles);
    
    // Configuración Flexbox
    const containerStyle = {
        ...tableStyles,
        display: 'flex',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box',
        // Aseguramos que el padding de la tabla se mantenga
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
                flexBasis: width,
                flexGrow: 1,
                minWidth: '150px', // Responsive fallback
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
                columns: columnsData
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