// ImageMatcher.ts
import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils"; 

// Helper recursive: busca si el elemento termina conteniendo UNA sola imagen
function isSingleImageWrapper(element: Element): boolean {
    const children = Array.from(element.childNodes);
    let imageCount = 0;
    let hasBlockers = false;

    for (const node of children) {
        if (node.nodeType === Node.TEXT_NODE) {
            // 🔥 FIX: Regex agresivo para ignorar todo lo que no sea texto visible real
            // Incluye Zero Width Space (\u200B), NBSP (\u00A0) y otros controles.
            const cleanText = node.textContent?.replace(/[\s\n\r\t\u00A0\u200B\uFEFF]+/g, '') || '';
            if (cleanText.length > 0) {
                // console.log('❌ Rechazado por texto:', cleanText); 
                return false;
            }
        } 
        else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();

            if (tag === 'img') {
                imageCount++;
            } else if (['br', 'script', 'style', 'meta', 'link', 'noscript'].includes(tag)) {
                continue;
            } else {
                // Recursividad
                if (isSingleImageWrapper(el)) {
                    imageCount++; 
                } else {
                    hasBlockers = true; 
                }
            }
        }
    }
    
    return imageCount === 1 && !hasBlockers;
}

export const ImageMatcher: BlockMatcher = {
    name: 'Image',

    isComponent: (element: Element) => {
        const tag = element.tagName.toLowerCase();
        
        if (tag === "img") {
            // Si el padre directo es <a>, dejamos que el <a> sea el componente (si queremos)
            // Ojo: En tu caso, tenemos div > a > img. 
            // Queremos detectar el DIV wrapper como "Image Component" para InlineIconsMatcher.
            return true; 
        }

        // Aceptamos cualquier contenedor estructural si envuelve una sola imagen
        if (['a', 'td', 'div', 'span', 'p', 'center', 'table', 'tbody', 'tr'].includes(tag)) {
            return isSingleImageWrapper(element);
        }

        return false;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        
        // REPETICIÓN DEL fromElement POR SEGURIDAD (Copia esto dentro de tu archivo):
        
        // 1. Encontrar imagen
        const imgEl = element.tagName.toLowerCase() === 'img' ? element : element.querySelector('img');
        if (!imgEl) return null;

        // 2. Encontrar link
        let linkHref = undefined;
        const anchor = element.closest('a') || element.querySelector('a');
        if (anchor) linkHref = anchor.getAttribute('href');

        // 3. Absorber estilos
        let combinedStyles = StyleUtils.extractUnifiedStyles(imgEl);
        let current: Element | null = imgEl;
        const processedNodes = new Set();
        
        while (current && !processedNodes.has(current)) {
            processedNodes.add(current);
            if (current !== imgEl) {
                const layerStyles = StyleUtils.extractUnifiedStyles(current);
                if (!combinedStyles.backgroundColor && layerStyles.backgroundColor !== 'transparent') combinedStyles.backgroundColor = layerStyles.backgroundColor;
                if (!combinedStyles.textAlign && layerStyles.textAlign) combinedStyles.textAlign = layerStyles.textAlign;
                if (layerStyles.padding) combinedStyles.padding = layerStyles.padding;
            }
            if (current === element) break;
            current = current.parentElement;
        }

        // 4. Crear bloque
        const PLACEHOLDER_IMG = 'https://placehold.net/default.png';
        let src = imgEl.getAttribute("src") || "";
        if (!src) src = PLACEHOLDER_IMG;
        
        const id = uuidv4();
        const widthAttr = imgEl.getAttribute("width");
        const widthVal = widthAttr ? parseInt(widthAttr) : (combinedStyles.width ? parseInt(String(combinedStyles.width)) : 999);
        const isSmallIcon = widthVal <= 60;

        const finalStyles = { ...inheritedStyles, ...combinedStyles };
        
        // Reset padding/align por defecto
        if (!finalStyles.padding) finalStyles.padding = {top:0, right:0, bottom:0, left:0};
        if (!finalStyles.textAlign) finalStyles.textAlign = 'center';

        if (isSmallIcon) {
            finalStyles.display = 'inline-block';
            if (!finalStyles.margin) finalStyles.margin = {top:0, right:0, bottom:0, left:0}; // Sin auto margin
        } else {
            if (!finalStyles.display) finalStyles.display = 'block';
            if (!finalStyles.margin) finalStyles.margin = '0 auto';
            if (!widthAttr) finalStyles.maxWidth = '100%';
        }

        // Limpieza final
        delete finalStyles.width; // Dejamos que el atributo width del img mande o el css
        if (finalStyles.backgroundColor === 'transparent') delete finalStyles.backgroundColor;

        parser.addBlock(id, {
            type: "Image",
            data: {
                style: finalStyles,
                props: {
                    url: parser.resolveAssetUrl(src),
                    alt: imgEl.getAttribute("alt") || "Image",
                    linkHref: linkHref,
                    width: widthAttr ? parseInt(widthAttr) : undefined,
                    height: imgEl.getAttribute("height") ? parseInt(imgEl.getAttribute("height")!) : undefined,
                    contentAlignment: "middle"
                }
            }
        });
        return { id };
    }
};