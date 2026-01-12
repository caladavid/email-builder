import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { v4 as uuidv4 } from "uuid";
import { ImageMatcher } from "./ImageMatcher";
import type { BlockMatcher, MatcherResult } from "./types";
import { StyleUtils } from "../StyleUtils";

export const InlineIconsMatcher: BlockMatcher = {
    name: "InlineIcons",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();
        if (!['td', 'div', 'p', 'span', 'center', 'table', 'tr', 'tbody'].includes(tag)) return false;

        // Usamos children (Elements) para el conteo rápido, ignorando texto suelto inicial
        const children = Array.from(element.children);
        
        // DEBUG RÁPIDO: Solo si parece el bloque de redes sociales (por cantidad)
        if (children.length >= 3) {
             // console.log(`🔍 [InlineIcons] Posible candidato con ${children.length} hijos.`);
        }

        let validImagesCount = 0;
        let invalidContent = false;

        for (const child of children) {
            const childTag = child.tagName.toLowerCase();
            if (['script', 'style', 'meta', 'br', 'noscript'].includes(childTag)) continue;

            if (ImageMatcher.isComponent(child)) {
                validImagesCount++;
            } else {
                // Si falla, es interesante saber por qué, pero en isComponent mantenemos silencio
                invalidContent = true;
                // Si encontramos un bloque no-imagen, rompemos, a menos que sea algo invisible
            }
        }

        // Relajamos la condición: Si hay al menos 2 imágenes y la mayoría son válidas, lo aceptamos
        // Esto permite que si hay un <div> vacío perdido, no rompa todo el grupo.
        return validImagesCount >= 2; 
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);

        /* console.group('🕵️‍♀️ DEBUG InlineIconsMatcher Process');
        console.log('Total hijos en DOM:', element.children.length); */

        const validChildElements: Element[] = [];
        const children = Array.from(element.children);

        children.forEach((child, i) => {
            const tag = child.tagName.toLowerCase();
            if (['br', 'script', 'style', 'noscript'].includes(tag)) return;

            const isValid = ImageMatcher.isComponent(child);
            if (isValid) {
                validChildElements.push(child);
            }
        });
        /* console.log('Total elementos válidos:', validChildElements.length);
        console.groupEnd(); */

        const columnsCount = validChildElements.length;
        const childBlocksIds: string[] = [];

        validChildElements.forEach((child, index) => {
            let alignStyle: any = {};

            // Lógica de alineación
            if (columnsCount === 2) {
                if (index === 0) alignStyle = { textAlign: 'right', margin: '0 5px 0 auto' }; 
                if (index === 1) alignStyle = { textAlign: 'left', margin: '0 auto 0 5px' };
            } 
            else if (columnsCount === 3) {
                if (index === 0) alignStyle = { textAlign: 'right', margin: '0 0 0 auto' };
                if (index === 1) alignStyle = { textAlign: 'center', margin: '0 auto' };
                if (index === 2) alignStyle = { textAlign: 'left', margin: '0 auto 0 0' };
            }
            else {
                // 4+ Elementos: Centrado simple con margen uniforme
                alignStyle = { textAlign: 'center', margin: '0 4px' };
            }

            const result = parser.parseElement(child, alignStyle);
            if (result) childBlocksIds.push(result.id);
        });

        // Mapeo a columnas
        const columnsData = childBlocksIds.map(childId => ({
            style: { 
                padding: {top:0, right:0, bottom:0, left:0}, 
                verticalAlign: 'middle',
                // Aseguramos que la celda de la columna no fuerce nada raro
                display: 'block' 
            },
            childrenIds: [childId]
        }));

        const containerStyle = { 
            ...styles, 
            padding: {top:10, right:10, bottom:10, left:10}, // Un poco de padding safe
            border: 'none',
            display: 'block' // El contenedor de columnas es un bloque
        };
        
        if (containerStyle.width === '100%') delete containerStyle.width;
        if (!containerStyle.backgroundColor || containerStyle.backgroundColor === 'transparent') delete containerStyle.backgroundColor;

        parser.addBlock(id, {
            type: "ColumnsContainer",
            data: {
                style: containerStyle,
                props: {
                    columnsCount: columnsCount,
                    columns: columnsData,
                    gap: 0,
                    layout: "auto" // 'auto' suele indicar que las columnas se ajusten al contenido o se distribuyan equitativamente
                }
            }
        });

        return { id };
    }
};