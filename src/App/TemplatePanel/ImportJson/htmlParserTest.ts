import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { EditorConfigurationSchema, type TEditorConfiguration } from "../../../documents/editor/core";
import { ParseError, type ParseResult } from "./ParseError";

/* =========================================================
   1. CSSParser (Sin cambios, funciona bien)
   ========================================================= */
class CSSParser {
    private rules: { selector: string; styles: Record<string, string> }[] = [];

    constructor(cssContent: string) {
        this.parse(cssContent);
    }

    private parse(cssContent: string) {
        const ruleRegex = /([^{}]+)\s*\{\s*([^}]+)\s*\}/g;
        let match;
        while ((match = ruleRegex.exec(cssContent)) !== null) {
            const selectors = match[1].split(",").map((s) => s.trim());
            const declarations = match[2].split(";").map((d) => d.trim()).filter(Boolean);
            const styles: Record<string, string> = {};
            declarations.forEach((declaration) => {
                const [prop, val] = declaration.split(":").map((s) => s.trim());
                if (prop && val) styles[prop.toLowerCase()] = val;
            });
            selectors.forEach((selector) => this.rules.push({ selector, styles }));
        }
    }

    getStylesForElement(element: Element): Record<string, string> {
        const matchingStyles: Record<string, string> = {};
        const sortedRules = [...this.rules].sort((a, b) => {
            const sp = (s: string) => (s.includes("#") ? 100 : 0) + (s.includes(".") ? 10 : 0) + (s.includes(" ") ? 1 : 0);
            return sp(a.selector) - sp(b.selector);
        });
        sortedRules.forEach((rule) => {
            try { if (element.matches(rule.selector)) Object.assign(matchingStyles, rule.styles); } catch (_e) {}
        });
        return matchingStyles;
    }
}

/* =========================================================
   2. HTMLToBlockParser (Refactorizado y Optimizado)
   ========================================================= */
export class HTMLToBlockParser {
    private imageMap: Map<string, string> = new Map();
    private fontMap: Map<string, { url: string; format: string }> = new Map();
    private mediaMap: Map<string, string> = new Map();
    private blocks: Record<string, any> = {};
    private processedElements: WeakSet<Element> = new WeakSet();
    private cssParser: CSSParser | null = null;
    private readonly PLACEHOLDER_IMG = 'https://placehold.co/600x400?text=Imagen+No+Encontrada';

    /* ---------------- ENTRY POINTS ---------------- */

    async parseZipToBlocks(zipFile: File): Promise<ParseResult> {
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(zipFile);

            // 1. Procesar CSS
            let cssContent = "";
            const cssFiles = Object.keys(contents.files).filter(f => f.endsWith(".css") && !f.includes("__MACOSX"));
            for (const cssFile of cssFiles) {
                const content = await contents.file(cssFile)?.async("string");
                if (content) cssContent += content;
            }
            if (cssContent) this.cssParser = new CSSParser(cssContent);

            // 2. Procesar Imágenes
            const imgFiles = Object.keys(contents.files).filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f) && !f.includes("__MACOSX"));
            for (const imgPath of imgFiles) {
                const base64 = await contents.file(imgPath)?.async("base64");
                const mime = this.getMimeType(imgPath);
                const fileName = imgPath.split("/").pop() || "";
                const dataUrl = `data:${mime};base64,${base64}`;
                this.imageMap.set(fileName, dataUrl);
                this.imageMap.set(fileName.toLowerCase(), dataUrl);
            }

            // 3. Buscar HTML
            const htmlFile = Object.keys(contents.files).find(name => !contents.files[name].dir && name.toLowerCase().endsWith(".html") && !name.includes("__MACOSX"));
            
            if (!htmlFile) throw new ParseError('No se encontró archivo HTML', 'ZIP_ERROR');

            const htmlContent = await contents.file(htmlFile)?.async("string");
            if (!htmlContent) throw new Error("Archivo HTML vacío");

            return this.parseHtmlToBlocksWithErrors(htmlContent);

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, errors: [new ParseError(msg, 'ZIP_ERROR')], warnings };
        }
    }

    async parseHtmlToBlocksWithErrors(htmlContent: string): Promise<ParseResult> {
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];
        try {
            const cleanedHtml = this.cleanHtml(htmlContent);
            const parser = new DOMParser();
            const doc = parser.parseFromString(cleanedHtml, "text/html");
            const body = doc.body || doc.documentElement;

            this.blocks = {};
            this.processedElements = new WeakSet();

            const childrenIds: string[] = [];
            this.processChildren(body, childrenIds, {});
            const configuration = this.buildConfiguration(childrenIds);

            return { success: true, configuration, errors, warnings };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, errors: [new ParseError(msg, 'HTML_ERROR')], warnings };
        }
    }

    /* =========================================================
       PARSER PRINCIPAL (Tu estructura original mejorada)
       ========================================================= */
    private processElement(element: Element, inheritedStyles: Record<string, string>): string | null {
        if (this.processedElements.has(element)) return null;
        this.processedElements.add(element);

        const tagName = element.tagName.toLowerCase();
        
        // 🔥 MEJORA: Extracción robusta de estilos (Legacy + CSS)
        const currentStyles = this.extractStyles(element, inheritedStyles);

        // =========================================================
        // NIVEL 0: CORRECCIONES ESTRUCTURALES (Iconos RRSS)
        // =========================================================
        
        // 🔥 LA SOLUCIÓN DEFINITIVA PARA ICONOS:
        // Si detectamos una fila o celda que es puramente de iconos (imágenes pequeñas),
        // la convertimos en un BLOQUE DE TEXTO. Esto fuerza a las imágenes a ser "inline".
        
        const isTableStructure = tagName === 'tr' || tagName === 'td' || tagName === 'div';
        if (isTableStructure && this.isIconGroup(element)) {
            const images = Array.from(element.querySelectorAll('img'));
            // Solo aplicamos esto si hay múltiples imágenes, para no romper layouts normales
            if (images.length > 1) {
                return this.createGroupedImagesTextBlock(images, currentStyles);
            }
        }

        // =========================================================
        // NIVEL 1: ESTRUCTURA MACRO (Tablas y Grids)
        // =========================================================

        if (tagName === "table") {
            // Tu lógica original para tablas compactas
            if (this.isInlineCompactTable(element)) {
                return this.createInlineCompactTableBlock(element, currentStyles);
            }
            // Tu lógica original para columnas
            if (this.isColumnsTable(element)) {
                return this.createColumnsContainer(element, currentStyles);
            }
        }

        if (this.isFlexContainer(element)) return this.createFlexContainer(element, currentStyles);
        if (this.isGridContainer(element)) return this.createGridContainer(element, currentStyles);

        // =========================================================
        // NIVEL 2: COMPONENTES ESPECÍFICOS
        // =========================================================

        // 1. AVATAR
        if (tagName === 'img' && this.isAvatar(element, currentStyles)) {
            const imgId = this.createImageBlock(element as HTMLImageElement, currentStyles);
            if (imgId && this.blocks[imgId]) {
                this.blocks[imgId].type = 'Avatar';
                return imgId;
            }
        }

        // 2. IMAGEN / BANNER
        if (tagName === "a") {
            const imgs = element.querySelectorAll("img");
            const text = element.textContent?.trim() || "";
            // Si es <a><img></a> sin texto
            if (imgs.length === 1 && text === "") {
                 const img = imgs[0];
                 const id = this.createImageBlock(img, currentStyles, element.getAttribute("href") || "#");
                 return id;
            }
        }
        if (tagName === "img") {
            // Si el padre no es un <a> (ya procesado arriba), creamos la imagen
            if (element.parentElement?.tagName.toLowerCase() !== "a") {
                return this.createImageBlock(element as HTMLImageElement, currentStyles);
            }
        }

        // 3. BOTÓN
        if (this.isButton(element, currentStyles)) {
            return this.createButtonBlock(element, currentStyles);
        }
        if (this.isButtonLikeCell(element)) {
            const anchor = element.querySelector('a');
            if (anchor) return this.createButtonBlock(anchor, currentStyles);
        }

        // 4. ELEMENTOS SIMPLES
        if (this.isSeparator(element, currentStyles)) {
            const id = uuidv4();
            this.blocks[id] = { type: "Divider", data: { style: currentStyles, props: { lineColor: "#CCCCCC" } } };
            return id;
        }
        if (this.isSpacer(element, currentStyles)) {
            const id = uuidv4();
            const height = parseInt(String(currentStyles.height)) || 20;
            this.blocks[id] = { type: "Spacer", data: { style: {}, props: { height } } };
            return id;
        }
        if (/^h[1-6]$/.test(tagName)) {
            return this.createHeadingBlock(element, currentStyles);
        }

        // 5. TEXTO
        // Si es P, SPAN o TD con solo texto directo
        const isTextTag = ["p", "span", "div", "td", "li", "font", "strong", "b", "em", "i"].includes(tagName);
        if (isTextTag) {
            // Verificamos si tiene contenido de texto real y NO tiene bloques complejos dentro
            if (!this.elementContainsOtherBlockTypes(element)) {
                const { text, formats } = this.processInlineContent(element, currentStyles);
                if (text.length > 0) {
                    return this.createTextBlock(text, formats, currentStyles);
                }
            }
        }

        // =========================================================
        // NIVEL 3: CONTENEDORES GENÉRICOS (Fallback)
        // =========================================================

        const childrenIds: string[] = [];
        const cleanStyles = this.filterInheritableStyles(currentStyles);
        this.processChildren(element, childrenIds, cleanStyles);

        if (childrenIds.length > 0) {
            // Optimización: "Aplanamiento". Si es un div transparente con 1 hijo, devolvemos el hijo.
            const isTransparent = !currentStyles.backgroundColor && !currentStyles.border;
            const hasPadding = currentStyles.padding && (currentStyles.padding.top > 0 || currentStyles.padding.left > 0);
            
            if (childrenIds.length === 1 && isTransparent && !hasPadding && tagName !== 'td') {
                return childrenIds[0];
            }
            return this.createContainerBlock(childrenIds, currentStyles);
        }

        // =========================================================
        // NIVEL 4: FALLBACK HTML (Último recurso)
        // =========================================================
        
        const hasContent = (element.textContent?.trim().length || 0) > 0 || element.children.length > 0;
        const ignoredTags = ['br', 'script', 'style', 'meta', 'title', 'link', 'tbody', 'tr'];
        
        if (hasContent && !ignoredTags.includes(tagName)) {
            const id = uuidv4();
            this.blocks[id] = {
                type: "Html",
                data: {
                    props: { content: element.outerHTML },
                    style: { padding: { top:0, bottom:0, left:0, right:0 }, backgroundColor: "transparent" }
                }
            };
            return id;
        }

        return null;
    }

    /* ---------------- NUEVA LÓGICA DE ICONOS ---------------- */

    // Detecta si un elemento (fila/celda) es un grupo de iconos
    private isIconGroup(element: Element): boolean {
        // Buscamos todas las imágenes dentro
        const imgs = Array.from(element.querySelectorAll('img'));
        if (imgs.length < 2) return false;

        // Verificamos si hay mucho texto. Si hay mucho texto, no es un grupo de iconos.
        const text = element.textContent?.trim() || "";
        if (text.length > 20) return false;

        return true;
    }

    // Convierte las imágenes en un bloque de texto Markdown para que queden inline
    private createGroupedImagesTextBlock(images: HTMLImageElement[], styles: any): string {
        const id = uuidv4();
        
        const markdownParts = images.map(img => {
            let src = img.getAttribute("src") || "";
            // Intentar resolver imagen desde mapa
            if (!src.startsWith("http") && !src.startsWith("data:")) {
                const fName = src.split("/").pop() || "";
                const mapped = this.imageMap.get(fName) || this.imageMap.get(fName.toLowerCase());
                if (mapped) src = mapped;
                else src = this.PLACEHOLDER_IMG;
            }

            const alt = img.getAttribute("alt") || "icon";
            const parentLink = img.closest('a');
            const href = parentLink ? parentLink.getAttribute('href') || '#' : '#';
            
            // Markdown de imagen con link: [![alt](src)](href)
            return `[![${alt}](${src})](${href})`;
        });

        const textContent = markdownParts.join(" ");

        this.blocks[id] = {
            type: "Text",
            data: {
                style: { 
                    ...styles, 
                    textAlign: 'center' // Forzamos centrado para iconos
                },
                props: {
                    text: textContent,
                    markdown: true, // Esto activa el renderizado de imágenes en el editor
                    formats: [] 
                }
            }
        };
        return id;
    }

    /* ---------------- BUILDERS ORIGINALES AJUSTADOS ---------------- */

    private createContainerBlock(childrenIds: string[], styles?: any): string | null {
        if (!childrenIds.length) return null;
        const id = uuidv4();
        
        // Asegurar que el padding sea objeto numérico
        const safePadding = styles?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
        
        this.blocks[id] = {
            type: "Container",
            data: {
                style: {
                    ...styles,
                    padding: safePadding,
                    display: styles?.display === 'flex' ? 'flex' : 'block' // Respetar flex
                },
                props: { childrenIds }
            }
        };
        return id;
    }

    private createImageBlock(element: Element, styles: any, linkHref?: string): string | null {
        const id = uuidv4();
        let src = element.getAttribute("src") || "";
        
        // Resolver URL
        if (!src) src = this.PLACEHOLDER_IMG;
        else if (!src.startsWith("http") && !src.startsWith("data:")) {
            const fName = src.split("/").pop() || "";
            const mapped = this.imageMap.get(fName) || this.imageMap.get(fName.toLowerCase());
            if (mapped) src = mapped;
        }

        // 🔥 MEJORA DE ANCHO: No forzar 100% si es pequeño
        const attrW = element.getAttribute("width");
        let width = '100%';
        // Si tiene width explícito < 100 px, lo respetamos (es un icono)
        if (attrW && parseInt(attrW) < 150 && !attrW.includes('%')) {
            width = `${attrW}px`;
        } else if (styles.width && styles.width !== 'auto') {
            width = styles.width;
        }

        this.blocks[id] = {
            type: "Image",
            data: {
                style: {
                    ...styles,
                    width: width,
                    height: 'auto',
                    display: 'block'
                },
                props: {
                    url: src,
                    alt: element.getAttribute("alt") || "Imagen",
                    linkHref: linkHref || undefined
                }
            }
        };
        return id;
    }

    private createTextBlock(text: string, formats: any[], styles: any, forceMarkdown: boolean = false): string | null {        
        if (!text) return null;
        const id = uuidv4(); 
        
        // Detectar si visualmente es markdown (links o saltos de linea)
        const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(text);
        const hasLineBreaks = text.includes('\n');

        this.blocks[id] = {
            type: "Text",
            data: {
                style: { ...styles },
                props: {
                    text: text,  
                    formats: formats,  
                    markdown: hasMarkdownLinks || hasLineBreaks || forceMarkdown 
                }
            }
        };
        return id;
    }

    /* ---------------- HELPERS Y UTILIDADES ---------------- */

    private cleanHtml(html: string): string {
        // 🔥 FIX: Regex correcta para comentarios
        let clean = html.replace(//g, "");
        clean = clean.replace(/<\/?(html|head|body|!DOCTYPE)[^>]*>/gi, '');
        return clean.trim();
    }

    private extractStyles(element: Element, inherited: any): any {
        const styles: any = {};
        // 1. Heredar
        ['fontFamily', 'fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight'].forEach(p => {
            if (inherited[p]) styles[p] = inherited[p];
        });

        // 2. CSS Parser
        if (this.cssParser) Object.assign(styles, this.cssParser.getStylesForElement(element));

        // 3. Atributos Legacy (CRUCIAL PARA EMAILS)
        const mapAttr = (a: string, p: string) => {
            const v = element.getAttribute(a);
            if (v) styles[p] = isNaN(Number(v)) ? v : `${v}px`;
        };
        mapAttr('width', 'width'); 
        mapAttr('height', 'height'); 
        mapAttr('bgcolor', 'backgroundColor');
        
        const align = element.getAttribute('align');
        if (align) styles.textAlign = align;

        const cp = element.getAttribute('cellpadding');
        if (cp) { const p = parseInt(cp); styles.padding = {top:p, right:p, bottom:p, left:p}; }

        // 4. Inline Styles
        const inline = element.getAttribute('style');
        if (inline) Object.assign(styles, this.parseInlineCss(inline));

        return styles;
    }

    private parseInlineCss(str: string): any {
        const res: any = {};
        str.split(';').forEach(rule => {
            const [p, v] = rule.split(':');
            if (p && v) {
                const key = p.trim().replace(/-./g, c => c.toUpperCase().substr(1));
                const val = v.trim();
                // Manejo especial de padding shorthand
                if (key === 'padding') {
                    const vals = val.split(' ').map(x => parseInt(x));
                    if (vals.length === 1 && !isNaN(vals[0])) res.padding = {top:vals[0], right:vals[0], bottom:vals[0], left:vals[0]};
                    else if (vals.length >= 2) res.padding = {top:vals[0], right:vals[1], bottom:vals[0], left:vals[1]};
                    else res[key] = val; 
                } else {
                    res[key] = val;
                }
            }
        });
        return res;
    }

    private processChildren(parentElement: Element, targetArray: string[], inheritedStyles: Record<string, string>): void {
        Array.from(parentElement.childNodes).forEach((node) => {
            // Procesa nodos de texto o elementos
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent?.trim();
                if (txt) targetArray.push(this.createTextBlock(txt, [], inheritedStyles)!);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const id = this.processElement(node as Element, inheritedStyles);
                if (id) targetArray.push(id);
            }
        });
    }

    // ... (Mantén tus métodos auxiliares: isButton, isSeparator, isSpacer, createButtonBlock, etc. que ya funcionaban bien) ...
    // ... (createColumnsContainer, createInlineCompactTableBlock, createFlexContainer, createGridContainer, createVideoBlock, createAudioBlock, createFormField, createListBlock, createDividerBlock, createSpacerBlock, createHeadingBlock) ...
    
    // IMPORTANTE: Asegúrate de incluir aquí el resto de tus métodos 'create...' y 'is...' 
    // tal como estaban en tu código original para no perder funcionalidad.
    // Solo he pegado aquí los que requerían cambios lógicos.

    // ... (Helpers: getMimeType, processInlineContent, isInlineOnly, elementContainsOtherBlockTypes, isColumnsTable, isInlineCompactTable, etc.) ...

    // --- Métodos que faltaban en el snippet anterior y son necesarios ---
    private isButton(el: Element, st: any): boolean {
        return (st.backgroundColor && st.padding) || el.classList.contains('btn');
    }
    private isSeparator(el: Element, st: any): boolean {
        return el.tagName.toLowerCase() === 'hr';
    }
    private isSpacer(el: Element, st: any): boolean {
        return !el.textContent?.trim() && !!st.height;
    }
    private isAvatar(el: Element, st: any): boolean {
        return el.tagName.toLowerCase() === 'img' && (st.borderRadius?.includes('50%') || parseInt(st.borderRadius) > 50);
    }
    private isButtonLikeCell(el: Element): boolean { return false; } // Implementar si lo usas
    private elementContainsOtherBlockTypes(el: Element): boolean {
        const blockTags = ["table", "img", "h1", "h2", "div"];
        return Array.from(el.children).some(c => blockTags.includes(c.tagName.toLowerCase()));
    }
    private isInlineOnly(el: Element): boolean {
        const inline = ['span','strong','b','em','i','a','br'];
        return Array.from(el.childNodes).every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && inline.includes((n as Element).tagName.toLowerCase())));
    }
    private processInlineContent(el: Element, st: any): {text:string, formats:any[]} {
        return { text: el.textContent || "", formats: [] }; // Tu implementación real aquí
    }
    private getMimeType(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext === 'png') return 'image/png';
        if (ext === 'jpg') return 'image/jpeg';
        return 'application/octet-stream';
    }
    private filterInheritableStyles(st: any) { return st; }
    private pickFirstBgColor(cells: Element[]) { return null; }
    private pickRowHeight(cells: Element[]) { return 0; }
    private createInlineCompactTableBlock(el: Element, st: any) { return null; } // O tu implementación antigua
    private isColumnsTable(el: Element) { return false; } // O tu implementación antigua
    private isInlineCompactTable(el: Element) { return false; } // O tu implementación antigua
    private createColumnsContainer(el: Element, st: any) { return null; } // O tu implementación antigua
    private isFlexContainer(el: Element) { return false; }
    private createFlexContainer(el: Element, st: any) { return ""; }
    private isGridContainer(el: Element) { return false; }
    private createGridContainer(el: Element, st: any) { return ""; }
    private createVideoBlock(el: Element) { return null; }
    private createAudioBlock(el: Element) { return null; }
    private createFormField(el: Element, st: any) { return null; }
    private createListBlock(el: Element, st: any) { return null; }

    private buildConfiguration(rootIds: string[]): TEditorConfiguration {
        const config: TEditorConfiguration = {
            root: {
                type: "EmailLayout",
                data: {
                    backdropColor: "#F8F8F8",
                    canvasColor: "#FFFFFF",
                    childrenIds: rootIds,
                    fontFamily: "MODERN_SANS",
                    textColor: "#242424"
                }
            },
            ...this.blocks
        };
        EditorConfigurationSchema.safeParse(config);
        return config;
    }
}