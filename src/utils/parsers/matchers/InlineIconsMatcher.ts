import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { v4 as uuidv4 } from "uuid";
import { ImageMatcher } from "./ImageMatcher";
import type { BlockMatcher, MatcherResult } from "./types";
import { StyleUtils } from "../StyleUtils";

export const InlineIconsMatcher: BlockMatcher = {
    name: "InlineIcons",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();

        // Solo analizamos contenedores de flujo
        if (!['td', 'div', 'p', 'span', 'center'].includes(tag)) return false;

        const children = element.childNodes;
        let validImagesCount = 0;
        let invalidContent = false;

        for (let index = 0; index < children.length; index++) {
            const node = children[index];

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.replace(/[\s\u00A0\n\r]/g, '') || '';
                if (text.length > 0) {
                    invalidContent = true; 
                    break;
                }
            }

            else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                
                // Usamos tu ImageMatcher existente para validar si es una imagen/icono válido
                if (ImageMatcher.isComponent(el, {} as any)) {
                    validImagesCount++;
                } else if (el.tagName.toLowerCase() === 'br') {
                    // Ignoramos <br>
                } else {
                    // Si encontramos algo raro (tabla, botón, form), abortamos
                    invalidContent = true;
                    break; 
                }
            }
            
        }

        return validImagesCount >= 2 && !invalidContent;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();

        // Extraemos estilos pero FORZAMOS padding cero
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);

        const validChildElements: Element[] = [];
        const children = element.children;

        for (let index = 0; index < children.length; index++) {
            // Filtramos BRs o nodos vacíos aquí si es necesario
            if (children[index].tagName.toLowerCase() !== 'br') {
                validChildElements.push(children[index]);
            }
        }

        const columnsCount = validChildElements.length;
        const childBlocksIds: string[] = [];

        // Construimos la estructura de columnas interna
        // Cada icono va a su propia columna
        validChildElements.forEach((child, index) => {
            
            // --- LÓGICA DE ALINEACIÓN PARA LA IMAGEN ---
            let imageStyles: any = {};

            if (columnsCount === 2) {
                if (index === 0) {
                    // Primero: Pegado a la DERECHA (End)
                    imageStyles = {
                        align: "right", // Atributo legacy
                        textAlign: "right",
                        margin: "0 0 0 auto" // CSS moderno: empuja desde la izquierda
                    };
                }
                if (index === 1) {
                    // Segundo: Pegado a la IZQUIERDA (Start)
                    imageStyles = {
                        align: "left",
                        textAlign: "left",
                        margin: "0 auto 0 0" // CSS moderno: empuja desde la derecha
                    };
                }
            } 
            else if (columnsCount === 3) {
                if (index === 0) imageStyles = { align: "right", textAlign: "right", margin: "0 0 0 auto" };
                if (index === 1) imageStyles = { align: "center", textAlign: "center", margin: "0 auto" };
                if (index === 2) imageStyles = { align: "left", textAlign: "left", margin: "0 auto 0 0" };
            }

            // Pasamos estos estilos "forzados" al parser.
            // ImageMatcher los recibirá en 'inheritedStyles' y los aplicará al bloque final.
            const result = parser.parseElement(child, imageStyles);
            
            if (result) {
                childBlocksIds.push(result.id);
            }
        });

        const columnsData = childBlocksIds.map((childId) => ({
            style: {
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                verticalAlign: "middle",
                // textAlign: "center" // Ya no hace falta forzarlo aquí si la imagen tiene margin auto
            },
            childrenIds: [childId]
        }));

        // Preparar estilos seguros para Zod
        let safeBgColor = styles.backgroundColor;
        // Si es transparente o inválido, lo borramos o forzamos undefined para que Zod no se queje
        if (safeBgColor === 'transparent' || !safeBgColor) {
            safeBgColor = undefined; 
        }

        // Estilos para el bloque padre de columnas
        const containerStyle = {
            ...styles,
            backgroundColor: safeBgColor,
            // Forzamos padding 0 en el contenedor principal también
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            // Aseguramos que no haya bordes o márgenes raros
            border: "none"
        };

        // Limpieza
        if (containerStyle.width === '100%') delete containerStyle.width;

        parser.addBlock(id, {
            type: "ColumnsContainer", // <--- CAMBIO CLAVE: Usamos el tipo Columnas
            data: {
                style: containerStyle,
                props: {
                    columnsCount: columnsCount,
                    columns: columnsData, // Array con la deficnición de cada columna
                    // Props visuales para intentar pegar las columnas
                    gap: 0, 
                    layout: "auto" // Si tu editor soporta 'auto' para que no ocupen 50% forzado
                }
            }
        });

        /* console.log(`✅ [InlineIcons] Convertido a ${columnsCount} Columnas (Padding 0).`); */
        return { id };
    },
}