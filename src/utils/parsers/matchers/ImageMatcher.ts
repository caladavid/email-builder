// src/parsers/matchers/ImageMatcher.ts
import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils"; 

function isSingleImageWrapper(element: Element): boolean {
    const children = element.childNodes;
    let imageCount = 0;

    for (let index = 0; index < children.length; index++) {
        const node = children[index];
        /* console.log(node); */

        if (node.nodeType === Node.TEXT_NODE) {
            // Si tiene texto real visible, NO es un wrapper de imagen (es contenido mixto)
            // Usamos una regex estricta para eliminar espacios, tabs, saltos y &nbsp;
            const text = node.textContent?.replace(/[\s\u00A0\n\r]/g, '') || '';
            if (text.length > 0) {
               return false; // Tiene texto visible -> No es wrapper de imagen
            }
        }
        
        
        else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();

            if (tag === "img") {
                imageCount++;
            } 

            else if (tag === "br") {
                continue;
            }
            
            else if (['a', 'span', 'div', 'p', 'center', 'td', 'strong', 'b'].includes(tag)) {
                // Recursividad: Si contiene un div, ¿ese div es wrapper de imagen?
                if (isSingleImageWrapper(el)) {
                    imageCount++; // Contamos el wrapper hijo como "parte de la imagen"
                } else {
                    return false;
                }
            } 

            else {
                return false;
            }
        }
    }
    return imageCount === 1;
}

export const ImageMatcher: BlockMatcher = {
    name: 'Image',

    // 1. Detección (isComponent)
    isComponent: (element: Element) => {
        const tag = element.tagName.toLowerCase();
        // Es una imagen SI:
        // - Es tag <img>
        // - Y NO es hijo directo de un <a> (porque tu lógica legacy maneja <a><img> como link/botón)
        if (tag === "img"){
            if (element.parentElement?.tagName.toLowerCase() === 'a') return false;
            return true
        }

        // Aquí detectamos si este elemento es solo un cascarón para una imagen
        if (['a', 'td', 'div', 'span', 'p', 'center'].includes(tag)) {
            // Para 'a' siempre intentamos ver si es wrapper
            if (tag === 'a') return isSingleImageWrapper(element);
            
            // Para otros contenedores, solo si son wrappers de 1 sola imagen
            if (['td', 'div', 'span', 'p'].includes(tag)) {
                 // Nota: InlineIconsMatcher se encargará si hay >1 imagen.
                 // Aquí solo capturamos si hay 1 sola imagen solitaria en un TD/DIV
                 return isSingleImageWrapper(element);
            }
        }

        return false;
    },

    // 2. Construcción (fromElement)
    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        // 1. Encontrar la imagen real (profundidad ilimitada)
        const imgEl = element.tagName.toLowerCase() === 'img' 
            ? element 
            : element.querySelector('img');

        if (!imgEl) return null;

        // 2. Encontrar el enlace (si existe en la cadena)
        let linkHref: string | undefined = undefined;
        // Buscamos el <a> más cercano, ya sea el elemento actual o uno dentro
        const anchor = element.tagName.toLowerCase() === 'a' 
            ? element 
            : element.querySelector('a');
        if (anchor) linkHref = anchor.getAttribute('href') || undefined;

        // 3. ABSORCIÓN DE ESTILOS "Hacia Arriba" (La solución para ENEL)
        // Partimos de los estilos de la imagen
        let combinedStyles = StyleUtils.extractUnifiedStyles(imgEl);
        
        // Vamos a "trepar" desde la imagen hasta el elemento que disparó el Matcher
        // y un poco más arriba (para capturar el TD de ENEL)
        let current: Element | null = imgEl;
        
        // Limite de seguridad para no subir hasta el <body>
        const processedNodes = new Set<Element>();
        while (current && !processedNodes.has(current)) {
            processedNodes.add(current);

            if (current !== imgEl) {
                const layerStyles = StyleUtils.extractUnifiedStyles(current);
                
                // ABSORCIÓN INTELIGENTE:
                // Solo tomamos estilos del padre si la imagen no los tiene definidos
                
                // Fondo (Clave para ENEL)
                if (!combinedStyles.backgroundColor && layerStyles.backgroundColor && layerStyles.backgroundColor !== 'transparent') {
                    combinedStyles.backgroundColor = layerStyles.backgroundColor;
                }
                
                // Alineación
                if (!combinedStyles.textAlign && layerStyles.textAlign) {
                    combinedStyles.textAlign = layerStyles.textAlign;
                }
                
                // Padding (El wrapper suele definir el espacio)
                if (layerStyles.padding) combinedStyles.padding = layerStyles.padding;
                
                // Borde
                if (layerStyles.border) combinedStyles.border = layerStyles.border;
            }

            // Si llegamos al elemento raíz que disparó el matcher, paramos.
            if (current === element) break;

            // Subimos
            current = current.parentElement;
        }

        // 4. Preparar Datos Finales
        const PLACEHOLDER_IMG = 'https://placehold.net/default.png';
        let src = imgEl.getAttribute("src") || "";
        const base = (src.split("/").pop() || src).toLowerCase();
        
        if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null;
        if (!src) src = PLACEHOLDER_IMG;

        const dataUrl = parser.resolveAssetUrl(src);
        const id = uuidv4();

        const widthAttr = imgEl.getAttribute("width");
        const heightAttr = imgEl.getAttribute("height");
        // Prioridad: Atributo HTML explícito > Estilo CSS > Auto
        const widthVal = widthAttr ? parseInt(widthAttr) : (combinedStyles.width ? parseInt(String(combinedStyles.width)) : 999);
        const isSmallIcon = widthVal <= 60;

        // Estilos finales
        const finalStyles = {
            ...inheritedStyles,
            ...combinedStyles
        };

        // Defaults
        if (!finalStyles.padding) finalStyles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
        if (!finalStyles.textAlign) finalStyles.textAlign = "center";

        // Layout
        if (isSmallIcon) {
            finalStyles.display = "inline-block";
            if (!finalStyles.margin) finalStyles.margin = { top: 0, right: 0, bottom: 0, left: 0 };
        } else {
            if (!finalStyles.display) finalStyles.display = "block";
            
            // Lógica ENEL: Si hay width explícito en atributo, no forzar 100%
            if (!widthAttr) {
                finalStyles.maxWidth = "100%";
            }
            
            if (!finalStyles.margin) finalStyles.margin = "0 auto";
        }

        // Limpieza
        if (finalStyles.width === '100%') delete finalStyles.width;
        if (finalStyles.backgroundColor === 'transparent') delete finalStyles.backgroundColor;

        parser.addBlock(id, {
            type: "Image",
            data: {
                style: finalStyles,
                props: {
                    url: dataUrl,
                    alt: imgEl.getAttribute("alt") || "Imagen",
                    linkHref: linkHref,
                    width: widthAttr ? parseInt(widthAttr) : undefined,
                    height: heightAttr ? parseInt(heightAttr) : undefined,
                    contentAlignment: "middle",
                }
            }
        });

        /* console.log(`✅ [ImageMatcher] Procesado: ${base} | Link: ${!!linkHref} | BG: ${finalStyles.backgroundColor}`); */
        return { id };
    }
};