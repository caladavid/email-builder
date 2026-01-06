import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";

export const LayoutMatcher: BlockMatcher = {
    isComponent(element: Element, parser: HTMLToBlockParser): boolean {
        const tag = element.tagName.toLowerCase();
        // Ignoramos tablas reales de datos, nos centramos en DIVs estructurales o secciones
        if (['table', 'tbody', 'tr', 'td', 'img', 'span', 'a', 'b', 'strong', 'i'].includes(tag)) return false;

        const styles = parser.extractStyles(element);
        const display = (styles.display || "").toLowerCase();

        // 1. Detectar display: table (El caso de tu plantilla actual)
        // Muchos builders usan <div style="display:table"> para filas
        if (display === 'table' || display === 'table-row') return true;

        // 2. Detectar Flexbox explícito
        if (display === 'flex' || display === 'inline-flex') return true;

        // 3. Detectar Grid explícito
        if (display === 'grid' || display === 'inline-grid') return true;

        // 4. Detectar "Fila Implícita" (Hijos flotantes o inline-block con ancho definido)
        // Esto es común en plantillas antiguas
        const children = Array.from(element.children);
        if (children.length > 1) {
            const potentialColumns = children.filter(child => {
                const childStyles = parser.extractStyles(child);
                const childDisplay = (childStyles.display || "").toLowerCase();
                const float = (childStyles.float || "").toLowerCase();
                const width = childStyles.width;

                const isColumnCandidate = 
                    childDisplay === 'table-cell' || 
                    childDisplay === 'inline-block' || 
                    float === 'left' || 
                    float === 'right';
                
                // Si tiene un ancho específico (ej: "50%", "300px") es casi seguro una columna
                return isColumnCandidate && width; 
            });

            // Si la mayoría de los hijos parecen columnas, es un Layout
            if (potentialColumns.length >= children.length * 0.5) return true;
        }

        return false;
    },

    fromElement(element: Element, parser: HTMLToBlockParser, inheritedStyles: any = {}): MatcherResult | null {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);
        const childrenIds: string[] = [];

        // --- TRADUCCIÓN GENÉRICA DE ESTILOS ---
        // Convertimos cualquier mecanismo de layout antiguo a Flexbox moderno
        
        const layoutStyles: any = {
            ...styles,
            display: 'flex', // Forzamos Flex para el builder
            flexWrap: 'wrap', // Permitir wrap para móviles
            padding: styles.padding || { top: 0, right: 0, bottom: 0, left: 0 }
        };

        // Si era display: table, limpiamos propiedades conflictivas
        if (styles.display === 'table' || styles.display === 'table-row') {
            layoutStyles.width = '100%'; // Las tablas suelen ocupar todo
            layoutStyles.tableLayout = undefined;
            layoutStyles.borderCollapse = undefined;
        }

        // --- PROCESAMIENTO DE HIJOS (COLUMNAS) ---
        Array.from(element.children).forEach(child => {
            // Pasamos estilos heredados pero limpiando el layout para no confundir al hijo
            const childInherited = { ...inheritedStyles, color: styles.color, fontFamily: styles.fontFamily };
            
            // Procesamos el hijo normalmente. 
            // IMPORTANTE: Aquí necesitamos capturar el ID del bloque hijo para modificarle el estilo "flex"
            // Como parser.parseElement devuelve un MatcherResult o string, usamos la API pública.
            
            // Nota: Aquí asumimos que processElement o parseElement devuelve el ID. 
            // Si usas el parser principal, a veces devuelve null si ya fue procesado.
            // Para garantizar control, usamos un truco: extraemos estilos del hijo aquí.
            
            const childStyles = parser.extractStyles(child);
            const childId = (parser as any).processElement(child, childInherited); // Acceso a método del parser

            if (childId) {
                childrenIds.push(childId);
                const childBlock = parser.blocks[childId];

                if (childBlock && childBlock.data && childBlock.data.style) {
                    // TRADUCCIÓN DE COLUMNA
                    // Si el padre ahora es Flex, el hijo debe comportarse como item flex
                    
                    // 1. Convertir width a flex-basis
                    const w = childStyles.width;
                    if (w) {
                        childBlock.data.style.flexBasis = w;
                        childBlock.data.style.width = w; // Mantener width para seguridad
                        childBlock.data.style.flexGrow = 0; // Respetar ancho fijo si existe
                        childBlock.data.style.flexShrink = 1; // Permitir encoger si no cabe
                    } else {
                        childBlock.data.style.flexGrow = 1; // Si no tiene ancho, que ocupe espacio
                    }

                    // 2. Limpiar display antiguos
                    if (childBlock.data.style.display === 'table-cell') {
                        childBlock.data.style.display = 'block'; // Reset a bloque normal dentro del flex
                    }
                    
                    // 3. Manejo de alineación vertical (table-cell vertical-align)
                    if (childStyles.verticalAlign) {
                       // Flexbox no usa vertical-align en items, se maneja en el padre o con márgenes.
                       // Esto es complejo de traducir perfectamente 1:1 sin ensuciar, 
                       // pero 'middle' -> align-self: center es una aproximación.
                       if(childStyles.verticalAlign === 'middle') childBlock.data.style.alignSelf = 'center';
                       if(childStyles.verticalAlign === 'bottom') childBlock.data.style.alignSelf = 'flex-end';
                    }
                }
            }
        });

        // Registrar el bloque contenedor
        parser.addBlock(id, {
            type: 'Container', // O 'ColumnsContainer' si tu builder lo distingue
            data: {
                style: layoutStyles,
                props: {
                    childrenIds: childrenIds
                }
            }
        });

        return { id };
    }
};