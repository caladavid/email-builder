import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils"; 

// Recursive helper to detect if a container wraps exactly one image
function isSingleImageWrapper(element: Element): boolean {
    const children = element.childNodes;
    let imageCount = 0;

    for (let index = 0; index < children.length; index++) {
        const node = children[index];

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.replace(/[\s\u00A0\n\r]/g, '') || '';
            if (text.length > 0) return false;
        } 
        else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();

            if (tag === "img") {
                imageCount++;
            } else if (tag === "br") {
                continue;
            } else if (['a', 'span', 'div', 'p', 'center', 'td', 'strong', 'b'].includes(tag)) {
                if (isSingleImageWrapper(el)) {
                    imageCount++;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    }
    return imageCount === 1;
}

export const ImageMatcher: BlockMatcher = {
    name: 'Image',

    isComponent: (element: Element) => {
        const tag = element.tagName.toLowerCase();
        
        if (tag === "img"){
            // Avoid matching if inside an <a> (handled by wrapper logic or link logic)
            if (element.parentElement?.tagName.toLowerCase() === 'a') return false;
            return true
        }

        if (['a', 'td', 'div', 'span', 'p', 'center'].includes(tag)) {
            if (tag === 'a') return isSingleImageWrapper(element);
            
            // For block containers, only match single images (InlineIcons handles multiple)
            if (['td', 'div', 'span', 'p'].includes(tag)) {
                 return isSingleImageWrapper(element);
            }
        }

        return false;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        // 1. Locate the image element
        const imgEl = element.tagName.toLowerCase() === 'img' 
            ? element 
            : element.querySelector('img');

        if (!imgEl) return null;

        // 2. Locate the link (if any)
        let linkHref: string | undefined = undefined;
        const anchor = element.tagName.toLowerCase() === 'a' 
            ? element 
            : element.querySelector('a');
        if (anchor) linkHref = anchor.getAttribute('href') || undefined;

        // 3. Style Absorption (Climb up to capture wrapper styles)
        let combinedStyles = StyleUtils.extractUnifiedStyles(imgEl);
        let current: Element | null = imgEl;
        const processedNodes = new Set<Element>();
        
        while (current && !processedNodes.has(current)) {
            processedNodes.add(current);

            if (current !== imgEl) {
                const layerStyles = StyleUtils.extractUnifiedStyles(current);
                
                // Inherit background, align, padding, border if not present on image
                if (!combinedStyles.backgroundColor && layerStyles.backgroundColor && layerStyles.backgroundColor !== 'transparent') {
                    combinedStyles.backgroundColor = layerStyles.backgroundColor;
                }
                if (!combinedStyles.textAlign && layerStyles.textAlign) {
                    combinedStyles.textAlign = layerStyles.textAlign;
                }
                if (layerStyles.padding) combinedStyles.padding = layerStyles.padding;
                if (layerStyles.border) combinedStyles.border = layerStyles.border;
            }

            // Stop if we hit the element that triggered the matcher
            if (current === element) break;
            current = current.parentElement;
        }

        // 4. Data Preparation
        const PLACEHOLDER_IMG = 'https://placehold.net/default.png';
        let src = imgEl.getAttribute("src") || "";
        const base = (src.split("/").pop() || src).toLowerCase();
        
        // Filter out tracking pixels or blank images
        if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null;
        if (!src) src = PLACEHOLDER_IMG;

        const dataUrl = parser.resolveAssetUrl(src);
        const id = uuidv4();

        const widthAttr = imgEl.getAttribute("width");
        const heightAttr = imgEl.getAttribute("height");
        // Use attribute width > style width > fallback
        const widthVal = widthAttr ? parseInt(widthAttr) : (combinedStyles.width ? parseInt(String(combinedStyles.width)) : 999);
        const isSmallIcon = widthVal <= 60;

        const finalStyles = {
            ...inheritedStyles,
            ...combinedStyles
        };

        if (!finalStyles.padding) finalStyles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
        if (!finalStyles.textAlign) finalStyles.textAlign = "center";

        if (isSmallIcon) {
            finalStyles.display = "inline-block";
            if (!finalStyles.margin) finalStyles.margin = { top: 0, right: 0, bottom: 0, left: 0 };
        } else {
            if (!finalStyles.display) finalStyles.display = "block";
            if (!widthAttr) finalStyles.maxWidth = "100%";
            if (!finalStyles.margin) finalStyles.margin = "0 auto";
        }

        if (finalStyles.width === '100%') delete finalStyles.width;
        if (finalStyles.backgroundColor === 'transparent') delete finalStyles.backgroundColor;

        parser.addBlock(id, {
            type: "Image",
            data: {
                style: finalStyles,
                props: {
                    url: dataUrl,
                    alt: imgEl.getAttribute("alt") || "Image",
                    linkHref: linkHref,
                    width: widthAttr ? parseInt(widthAttr) : undefined,
                    height: heightAttr ? parseInt(heightAttr) : undefined,
                    contentAlignment: "middle",
                }
            }
        });

        return { id };
    }
};