import { v4 as uuidv4 } from "uuid";
import type { BlockMatcher, MatcherResult } from "./types";
import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleManager } from "../../StyleManager";

const STRUCTURAL_BLOCKS = [
    'table', 'img', 'video', 'button', 'hr', 'form', 'ul', 'ol', 'blockquote', 
    'p', 'div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre', 'iframe'
];

const TEXT_ONLY_TAGS = ['span', 'strong', 'em', 'b', 'i', 'u', 'a', 'code', 'mark', 'small', 'font', 'br', 'strike', 'sub', 'sup'];

export const ContainerMatcher: BlockMatcher = {
    name: "ContainerMatcher",

    isComponent(element: Element, parser: HTMLToBlockParser) {
        const tag = element.tagName.toLowerCase();

        const anchors = element.querySelectorAll('a');
        if (anchors.length === 1) {
            const ownText = element.textContent?.trim() || "";
            const anchorText = anchors[0].textContent?.trim() || "";
            
            // Si el texto coincide, el contenedor es solo un wrapper.
            if (ownText === anchorText && ownText !== "") {
                return false; 
            }
        }
        
        if (['div', 'section', 'article', 'main', 'aside', 'td', 'th', 'header', 'footer', 'li', 'nav', 'a', 'span', 'center'].includes(tag)) {
            if (parser.processedElements?.has(element)) return false;
            
            const hasImage = element.querySelector('img') !== null;
            const hasVisibleContent = checkVisibleContent(element);
            
            // Safe style check
            const styleAttr = element.getAttribute('style');
            const hasVisuals = styleAttr ? (styleAttr.includes('background') || styleAttr.includes('border') || styleAttr.includes('height')) : false;
            
            return hasVisibleContent || hasVisuals || hasImage;
        }
        return false;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const styleAttr = element.getAttribute('style') || '';
        const tag = element.tagName.toLowerCase();
        if (tag === 'a') {
            const hasButtonVisuals = styleAttr.includes('background') || 
                                    styleAttr.includes('border') || 
                                    element.classList.contains('v-button');
            
            // Si tiene aspecto de botón, no lo procesamos como contenedor simple
            if (hasButtonVisuals) return null; 
        }

        const id = uuidv4();
        const currentStyles = parser.extractStyles(element, inheritedStyles);
        
        if (element.getAttribute('align')) currentStyles.textAlign = element.getAttribute('align')!;
        if (element.hasAttribute('width')) currentStyles.width = element.getAttribute('width');

        const children = Array.from(element.children);

        // --- 1. Rich Text Detection ---
        let hasStructuralChild = false;
        let textOnlyCount = 0;
        const containsImages = Array.from(element.querySelectorAll('img')).length > 0;
        
        for (const child of children) {
            const tag = child.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style') continue;
            if (STRUCTURAL_BLOCKS.includes(tag)) {
                const childStyle = (child.getAttribute('style') || '').toLowerCase();
                if (!childStyle.includes('display: inline')) {
                    hasStructuralChild = true; break;
                }
            } else if (TEXT_ONLY_TAGS.includes(tag)) {
                textOnlyCount++;
            }
        }
        
        // Strict text check
        const hasDirectText = Array.from(element.childNodes).some(n => {
            if (n.nodeType === 3) {
                const txt = (n.textContent || '').replace(/[\s\n\t\r]/g, '');
                return txt.length > 0;
            }
            return false;
        });

        const isMostlyText = (textOnlyCount === children.length && children.length > 0) || hasDirectText;

        if (!hasStructuralChild && isMostlyText && !containsImages) {
            return processAsRichTextImproved(element, parser, currentStyles);
        }

        // --- 2. Process Children ---
        const stylesForChildren = StyleManager.getStylesForChildren(currentStyles);
        const childrenIds: string[] = [];
        parser.processChildren(element, childrenIds, stylesForChildren);

        const hasVisuals = StyleManager.hasVisualStyles(currentStyles);
        if (childrenIds.length === 0 && !hasVisuals) return null;

        // --- 3. Merge Logic ---
        if (childrenIds.length === 1) {
            const childBlock = parser.blocks[childrenIds[0]];
            const isLink = element.tagName === 'A'; 

            if (!isLink && childBlock && ['Container', 'Text', 'Image'].includes(childBlock.type)) {
                const childStyle = childBlock.data.style || {};
                const hasConflict = StyleManager.checkLayoutConflict(currentStyles, childStyle);
                const pHasBg = hasVisuals;
                const cHasBg = StyleManager.hasVisualStyles(childStyle);

                if (!hasConflict && (!pHasBg || !cHasBg)) {
                    const mergedStyle = { ...childStyle };
                    // Merge logic (copy visuals from parent)
                    if (pHasBg) {
                        StyleManager.PROPS.VISUAL.forEach(prop => {
                            if (currentStyles[prop]) mergedStyle[prop] = currentStyles[prop];
                        });
                    }
                    if (currentStyles.maxWidth) mergedStyle.maxWidth = currentStyles.maxWidth;
                    if (currentStyles.width && currentStyles.width !== '100%') mergedStyle.width = currentStyles.width;
                    if (currentStyles.textAlign) mergedStyle.textAlign = currentStyles.textAlign;
                    if (!mergedStyle.padding && currentStyles.padding) mergedStyle.padding = currentStyles.padding;

                    parser.blocks[childrenIds[0]].data.style = mergedStyle;
                    return { id: childrenIds[0] };
                }
            }
        }

        // --- 4. Create Container (SHRINK WRAP LOGIC) ---
        const finalStyles = { ...currentStyles };
        finalStyles.boxSizing = 'border-box';

        // --- HEURISTICS ---
        const widthVal = parseInt(String(finalStyles.width || '999'));
        const heightVal = parseInt(String(finalStyles.height || '0'));
        
        // 1. Is it a wrapper for images? (No text, has images)
        const isImageWrapper = containsImages && !hasDirectText;
        
        // 2. Is it small fixed size?
        const isSmallFixed = (!isNaN(widthVal) && widthVal < 200);
        
        // 3. Does it have a small specific HEIGHT? (e.g. 32px social icons)
        const hasSmallHeight = (!isNaN(heightVal) && heightVal > 0 && heightVal < 60);

        // 4. Was it originally inline?
        const isOriginalInline = String(finalStyles.display).includes('inline') || String(finalStyles.display).includes('table-cell');

        // FORCE INLINE-BLOCK if any heuristic matches
        if (isImageWrapper || isSmallFixed || hasSmallHeight || isOriginalInline) {
            finalStyles.display = 'inline-block';
            
            // Remove full width forcing
            if (!finalStyles.width || finalStyles.width === '100%') {
                delete finalStyles.width; 
            }
            
            finalStyles.verticalAlign = finalStyles.verticalAlign || 'top';
        } else {
            // Standard Block
            finalStyles.display = 'block';
            if (!finalStyles.width || finalStyles.width === 'auto') {
                finalStyles.width = '100%';
            }
        }

        parser.addBlock(id, {
            type: "Container",
            data: {
                style: finalStyles,
                props: {
                    childrenIds: childrenIds,
                    tagName: element.tagName.toLowerCase() === 'td' ? 'div' : element.tagName.toLowerCase(),
                    id: element.id,
                    className: element.className,
                    href: element.getAttribute('href') || undefined,
                    target: element.getAttribute('target') || undefined
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    }
};

// ... Helpers ...
function checkVisibleContent(element: Element): boolean {
    const clone = element.cloneNode(true) as Element;
    const clean = (node: Node) => {
        const children = Array.from(node.childNodes);
        children.forEach(c => {
            if (c.nodeType === 8 || ['SCRIPT', 'STYLE', 'META', 'LINK'].includes(c.nodeName)) {
                node.removeChild(c);
            } else if (c.nodeType === 1) {
                clean(c);
            }
        });
    };
    clean(clone);
    const text = (clone.textContent || '').replace(/[\s\n\t\r]|&nbsp;|&#160;/g, '');
    const hasMedia = clone.querySelector('img, video, iframe, input, button, hr, svg');
    return text.length > 0 || !!hasMedia;
}

function processAsRichTextImproved(element: Element, parser: HTMLToBlockParser, styles: any): MatcherResult | null {
    if (!checkVisibleContent(element)) {
        if (!StyleManager.hasVisualStyles(styles)) return null;
    }
    const content = element.innerHTML.trim();
    const id = uuidv4();
    const blockStyles = { ...styles };
    blockStyles.display = 'block';
    blockStyles.width = '100%';
    blockStyles.whiteSpace = 'normal';
    if (styles.textAlign) blockStyles.textAlign = styles.textAlign;

    parser.addBlock(id, {
        type: "Text",
        data: {
            style: blockStyles,
            props: {
                content: content,
                text: element.textContent || "",
                tagName: 'div',
                isHtml: true 
            }
        }
    });
    if (parser.processedElements) {
        parser.processedElements.add(element);
        Array.from(element.querySelectorAll('*')).forEach(c => parser.processedElements!.add(c));
    }
    return { id };
}