import { v4 as uuidv4 } from "uuid";
import { HTMLToBlockParser } from "../HTMLToBlockParser";
import type { BlockMatcher, MatcherResult } from "./types";

export const TableBlockMatcher: BlockMatcher = {
    name: "TableBlockMatcher",

    isComponent(element: Element): boolean {
        return element.tagName.toLowerCase() === 'table';
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null {
        // 1. Structural Analysis
        const rows = Array.from(element.querySelectorAll('tr')).filter(r => {
            const parentTable = r.closest('table');
            return parentTable === element;
        });

        if (rows.length === 0) return null;

        const tableId = uuidv4();
        // Extract styles for the TABLE itself.
        // We pass 'inheritedStyles' (from outside) so it gets global fonts/colors.
        const tableStyles = parser.extractStyles(element, inheritedStyles);
        const getAttr = (el: Element, name: string) => el.getAttribute(name);

        // --- A. Create TABLE Block ---
        parser.addBlock(tableId, {
            type: "Table",
            data: {
                style: {
                    ...tableStyles,
                    display: 'table',
                    width: tableStyles.width || (getAttr(element, 'width') ? `${getAttr(element, 'width')}px` : '100%'),
                    backgroundColor: tableStyles.backgroundColor || getAttr(element, 'bgcolor'),
                    borderCollapse: getAttr(element, 'cellspacing') === '0' ? 'collapse' : 'separate',
                    marginLeft: getAttr(element, 'align') === 'center' ? 'auto' : undefined,
                    marginRight: getAttr(element, 'align') === 'center' ? 'auto' : undefined,
                },
                props: {
                    childrenIds: [],
                    cellpadding: getAttr(element, 'cellpadding'),
                    cellspacing: getAttr(element, 'cellspacing'),
                    align: getAttr(element, 'align'),
                }
            }
        });

        if (parser.protectedBlocks) parser.protectedBlocks.add(tableId);

        const rowIds: string[] = [];

        // --- B. Process Rows ---
        for (const row of rows) {
            const rowId = uuidv4();
            
            // CRITICAL CHANGE 1: Row Style Extraction
            // We do NOT pass 'tableStyles' here. A row should not inherit the table's 
            // border or background. We pass 'inheritedStyles' (global) just for fonts.
            const rowStyles = parser.extractStyles(row, inheritedStyles);

            parser.addBlock(rowId, {
                type: "TableRow",
                data: {
                    style: { ...rowStyles, display: 'table-row' },
                    props: { childrenIds: [] }
                }
            });

            if (parser.protectedBlocks) parser.protectedBlocks.add(rowId);
            rowIds.push(rowId);

            const cellIds: string[] = [];
            const cells = Array.from(row.children).filter(c => ['td', 'th'].includes(c.tagName.toLowerCase()));

            // --- C. Process Cells ---
            for (const cell of cells) {
                const cellId = uuidv4();

                // CRITICAL CHANGE 2: Filter Styles for Inheritance
                // We want the cell to inherit Font/Color from the Row, 
                // but NOT Background/Padding/Borders/Dimensions.
                
                const inheritableTypography = { ...rowStyles };
                const nonInheritableProps = [
                    'backgroundColor', 'background', 'backgroundImage',
                    'border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight',
                    'borderColor', 'borderWidth', 'borderStyle',
                    'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
                    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
                    'width', 'height', 'minWidth', 'maxWidth', 'display',
                    'verticalAlign' // Cells usually define their own alignment or use the row's valign attribute, not style inheritance
                ];

                nonInheritableProps.forEach(prop => delete inheritableTypography[prop]);

                // Now we extract cell styles, passing ONLY typography from the row.
                // This prevents the cell from turning red just because the row is red.
                const cellStyles = parser.extractStyles(cell, inheritableTypography);
                const cellChildrenIds: string[] = [];
                
                // Recursion: Process inner content
                // We pass cellStyles here so text inside the cell inherits the cell's font.
                parser.processChildren(cell, cellChildrenIds, cellStyles);

                // Width Logic
                let finalWidth = cellStyles.width;
                const attrWidth = getAttr(cell, 'width');
                
                if (attrWidth) {
                    finalWidth = attrWidth.includes('%') ? attrWidth : `${attrWidth}px`;
                } else if (!finalWidth || finalWidth === 'auto') {
                    finalWidth = rows.length > 1 || cells.length > 1 ? 'auto' : undefined; 
                }

                parser.addBlock(cellId, {
                    type: "TableCell",
                    data: {
                        style: {
                            ...cellStyles, // This now contains correctly merged styles
                            display: 'table-cell',
                            width: finalWidth,
                            // Background is explicit to the cell or attribute
                            backgroundColor: cellStyles.backgroundColor || getAttr(cell, 'bgcolor'),
                            verticalAlign: getAttr(cell, 'valign') || cellStyles.verticalAlign || 'top',
                        },
                        props: {
                            childrenIds: cellChildrenIds,
                            colspan: parseInt(getAttr(cell, 'colspan') || "1"),
                            rowspan: parseInt(getAttr(cell, 'rowspan') || "1"),
                            align: getAttr(cell, 'align') || cellStyles.textAlign,
                            valign: getAttr(cell, 'valign') || cellStyles.verticalAlign,
                            width: getAttr(cell, 'width'),
                            tagName: cell.tagName.toLowerCase()
                        }
                    }
                });

                if (parser.protectedBlocks) parser.protectedBlocks.add(cellId);
                cellIds.push(cellId);
                parser.processedElements.add(cell);
            }
            
            parser.blocks[rowId].data.props.childrenIds = cellIds;
            parser.processedElements.add(row);
        }
        
        parser.blocks[tableId].data.props.childrenIds = rowIds;
        parser.processedElements.add(element);
        
        Array.from(element.children).forEach(child => {
            if (['thead', 'tbody', 'tfoot'].includes(child.tagName.toLowerCase())) {
                parser.processedElements.add(child);
            }
        });

        return { id: tableId };
    }
};