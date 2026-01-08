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
        
        if (['div', 'section', 'article', 'main', 'aside', 'td', 'th', 'header', 'footer', 'li', 'nav'].includes(tag)) {
            if (parser.processedElements?.has(element)) return false;
            
            // Check de imagen (Iconos)
            const hasImage = element.querySelector('img') !== null;
            // Check de contenido visible
            const hasVisibleContent = checkVisibleContent(element);
            
            // 🔥 FIX: Uso de StyleManager para chequear visuales de forma segura
            // (Simulamos un objeto style básico con el atributo string)
            const styleAttr = element.getAttribute('style');
            const hasVisuals = styleAttr ? (styleAttr.includes('background') || styleAttr.includes('border')) : false;
            
            return hasVisibleContent || hasVisuals || hasImage;
        }
        return false;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        
        // 1. Extracción PURA de estilos
        const rawStyles = parser.extractStyles(element, inheritedStyles);
        
        // Capturar alineación explícita
        if (element.getAttribute('align')) {
            rawStyles.textAlign = element.getAttribute('align')!;
        }
        // Capturar width de tabla antiguo (atributo HTML)
        if (element.hasAttribute('width')) {
            rawStyles.width = element.getAttribute('width'); // StyleManager lo normalizará a px después
        }

        // Normalizamos inmediatamente para trabajar con datos limpios (números a px, etc.)
        const currentStyles = StyleManager.normalizeStyles(rawStyles);

        const children = Array.from(element.children);

        // --- 1. Detección Rich Text ---
        let hasStructuralChild = false;
        let textOnlyCount = 0;
        const containsImages = Array.from(element.querySelectorAll('img')).length > 0;
        
        for (const child of children) {
            const tag = child.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style') continue;

            if (STRUCTURAL_BLOCKS.includes(tag)) {
                // Check seguro de display
                const childDisplay = (child.getAttribute('style') || '').toLowerCase();
                if (!childDisplay.includes('display: inline') && !childDisplay.includes('display:inline')) {
                    hasStructuralChild = true; break;
                }
            } else if (TEXT_ONLY_TAGS.includes(tag)) {
                textOnlyCount++;
            }
        }
        
        const hasDirectText = Array.from(element.childNodes).some(n => 
            n.nodeType === 3 && (n.textContent || '').trim().length > 0
        );
        const isMostlyText = (textOnlyCount === children.length && children.length > 0) || hasDirectText;

        if (!hasStructuralChild && isMostlyText && !containsImages) {
            return processAsRichTextImproved(element, parser, currentStyles);
        }

        // --- 2. Procesar Hijos ---
        // Usamos StyleManager para obtener estilos limpios de herencia
        const stylesForChildren = StyleManager.getStylesForChildren(currentStyles);

        const childrenIds: string[] = [];
        parser.processChildren(element, childrenIds, stylesForChildren);

        // 🔥 FIX: Uso seguro de hasVisualStyles (ya no crashea)
        const hasVisuals = StyleManager.hasVisualStyles(currentStyles);

        if (childrenIds.length === 0 && !hasVisuals) return null;

        // --- 3. Lógica de Fusión (Merge) ---
        if (childrenIds.length === 1) {
            const childBlock = parser.blocks[childrenIds[0]];
            
            if (childBlock && ['Container', 'Text', 'Image'].includes(childBlock.type)) {
                const childStyle = childBlock.data.style || {};
                
                const pHasBg = hasVisuals;
                const cHasBg = StyleManager.hasVisualStyles(childStyle);

                // 🔥 FIX: Usamos el chequeo de conflicto centralizado
                const hasLayoutConflict = StyleManager.checkLayoutConflict(currentStyles, childStyle);

                if (!hasLayoutConflict && (!pHasBg || !cHasBg)) {
                    // FUSIONAMOS
                    const mergedStyle = { ...childStyle };

                    // Inyectar visuales del padre
                    if (pHasBg) {
                        StyleManager.PROPS.VISUAL.forEach(prop => {
                            if (currentStyles[prop]) mergedStyle[prop] = currentStyles[prop];
                        });
                    }
                    
                    // Inyectar Layout restrictivo del padre
                    if (currentStyles.maxWidth) mergedStyle.maxWidth = currentStyles.maxWidth;
                    if (currentStyles.width && currentStyles.width !== '100%') mergedStyle.width = currentStyles.width;
                    if (currentStyles.textAlign) mergedStyle.textAlign = currentStyles.textAlign;
                    
                    // Padding: Si hijo no tiene, usa padre
                    if (!mergedStyle.padding && currentStyles.padding) mergedStyle.padding = currentStyles.padding;

                    parser.blocks[childrenIds[0]].data.style = mergedStyle;
                    
                    if (childBlock.type === 'Text') {
                        // Aseguramos block solo para texto fusionado
                        if (!String(mergedStyle.display).includes('inline')) {
                             parser.blocks[childrenIds[0]].data.style.display = 'block';
                        }
                    }

                    return { id: childrenIds[0] };
                }
            }
        }

        // --- 4. Crear Contenedor ---
        // Usamos estilos normalizados (ya tienen px, box-sizing, etc.)
        const finalStyles = { ...currentStyles };
        
        // Fallback Display Block (si no es inline explícito)
        const display = String(finalStyles.display || '');
        if (!display.includes('inline') && !display.includes('table-cell')) {
            finalStyles.display = 'block';
        }
        
        // NO FORZAMOS WIDTH 100% (Estrategia Pura)
        // Dejamos que el CSS original mande.

        parser.addBlock(id, {
            type: "Container",
            data: {
                style: finalStyles,
                props: {
                    childrenIds: childrenIds,
                    tagName: element.tagName.toLowerCase() === 'td' ? 'div' : element.tagName.toLowerCase(),
                    id: element.id,
                    className: element.className
                }
            }
        });

        if (parser.processedElements) parser.processedElements.add(element);
        return { id };
    }
};

// --- Helpers ---

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
    
    // Texto Rico siempre como Bloque completo
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