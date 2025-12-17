import JSZip, { type JSZipObject } from "jszip";
import { v4 as uuidv4 } from "uuid";
import { EditorConfigurationSchema, type TEditorConfiguration } from "../../../documents/editor/core";
import { ParseError, type ParseResult } from "./ParseError";

/* =========================================================
   CSSParser (simple)
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
                const declarations = match[2]
                    .split(";")
                    .map((d) => d.trim())
                    .filter(Boolean);
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
                const sp = (s: string) =>
                    (s.includes("#") ? 100 : 0) + (s.includes(".") ? 10 : 0) + (s.includes(" ") ? 1 : 0);
                return sp(a.selector) - sp(b.selector);
            });

            sortedRules.forEach((rule) => {
                try {
                    if (element.matches(rule.selector)) Object.assign(matchingStyles, rule.styles);
                } catch (_e) {
                }
            });
            return matchingStyles;
        }
    }

    class EnhancedCSSParser extends CSSParser {  
        private fontFaces: string[] = [];  
        private mediaQueries: string[] = [];  
        private keyframes: Map<string, string> = new Map();  

        constructor(cssContent: string) {  
            super(cssContent);  
            this.parseAdvancedCSS(cssContent);  
        }  

        private parseAdvancedCSS(cssContent: string){
            // Extraer @font-face
            const fontFaceRegex = /@font-face\s*\{[^}]*\}/g;
            let match;
            while ((match = fontFaceRegex.exec(cssContent)) !== null) {
                this.fontFaces.push(match[0]);
            }

            // Extraer @media queries  
            const mediaRegex = /@media[^{]*\{([^{}]*\{[^{}]*\})*[^{}]*\}/g;  
            while ((match = mediaRegex.exec(cssContent)) !== null) {  
                this.mediaQueries.push(match[0]);  
            }  
    
            // Extraer @keyframes  
            const keyframesRegex = /@keyframes\s+(\w+)\s*\{([^}]*)\}/g;  
            while ((match = keyframesRegex.exec(cssContent)) !== null) {  
                this.keyframes.set(match[1], match[2]);  
            }  

        }

        getFontFaces(): string[] {    
            return this.fontFaces;    
        }    
    
        injectFontFaces(): string {    
            return this.fontFaces.join('\n');    
        }    
    
        getMediaQueries(): string[] {  
            return this.mediaQueries;  
        }  
    
        getKeyframes(): Map<string, string> {  
            return this.keyframes;  
        }  

    }

    
/* =========================================================
   HTMLToBlockParser
   ========================================================= */
export class HTMLToBlockParser {
    private imageMap: Map<string, string> = new Map();
    private fontMap: Map<string, { url: string; format: string }> = new Map();  
    private mediaMap: Map<string, string> = new Map();  
    private blocks: Record<string, any> = {};
    private childrenIds: string[] = [];
    private processedElements: WeakSet<Element> = new WeakSet();
    private cssParser: CSSParser | EnhancedCSSParser | null = null;

    /* ---------------- ZIP → Blocks ---------------- */
    async parseZipToBlocks(zipFile: File): Promise<ParseResult> {
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(zipFile);

            const fileCount = Object.keys(contents.files).length;
            if (fileCount === 0) {
                throw new ParseError(  
                    'El archivo ZIP está vacío',  
                    'ZIP_ERROR',  
                    { fileCount }  
                );  
            }

            // Procesar imágenes con recolección de errores
            const imageResult = await this.processImagesWithErrors(contents);
            errors.push(...imageResult.errors)
            warnings.push(...imageResult.warnings);

            const cssResult = await this.extractAndProcessStylesWithErrors(contents);
            errors.push(...cssResult.errors)
            warnings.push(...cssResult.warnings);

            await this.processFonts(contents);  
            await this.processVideos(contents);  
            await this.processAudio(contents);  

            const htmlFiles = Object.keys(contents.files).filter(name => 
                !contents.files[name].dir && name.toLowerCase().endsWith(".html") 
            );

            if (htmlFiles.length === 0){
                throw new ParseError(  
                    'No se encontró archivo HTML en el ZIP',  
                    'ZIP_ERROR',  
                    { foundFiles: Object.keys(contents.files).filter(f => !contents.files[f].dir) },  
                    false  
                );  
            }

            if (htmlFiles.length > 1) {
                warnings.push(new ParseError(  
                    `Se encontraron múltiples archivos HTML (${htmlFiles.length}). Solo se usará: ${htmlFiles[0]}`,  
                    'ZIP_ERROR',  
                    { htmlFiles }  
                ));  
            }
            const htmlFile = contents.file(htmlFiles[0]);
            const htmlContent = await (htmlFile as JSZipObject).async("string");

            const parseResult = await this.parseHtmlToBlocksWithErrors(htmlContent);
            errors.push(...parseResult.errors);  
            warnings.push(...parseResult.warnings);  
            
            return {  
                success: errors.filter(e => !e.recoverable).length === 0,  
                configuration: parseResult.configuration,  
                errors,  
                warnings  
            };  
        } catch (error) {
            if (error instanceof ParseError) {  
                return {  
                    success: false,  
                    errors: [error],  
                    warnings  
                };  
            }  
            throw error;  
        }
    }

/*     async parseZipToBlocks(zipFile: File): Promise<TEditorConfiguration> {
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipFile);

        await this.processImages(contents);
        const styleContent = await this.extractAndProcessStyles(contents);
        this.cssParser = new CSSParser(styleContent);

        let htmlFile: JSZipObject | null = null;
        contents.forEach((_rel, file) => {
            if (!file.dir && file.name.toLowerCase().endsWith(".html")) htmlFile = file;
        });
        if (!htmlFile) throw new Error("No se encontró archivo HTML en el ZIP");

        const htmlContent = await (htmlFile as JSZipObject).async("string");
        return this.parseHtmlToBlocks(htmlContent);
    } */

    /* ---------------- Limpieza HTML ---------------- */
    private cleanHtml(htmlContent: string): string {
        let cleaned = htmlContent;
        
        // Arregla filas/celdas cortadas
        cleaned = cleaned.replace(/<\/tr>\s*<td/gi, "</tr><tr><td");
        cleaned = cleaned.replace(/td>\s*<\/tr>/gi, "td></tr>");
        
        // Quita </b>/<strong> huérfanos justo antes de </td> / </tr> / fin
        cleaned = cleaned.replace(/<\/(b|strong)>\s*(?=(<\/td>|<\/tr>|$))/gi, "");
        // …y también cuando hay <br> entremedio (caso típico de plantillas de email)
        cleaned = cleaned.replace(/<\/(b|strong)>(?=(?:\s|<br\s*\/?>)*<\/td>)/gi, "");
        /* console.log('HTML antes de limpiar:', cleaned);  */
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleaned, "text/html");

        // Quitar <table> dentro de <a> (mueve la tabla fuera del enlace)
        const linksWithTables = doc.querySelectorAll("a table");
        linksWithTables.forEach((table) => {
            const parentLink = table.closest("a");
            if (!parentLink || !parentLink.parentNode) return;
            parentLink.parentNode.insertBefore(table, parentLink.nextSibling);

            const temp = doc.createElement("div");
            while (parentLink.firstChild) temp.appendChild(parentLink.firstChild);
            while (temp.firstChild) parentLink.appendChild(temp.firstChild);
        });

        return doc.body.outerHTML;
    }

    private hasSingleInlineP(el: Element): boolean {
        return (
            el.children.length === 1 &&
            el.children[0].tagName.toLowerCase() === "p" &&
            this.isInlineOnly(el.children[0] as Element)
        );
    }

    private isInlineContextForAnchor(a: Element): boolean {
        const p = a.parentElement;
        if (!p) return false;
        const tag = p.tagName.toLowerCase();
        if (tag === "p") return true;
        return this.isInlineOnly(p);
    }


    /* ---------------- Assets ---------------- */
    private isImageFile(filename: string): boolean {
        const exts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".avif", ".webp2", ".jxl", ".heic", ".heif"];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return exts.includes(ext);
    }

    private mimeFromPath(path: string): string {
        const ext = path.toLowerCase().substring(path.lastIndexOf(".") + 1);
        switch (ext) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            case "bmp":
                return "image/bmp";
            case "webp":
                return "image/webp";
            case "svg":
                return "image/svg+xml";
            default:
                return "application/octet-stream";
        }
    }

    private processImages(contents: JSZip): Promise<void> {
        const imageFiles: string[] = [];
        contents.forEach((path, file) => {
            if (!file.dir && this.isImageFile(path)) imageFiles.push(path);
        });

        return Promise.all(
            imageFiles.map(async (path) => {
                try {
                    const file = contents.file(path);
                    if (!file) return;
                    const base64 = await file.async("base64");
                    const mime = this.mimeFromPath(path);
                    const dataUrl = `data:${mime};base64,${base64}`;
                    const fileName = path.split("/").pop() || path;
                    const lower = fileName.toLowerCase();

                    // Guardar llave exacta y llave en minúsculas
                    this.imageMap.set(fileName, dataUrl);
                    this.imageMap.set(lower, dataUrl);
                } catch (e) {
                    console.log(`Error procesando imagen ${path}:`, e);
                }
            })
        ).then(() => undefined);
    }

    private async processImagesWithErrors(contents: JSZip): Promise<{  
        errors: ParseError[], warnings: ParseError[]  
        }> {  
        const errors: ParseError[] = [];  
        const warnings: ParseError[] = [];  
        const imageFiles: string[] = [];  
            
        contents.forEach((path, file) => {  
            if (!file.dir && this.isImageFile(path)) {  
            imageFiles.push(path);  
            }  
        });  
            
        if (imageFiles.length === 0) {  
            warnings.push(new ParseError(  
            'No se encontraron imágenes en el ZIP',  
            'IMAGE_ERROR',  
            { supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'] }  
            ));  
        }  
            
        await Promise.all(  
            imageFiles.map(async (path) => {  
            try {  
                const file = contents.file(path);  
                if (!file) {  
                errors.push(new ParseError(  
                    `No se pudo acceder al archivo de imagen: ${path}`,  
                    'IMAGE_ERROR',  
                    { path }  
                ));  
                return;  
                }  
                
                const base64 = await file.async('base64');  
                const mime = this.mimeFromPath(path);  
                
                if (!mime) {  
                errors.push(new ParseError(  
                    `Formato de imagen no soportado: ${path}`,  
                    'IMAGE_ERROR',  
                    { path, extension: path.split('.').pop() }  
                ));  
                return;  
                }  
                
                const dataUrl = `data:${mime};base64,${base64}`;  
                const fileName = path.split('/').pop() || path;  
                const lower = fileName.toLowerCase();  
                
                this.imageMap.set(fileName, dataUrl);  
                this.imageMap.set(lower, dataUrl);  
                
            } catch (e) {  
                const errorMessage = e instanceof Error ? e.message : String(e);  
                errors.push(new ParseError(  
                `Error procesando imagen ${path}: ${errorMessage}`,  
                'IMAGE_ERROR',  
                { path, originalError: e }  
                ));  
            }  
            })  
        );  
            
        return { errors, warnings };  
    }  

    private normalizeTextAlign(val?: string) {
        const v = String(val || "").toLowerCase().trim();
        if (!v || v === "justify") return "left"; 
        if (v === "left" || v === "center" || v === "right") return v;  
        return "left"; // fallback por defecto 
    }

    private async extractAndProcessStyles(contents: JSZip): Promise<string> {
        let all = "";
        const cssFiles: string[] = [];
        contents.forEach((path, file) => {
            if (!file.dir && path.toLowerCase().endsWith(".css")) cssFiles.push(path);
        });

        await Promise.all(
            cssFiles.map(async (p) => {
                try {
                    const f = contents.file(p);
                    if (f) all += await f.async("string");
                } catch (e) {
                    console.log(`Error procesando CSS ${p}:`, e);
                }
            })
        );
        return all;
    }

private async extractAndProcessStylesWithErrors(contents: JSZip): Promise<{  
    errors: ParseError[], warnings: ParseError[]  
}> {  
    const errors: ParseError[] = [];  
    const warnings: ParseError[] = [];  
    let all = '';  
    const cssFiles: string[] = [];  
      
    contents.forEach((path, file) => {  
        if (!file.dir && path.toLowerCase().endsWith('.css')) {  
            cssFiles.push(path);  
        }  
    });  
      
    if (cssFiles.length === 0) {  
        // Cambiar de error a advertencia - muchas plantillas no tienen CSS externo  
        warnings.push(new ParseError(  
            'No se encontraron archivos CSS en el ZIP - se usarán solo estilos inline',  
            'CSS_ERROR',  
            { supportedFormats: ['.css'] },  
            true // recuperable  
        ));  
    } else {  
        // Procesar archivos CSS solo si existen  
        await Promise.all(  
            cssFiles.map(async (p) => {  
                try {  
                    const f = contents.file(p);  
                    if (f) {  
                        const content = await f.async('string');  
                        if (content.trim().length > 0) {  
                            all += content;  
                        }  
                    }  
                } catch (e) { 
                    const errorMessage = e instanceof Error ? e.message : String(e); 
                    errors.push(new ParseError(  
                        `Error procesando CSS ${p}: ${errorMessage}`,  
                        'CSS_ERROR',  
                        { path: p, originalError: e },  
                        true  
                    ));  
                }  
            })  
        );  
    }  
      
    try {  
        this.cssParser = new CSSParser(all);  
    } catch (e) {  
        const errorMessage = e instanceof Error ? e.message : String(e); 
        errors.push(new ParseError(  
            `Error inicializando CSS parser: ${errorMessage}`,  
            'CSS_ERROR',  
            { originalError: e },  
            true  
        ));  
    }  
      
    return { errors, warnings };  
``}

    /* ---------------- HTML → Blocks ---------------- */
    private async parseHtmlToBlocks(htmlContent: string): Promise<TEditorConfiguration> {
        const cleanedHtml = this.cleanHtml(htmlContent);
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanedHtml, "text/html");

        this.blocks = {};
        this.childrenIds = [];
        this.processedElements = new WeakSet();

        const body = doc.body || doc.documentElement;
        if (!body) throw new Error("No se pudo parsear el contenido HTML.");

        this.processChildren(body, this.childrenIds, {});
        return this.buildConfiguration();
    }

    private async parseHtmlToBlocksWithErrors(htmlContent: string): Promise<{  
        configuration?: TEditorConfiguration,  
        errors: ParseError[],  
        warnings: ParseError[]  
        }> {  
        const errors: ParseError[] = [];  
        const warnings: ParseError[] = [];  
        
        try {  
            const cleanedHtml = this.cleanHtml(htmlContent);  
            const parser = new DOMParser();  
            const doc = parser.parseFromString(cleanedHtml, 'text/html');  
            
            const body = doc.body || doc.documentElement;  
            if (!body) {    
                errors.push(new ParseError(    
                    'No se pudo parsear el contenido HTML - no se encontró body',    
                    'HTML_ERROR',    
                    undefined, // no details needed  
                    false    
                ));    
                return { errors, warnings };    
            }  
            
            // Validar estructura HTML  
            const validationErrors = this.validateHtmlStructure(doc);  
            errors.push(...validationErrors);  
            
            this.blocks = {};  
            this.childrenIds = [];  
            this.processedElements = new WeakSet();  
            
            this.processChildren(body, this.childrenIds, {});  
            const configuration = this.buildConfiguration();  
            
            return { configuration, errors, warnings };  
            
        } catch (e) {  
            const errorMessage = e instanceof Error ? e.message : String(e); 
            errors.push(new ParseError(    
                `Error procesando HTML: ${errorMessage}`,    
                'HTML_ERROR',    
                { originalError: e },    
                false    
            ));    
            return { errors, warnings };  
        }  
    }  

    async parseHtmlStringToBlocks(htmlContent: string): Promise<{  
        configuration?: TEditorConfiguration,  
        errors: ParseError[],  
        warnings: ParseError[]  
    }> {  
        return this.parseHtmlToBlocksWithErrors(htmlContent);  
    }

/*     private validateHtmlStructure(doc: Document): ParseError[] {  
        const errors: ParseError[] = [];  
        
        // Detectar elementos no soportados  
        const unsupportedElements = ['form', 'input', 'select', 'textarea', 'video', 'audio'];  
        unsupportedElements.forEach(selector => {  
            const elements = doc.querySelectorAll(selector);  
            if (elements.length > 0) {  
                errors.push({  
                    type: 'HTML_ERROR',  
                    message: `Elementos no soportados encontrados: ${selector} (${elements.length} elementos)`,  
                    details: { selector, count: elements.length },  
                    recoverable: true  
                });  
            }  
        });  
        
        return errors;  
    } */

    private validateHtmlStructure(doc: Document): ParseError[] {  
        const errors: ParseError[] = [];  
            
        // Verificar body  
        if (!doc.body) {  
            errors.push(new ParseError(  
            'El HTML no tiene elemento body',  
            'HTML_ERROR',  
            {},  
            false  
            ));  
        }  
            
        // Detectar elementos no soportados  
        const unsupportedSelectors = ['form', 'input', 'select', 'textarea', 'video', 'audio'];  
        unsupportedSelectors.forEach(selector => {  
            const elements = doc.querySelectorAll(selector);  
            if (elements.length > 0) {  
            errors.push(new ParseError(  
                `Elementos no soportados encontrados: ${selector} (${elements.length} elementos)`,  
                'HTML_ERROR',  
                { selector, count: elements.length },  
                true  
            ));  
            }  
        });  
            
        // Validar estructura de tablas  
        const brokenTables = doc.querySelectorAll('tr:not(:has(td))');  
        if (brokenTables.length > 0) {  
            errors.push(new ParseError(  
            'Se detectaron filas de tabla sin celdas',  
            'HTML_ERROR',  
            { count: brokenTables.length }  
            ));  
        }  
            
        return errors;  
    }

    /* =========================================================
       PARSER PRINCIPAL
       ========================================================= */
    private processElement(
        element: Element,
        inheritedStyles: Record<string, string>
    ): string | null {
        if (this.processedElements.has(element)) return null;
        this.processedElements.add(element);

        const tagName = element.tagName.toLowerCase();
        /* console.log(`Procesando elemento: <${tagName}>`, element);  */
        const currentStyles = this.extractStyles(element, inheritedStyles);

        // 1) Tablas compactas “inline”
        if (tagName === "table" && this.isInlineCompactTable(element)) {
            const id = this.createInlineCompactTableBlock(element, currentStyles);
            if (id) return id;
        }

        // 2) Tablas por filas → ColumnsContainer
        if (tagName === "table" && this.isColumnsTable(element)) {
            return this.createColumnsContainer(element, currentStyles);
        }

        // 3) <a> que envuelve UNA imagen → Image con link
        if (tagName === "a") {
            /* console.log("🔗 Procesando <a>:", element); */
            const imgs = element.querySelectorAll("img");
            const textContent = element.textContent?.trim() || "";
            const hasOnlyImage = element.children.length === 1 && 
                                element.children[0].tagName.toLowerCase() === 'img';
            
            // CASO 1: <a> con UNA sola imagen y sin texto significativo → Image con enlace
            if (imgs.length === 1 && hasOnlyImage) {
                const img = imgs[0];
                // Verificar que no haya texto (excepto espacios/alt de imagen)
                const hasSignificantText = textContent.length > 0 && 
                                        !/^\s*$/.test(textContent.replace(img.alt || "", ""));
                
                if (!hasSignificantText) {
                    console.log("✅ <a> con única imagen (sin texto) - BANNER/ICONO");
                    const blockId = this.createImageBlock(img, element.getAttribute("href") || "#");
                    if (blockId) return blockId;
                }
            }
            
            // CASO 2: <a> con TEXTO (puede tener o no imágenes) → Procesar como texto con enlace
            if (textContent.length > 0) {
                /* console.log("📝 <a> con texto - procesando como contenido inline"); */
                
                // Contexto inline (p/inline-only) → que lo absorba el padre como texto con enlace
                if (this.isInlineContextForAnchor(element)) {
                    console.log("   ↳ En contexto inline, retornando null para procesamiento como texto");
                    return null;
                }
                
                // Heurística para botones: <a> hijo único en td/div con estilo de botón
                const parent = element.parentElement;
                const sole = parent && !element.previousElementSibling && !element.nextElementSibling;
                const parentTag = parent?.tagName.toLowerCase();
                const looksButton =
                    sole &&
                    (parentTag === "td" || parentTag === "div") &&
                    /(background|border|display\s*:\s*inline-block)/i.test(parent?.getAttribute("style") || "");
                
                if (looksButton) {
                    console.log("🔄 <a> luce como botón, creando ButtonBlock");
                    return this.createButtonBlock(element, currentStyles);
                }
                
                // Si no es botón → procesar como contenido inline (el padre lo convertirá en Text)
                console.log("   ↳ No es botón, retornando null para procesamiento como texto");
                return null;
            }
            
            // CASO 3: <a> con MÚLTIPLES imágenes y sin texto → Contenedor de imágenes
            if (imgs.length > 1 && textContent.length === 0) {
                console.log(`🖼️ <a> con ${imgs.length} imágenes (sin texto) - ICONOS`);
                const imageIds: string[] = [];
                
                imgs.forEach(img => {
                    const imgId = this.createImageBlock(img, element.getAttribute("href") || "#");
                    if (imgId) imageIds.push(imgId);
                });
                
                if (imageIds.length > 0) {
                    return this.createContainerBlock(imageIds, {
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "20px",
                        textAlign: "center",
                        padding: { top: 0, right: 0, bottom: 0, left: 0 }
                    });
                }
            }
            
            // Si no se cumplió ninguna condición anterior
            return null;
        }
/*         if (tagName === "a") {
            const img = element.querySelector("img");
            if (img && element.children.length === 1) {
                return this.createImageBlock(img, element.getAttribute("href") || "#");
            }
        } */

        if (this.isFlexContainer(element)) {  
            return this.createFlexContainer(element, currentStyles);  
        }  
    
        if (this.isGridContainer(element)) {  
            return this.createGridContainer(element, currentStyles);  
        }  

        switch (tagName) {
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                return this.createHeadingBlock(element, currentStyles);

            case "video":  
                return this.createVideoBlock(element);  
            case "audio":  
                return this.createAudioBlock(element);  
            case "ul":  
            case "ol":  
                return this.createListBlock(element, currentStyles);  
            case "form":  
                return this.createFormBlock(element, currentStyles);

            case "hr":
                return this.createDividerBlock();

            case "img":
                if (!element.parentElement || element.parentElement.tagName.toLowerCase() !== "a") {
                    return this.createImageBlock(element);
                }
                break;

            case "p":
            case "div":
            case "span":
            case "td": {
                console.log("📋 Procesando TD:", element);
                const hasChildren = element.children.length > 0;
                const textContent = element.textContent?.trim() || "";
                
                // PRIMERO: Verificar casos de texto (A, B, C, D)
                // (A) <p> completamente inline → Text (aunque esto es para case "p", lo mantenemos)
                if (tagName === "p" && this.isInlineOnly(element)) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (B) td con un único <p> inline → Text
                if (this.hasSingleInlineP(element)) {
                    const pEl = element.children[0] as Element;
                    const { text, formats } = this.processInlineContent(pEl, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (C) td completamente inline → Text
                if (this.isInlineOnly(element) && !this.elementContainsOtherBlockTypes(element)) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (D) Texto directo sin otros bloques → Text
                if (textContent.length > 0 && !this.elementContainsOtherBlockTypes(element)) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    return this.createTextBlock(text, formats, currentStyles);
                }
                
                // SEGUNDO: Si NO hay texto o el texto es mínimo, verificar casos especiales de imágenes
                
                // CASO 1: <td> con un solo <a> que contiene una imagen (BANNER)
                if (element.children.length === 1) {
                    const firstChild = element.children[0];
                    if (firstChild.tagName.toLowerCase() === 'a') {
                        const anchor = firstChild as HTMLAnchorElement;
                        const imgs = anchor.querySelectorAll("img");
                        
                        if (imgs.length === 1 && anchor.children.length === 1 && 
                            anchor.children[0].tagName.toLowerCase() === 'img') {
                            
                            console.log("🎯 TD con único enlace que contiene única imagen (BANNER)");
                            const img = imgs[0];
                            const blockId = this.createImageBlock(img, anchor.getAttribute("href") || "#");
                            if (blockId) {
                                console.log("✅ Banner procesado, ID:", blockId);
                                return blockId;
                            }
                        }
                    }
                }
                
                // CASO 2: <td> con múltiples <a> que contienen imágenes (ICONOS)
                const allAnchors = Array.from(element.querySelectorAll("a"));
                const allImages = Array.from(element.querySelectorAll("img"));
                
                if (allAnchors.length > 1 && allImages.length === allAnchors.length) {
                    console.log(`🔗 TD con ${allAnchors.length} enlaces e imágenes (probablemente iconos)`);
                    
                    // Verificar si cada <a> contiene exactamente una <img> y no tiene texto
                    const isValidIconStructure = allAnchors.every(anchor => {
                        const anchorText = anchor.textContent?.trim() || "";
                        const anchorImgs = anchor.querySelectorAll("img");
                        return anchorImgs.length === 1 && 
                            anchor.children.length === 1 && 
                            anchorText.length === 0;
                    });
                    
                    // También verificar que el TD no tenga texto propio
                    const tdHasText = textContent.length > 0;
                    
                    if (isValidIconStructure && !tdHasText) {
                        console.log("✅ Estructura de iconos válida, procesando...");
                        const iconBlocks: string[] = [];
                        
                        allAnchors.forEach((anchor, index) => {
                            const img = anchor.querySelector("img");
                            if (img) {
                                const blockId = this.createImageBlock(img, anchor.getAttribute("href") || "#");
                                if (blockId) {
                                    iconBlocks.push(blockId);
                                    console.log(`   [${index}] Icono procesado: ${blockId}`);
                                }
                            }
                        });
                        
                        if (iconBlocks.length > 0) {
                            return this.createContainerBlock(iconBlocks, {
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "20px",
                                textAlign: "center",
                                padding: { top: 0, right: 0, bottom: 0, left: 0 }
                            });
                        }
                    }
                }
                
                // TERCERO: Casos especiales que no encajan en los anteriores
                
                // (E) TD con "botón" (fondo + <a><img/>)
                if (this.isButtonLikeCell(element) && element.querySelector("a img")) {
                    const img = element.querySelector("a img") as HTMLImageElement;
                    if (img) {
                        const imgId = this.createImageBlock(
                            img,
                            (element.querySelector("a") as HTMLAnchorElement)?.href || ""
                        );
                        if (imgId) {
                            return this.createContainerBlock([imgId], {
                                textAlign: "left",
                                padding: { top: 0, right: 0, bottom: 0, left: 0 }
                            });
                        }
                    }
                        }

                        // (F) Contenedor genérico (último recurso)
                        if (hasChildren) {
                            const childrenIds: string[] = [];
                            this.processChildren(element, childrenIds, currentStyles);
                            if (childrenIds.length > 0) return this.createContainerBlock(childrenIds, currentStyles);
                        }
                        break;
                    }
        }

        // 4) <a> sin imagen: solo convertir a Button si DE VERDAD luce como botón
        if (tagName === "a") {
            // Contexto inline (p/inline-only) → que lo absorba el padre como texto con link
            if (this.isInlineContextForAnchor(element)) {
                return null;
            }

            // Heurística “button-like”: <a> hijo único en td/div con estilo de botón
            const parent = element.parentElement;
            const sole = parent && !element.previousElementSibling && !element.nextElementSibling;
            const parentTag = parent?.tagName.toLowerCase();
            const looksButton =
                sole &&
                (parentTag === "td" || parentTag === "div") &&
                /(background|border|display\s*:\s*inline-block)/i.test(parent?.getAttribute("style") || "");

            if (looksButton) {
                return this.createButtonBlock(element, currentStyles);
            }

            // Si no parece botón → inline (el padre lo convertirá en Text)
            return null;
        }

        // 5) Fallback: procesar hijos
        const childrenIds: string[] = [];
        this.processChildren(element, childrenIds, currentStyles);
        if (childrenIds.length > 0) return this.createContainerBlock(childrenIds, currentStyles);

        return null;
    }


    /* =========================================================
       Inline text processor  (NEGRITAS + SALTOS DE LÍNEA)
       ========================================================= */
    /* =========================================================
   Inline text processor (NEGRITAS + SALTOS DE LÍNEA)
   ========================================================= */
    private processInlineContent(
        element: Element,
        inheritedStyles: Record<string, any>
    ): { text: string; formats: any[] } {
        let text = "";
        const formats: any[] = [];
        let pos = 0;

        const append = (t: string) => {
            if (!t) return;
            text += t;
            pos += t.length;
        };

        const inlineTags = new Set(["strong", "b", "em", "i", "u", "a", "span", "small", "sup", "sub", "br"]);

        Array.from(element.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                append((node.textContent || "").replace(/\s+/g, " "));
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();

                if (!inlineTags.has(tag)) return;

                if (tag === "br") {
                    append("\n");
                    return;
                }

                // Procesar enlaces dentro de elementos strong/b  
                if ((tag === "strong" || tag === "b") && el.querySelector("a")) {
                    const link = el.querySelector("a");
                    if (link) {
                        const href = link.getAttribute("href") || "";
                        const linkText = link.textContent?.trim() || "";
                        if (href && linkText) {
                            append(`**[${linkText}](${href})**`);
                            return;
                        }
                    }
                }

                // Procesar enlaces simples  
                if (tag === "a") {
                    const href = el.getAttribute("href") || "";
                    const linkText = el.textContent?.trim() || "";
                    if (href && linkText) {
                        append(`[${linkText}](${href})`);
                        return;
                    }
                }

                const childStyles = this.extractStyles(el, inheritedStyles);
                const childRes = this.processInlineContent(el, childStyles);

                if (childRes.text.length) {
                    const start = pos;
                    append(childRes.text);

                    const fmt: any = { start, end: start + childRes.text.length };

                    // Bold detection  
                    const fw = String(childStyles.fontWeight ?? "").toLowerCase();
                    const isBoldTag = tag === "strong" || tag === "b";
                    const isBoldStyle = fw === "bold" || (!isNaN(parseInt(fw)) && parseInt(fw) >= 600);
                    if (isBoldTag || isBoldStyle) fmt.bold = true;

                    // ✅ AGREGAR: Italic detection  
                    const fs = String(childStyles.fontStyle ?? "").toLowerCase();  
                    const isItalicTag = tag === "em" || tag === "i";  
                    const isItalicStyle = fs === "italic";  
                    if (isItalicTag || isItalicStyle) fmt.italic = true;

                    formats.push(fmt);
                }
            }
        });

        text = text.replace(/[ \t]+\n/g, "\n").trimEnd();

        const validFormats = formats.filter(fmt => {  
            // Clampear rangos a los límites del texto  
            if (fmt.start < 0) fmt.start = 0;  
            if (fmt.end > text.length) fmt.end = text.length;  
            
            // Eliminar formatos inválidos donde start >= end  
            return fmt.start < fmt.end;  
        }); 
        
        return { text: text.trim(), formats: validFormats };
    }


    /* =========================================================
       Heurísticas de detección
       ========================================================= */
    private isInlineOnly(el: Element): boolean {
        const inlineTags = new Set(["strong", "b", "em", "i", "u", "a", "span", "small", "sup", "sub", "br"]);
        return Array.from(el.childNodes).every((n) => {
            if (n.nodeType === Node.TEXT_NODE) return true;
            if (n.nodeType === Node.ELEMENT_NODE) {
                const tag = (n as Element).tagName.toLowerCase();
                return inlineTags.has(tag);
            }
            return false;
        });
    }

    private elementContainsOtherBlockTypes(element: Element): boolean {
        const blockTags = ["table", "img", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol"];
        return Array.from(element.children).some((c) => blockTags.includes(c.tagName.toLowerCase()));
    }

    private processChildren(parentElement: Element, targetArray: string[], inheritedStyles: Record<string, string>): void {
        console.log('Procesando hijos de:', parentElement.tagName, parentElement.children.length);  
        Array.from(parentElement.children).forEach((child) => {
            console.log('  - Procesando:', child.tagName, child); 
            const id = this.processElement(child as Element, inheritedStyles);
            if (id) targetArray.push(id);
        });
    }

    /** Detecta tablas por filas aunque la primera sea 1×1 (barras de color, etc.) */
    private isColumnsTable(element: Element): boolean {
        const rows = Array.from(element.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        if (rows.length === 0) return false;

        const hasMultiCellRow = rows.some((r) => r.querySelectorAll(":scope > td").length > 1);

        const hasInlineBlockLayout = rows.some((r) => {  
            const tds = Array.from(r.querySelectorAll(":scope > td"));  
            return tds.length >= 2 && tds.some(td => {  
                const styles = this.extractStyles(td, {});  
                return styles.display === 'inline-block';  
            });  
        }); 

        const hasBarRow = rows.some((r) => {
            const tds = Array.from(r.querySelectorAll(":scope > td"));
            if (tds.length !== 1) return false;
            const td = tds[0];
            const textLen = this.collectText(td).length;
            const st = this.extractStyles(td, {});
            const bg = (st?.backgroundColor || "").toString();
            return textLen === 0 && !!bg; // barra de color
        });

        return hasMultiCellRow || hasBarRow || hasInlineBlockLayout || rows.length > 1;
    }

    /** Tabla compacta “inline” (iconos/acciones) — genérica */
    private isInlineCompactTable(table: Element): boolean {
        if (table.tagName.toLowerCase() !== "table") return false;

        const rows = Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        if (rows.length === 0 || rows.length > 2) return false;

        if (table.querySelector("table, h1, h2, h3, h4, h5, h6, ul, ol, section, article")) return false;

        const totalTextLen = this.collectText(table).length;
        if (totalTextLen > 200) return false;

        let validRows = 0;
        for (const row of rows) {
            const tds = Array.from(row.querySelectorAll(":scope > td"));
            if (tds.length < 2 || tds.length > 6) continue;

            const simple = tds.filter((td) => this.isSimpleInlineCell(td)).length;
            if (simple >= Math.max(2, Math.floor(tds.length * 0.8))) validRows++;
        }

        return validRows === 1;
    }

    private isSimpleInlineCell(td: Element): boolean {
        if (td.querySelector("table, h1, h2, h3, h4, h5, h6, ul, ol, section, article")) return false;
        if (td.querySelector("div div")) return false;

        const textLen = this.collectText(td).length;
        if (textLen > 80) return false;

        const hasImg = !!td.querySelector("img");
        const hasLink = !!td.querySelector("a");
        const hasShortText = textLen > 0 && textLen <= 80;

        return hasImg || hasLink || hasShortText;
    }

    private isButtonLikeCell(td: Element): boolean {
        const hasAnchorImg = !!td.querySelector("a img");
        const st = this.extractStyles(td, {});
        const bg = (st?.backgroundColor || "").toString().toLowerCase();
        const textLen = this.collectText(td).length;
        return hasAnchorImg && !!bg && textLen === 0;
    }

    private collectText(root: Element): string {
        return Array.from(root.childNodes)
            .map((n) =>
                n.nodeType === Node.TEXT_NODE
                    ? (n.textContent || "").trim()
                    : n.nodeType === Node.ELEMENT_NODE
                        ? this.collectText(n as Element)
                        : ""
            )
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    private isFlexContainer(element: Element): boolean{
        const styles = this.extractStyles(element, {});
        return styles.display === "flex" || styles.display === "inline-flex";
    }

    private isGridContainer(element: Element): boolean{
        const styles = this.extractStyles(element, {});
        return styles.display === "grid" || styles.display === "inline-grid";
    }

    private isVideoFile(filename: string): boolean{
        const exts = [".mp4", ".webm", ".ogg", ".avi", ".mov"];  
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return exts.includes(ext);
    }

    private isAudioFile(filename: string): boolean{
        const exts = [".mp3", ".wav", ".ogg", ".aac"];  
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return exts.includes(ext);
    }

    private async processVideos(contents: JSZip): Promise<void> {  
        const videoFiles: string[] = [];  
        contents.forEach((path, file) => {  
            if (!file.dir && this.isVideoFile(path)) videoFiles.push(path);  
        });  
    
        await Promise.all(  
            videoFiles.map(async (path) => {  
                try {  
                    const file = contents.file(path);  
                    if (!file) return;  
                    const base64 = await file.async('base64');  
                    const mime = `video/${path.split('.').pop()}`;  
                    const dataUrl = `data:${mime};base64,${base64}`;  
                    this.mediaMap.set(path, dataUrl);  
                } catch (e) {  
                    console.log(`Error procesando video ${path}:`, e);  
                }  
            })  
        );  
    }  
    
    private async processAudio(contents: JSZip): Promise<void> {  
        const audioFiles: string[] = [];  
        contents.forEach((path, file) => {  
            if (!file.dir && this.isAudioFile(path)) audioFiles.push(path);  
        });  
    
        await Promise.all(  
            audioFiles.map(async (path) => {  
                try {  
                    const file = contents.file(path);  
                    if (!file) return;  
                    const base64 = await file.async('base64');  
                    const mime = `audio/${path.split('.').pop()}`;  
                    const dataUrl = `data:${mime};base64,${base64}`;  
                    this.mediaMap.set(path, dataUrl);  
                } catch (e) {  
                    console.log(`Error procesando audio ${path}:`, e);  
                }  
            })  
        );  
    }

    /* =========================================================
       Builders
       ========================================================= */
    private createInlineCompactTableBlock(table: Element, inherited: Record<string, any>): string | null {
        const rows = Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        const stackIds: string[] = [];
        const tableStyle = this.extractStyles(table, inherited);

        for (const row of rows) {
            const tds = Array.from(row.querySelectorAll(":scope > td"));
            if (!tds.length) continue;

            // Fila de iconos
            const usefulImgs = tds.filter((td) => {
                const img = td.querySelector("img");
                if (!img) return false;
                const base = ((img.getAttribute("src") || "").split("/").pop() || "").toLowerCase();
                return !/^blanco\.(png|gif|jpg|jpeg)$/.test(base);
            });
            const isIconsRow = tds.length >= 2 && usefulImgs.length / tds.length >= 0.5;

            if (isIconsRow) {
                const columns = tds
                    .map((td) => {
                        const link = td.querySelector("a");
                        const img = td.querySelector("img") as HTMLImageElement | null;

                        if (link && img) {
                            const id = this.createImageBlock(img, link.getAttribute("href") || "");
                            return id ? { childrenIds: [id] } : null;
                        }
                        if (img) {
                            const id = this.createImageBlock(img);
                            return id ? { childrenIds: [id] } : null;
                        }
                        const id = this.processElement(td, inherited);
                        return id ? { childrenIds: [id] } : null;
                    })
                    .filter(Boolean) as Array<{ childrenIds: string[] }>;

                if (!columns.length) continue;

                const ccId = uuidv4();
                const rowStyle = this.extractStyles(row, inherited);
                this.blocks[ccId] = {
                    type: "ColumnsContainer",
                    data: {
                        style: {
                            padding: { top: 0, right: 0, bottom: 0, left: 0 },
                            ...(rowStyle.backgroundColor ? { backgroundColor: rowStyle.backgroundColor } : {})
                        },
                        props: { columnsCount: columns.length, columns }
                    }
                };
                stackIds.push(ccId);
            } else {
                // Fila genérica
                const produced: string[] = [];
                tds.forEach((td) => {
                    const id = this.processElement(td, inherited);
                    if (id) produced.push(id);
                });

                if (!produced.length) {
                    const color = this.pickFirstBgColor(tds);
                    if (color) {
                        const height = this.pickRowHeight(tds);
                        stackIds.push(this.createBarBlock(color, height));
                    }
                    continue;
                }

                if (produced.length === 1) {
                    stackIds.push(produced[0]);
                } else {
                    const cols = produced.map((id) => ({ childrenIds: [id] }));
                    const rowStyle = this.extractStyles(row, inherited);
                    const ccId = uuidv4();
                    this.blocks[ccId] = {
                        type: "ColumnsContainer",
                        data: {
                            style: {
                                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                                ...(rowStyle.backgroundColor ? { backgroundColor: rowStyle.backgroundColor } : {})
                            },
                            props: { columnsCount: cols.length, columns: cols }
                        }
                    };
                    stackIds.push(ccId);
                }
            }
        }

        if (!stackIds.length) return null;
        return this.createContainerBlock(stackIds, {
            ...tableStyle,
            padding: { top: 0, right: 0, bottom: 0, left: 0 }
        });
    }

    /** Tablas por filas (también maneja filas 1x1 para barras de color) */
    private createColumnsContainer(tableElement: Element, styles: any): string | null {
        const rows = Array.from(tableElement.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        const rowBlocks: string[] = [];

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll(":scope > td"));
            if (cells.length === 0) continue;

            const produced: Array<{ id: string; cell: Element }> = [];
            for (const cell of cells) {
                const id = this.processElement(cell, styles);
                if (id) produced.push({ id, cell });
            }

            if (!produced.length) {
                // No se produjo nada → ¿fila de color?
                const color = this.pickFirstBgColor(cells);
                if (color) {
                    const height = this.pickRowHeight(cells) || this.pickRowHeight([row as any]);
                    rowBlocks.push(this.createBarBlock(color, height));
                }
                continue;
            }

            if (produced.length === 1) {
                const only = produced[0];
                // Caso “botón en TD con fondo” → envolver para alinear a la izquierda SIN fondo ancho
                if (this.isButtonLikeCell(only.cell)) {
                    rowBlocks.push(
                        this.createContainerBlock([only.id], {
                            textAlign: "left",
                            padding: { top: 0, right: 0, bottom: 0, left: 0 }
                        })!
                    );
                } else {
                    rowBlocks.push(only.id);
                }
                continue;
            }

            // Varias celdas con contenido → ColumnsContainer
            const cols = produced.map(({ id }) => ({ childrenIds: [id] }));
            const rowStyle = this.extractStyles(row, styles);
            const ccId = uuidv4();
            this.blocks[ccId] = {
                type: "ColumnsContainer",
                data: {
                    style: {
                        ...styles,
                        padding: { top: 0, bottom: 0, left: 0, right: 0 },
                        ...(rowStyle.backgroundColor ? { backgroundColor: rowStyle.backgroundColor } : {})
                    },
                    props: { columnsCount: cols.length, columns: cols }
                }
            };
            rowBlocks.push(ccId);
        }

        if (rowBlocks.length === 0) return null;
        if (rowBlocks.length === 1) return rowBlocks[0];
        return this.createContainerBlock(rowBlocks, styles);
    }

    private pickFirstBgColor(cells: Element[]): string | null {
        for (const c of cells) {
            const st = this.extractStyles(c, {});
            const col = (st?.backgroundColor || "").toString();
            if (col && col.toLowerCase() !== "#ffffff" && col.toLowerCase() !== "white") return col;
        }
        return null;
    }

    private pickRowHeight(cells: Element[]): number {
        // tomar el primer height numérico que encontremos
        for (const c of cells) {
            const h = c.getAttribute("height");
            if (h && /^\d+$/.test(h)) return parseInt(h, 10);
            const style = (c as HTMLElement).getAttribute("style") || "";
            const m = style.match(/height\s*:\s*(\d+)px/i);
            if (m) return parseInt(m[1], 10);
        }
        return 0;
    }

    private createHeadingBlock(element: Element, styles: any): string | null {
        const text = element.textContent?.trim() || "";
        if (!text) return null;
        const id = uuidv4();
        const level = element.tagName.toLowerCase() as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        this.blocks[id] = {
            type: "Heading",
            data: {
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },
                props: { level, text }
            }
        };
        return id;
    }

    private createTextBlock(text: string, formats: any[], styles: any): string | null {
        if (!text) return null;
        const id = uuidv4();

        // Detectar si el texto contiene enlaces markdown  
        const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(text);

        this.blocks[id] = {
            type: "Text",
            data: {
                style: {
                    ...styles,
                    textAlign: this.normalizeTextAlign(styles?.textAlign),
                    padding: { top: 16, bottom: 16, left: 24, right: 24 }
                },
                props: {
                    text,
                    formats,
                    markdown: hasMarkdownLinks // Activar markdown si hay enlaces  
                }
            }
        };
        return id;
    }

    private createImageBlock(element: Element, linkHref?: string): string | null {
        const src = element.getAttribute("src") || "";
        if (!src || src.startsWith("data:")) return null;

        /* const base = (src.split("/").pop() || src).toLowerCase();
        if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null; */


        let dataUrl: string | undefined;
        let fileName: string;

        // CASO 1: URL absoluta (https://services.celcom.cl/...)
        if (src.startsWith("http")){
            try {
                const url = new URL(src);
                fileName = url.pathname.split("/").pop() || "";
            } catch (error) {
                fileName = src.split("/").pop() || ""; 
            }
            // Extraer nombre de archivo limpio
            const baseName = fileName.toLowerCase().split('?')[0]; // Quitar query strings
            
            // Buscar en imageMap de múltiples formas
            dataUrl = this.imageMap.get(baseName);  

            if (!dataUrl) {
                // Intentar con minúsculas 
                console.log("⚠️ Imagen no encontrada en imageMap, usando URL original");
                dataUrl = src;
            };
        }
        // CASO 2: Ruta local (archivo en ZIP)
        else {
            fileName = src.split("/").pop() || src;
            const baseName = fileName.toLowerCase().split('?')[0];

            // Buscar en imageMap de múltiples formas
            dataUrl = this.imageMap.get(baseName);  

            // 3. Buscar coincidencia parcial (útil para nombres con versiones o hashes)
            if (!dataUrl) {
                const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "");
                const matchingKey = Array.from(this.imageMap.keys()).find(key => 
                    key.toLowerCase().includes(nameWithoutExt)
                );
                if (matchingKey) {
                    dataUrl = this.imageMap.get(matchingKey);
                }
            } 
        }

        if (!dataUrl) {  
            console.log("❌ No se pudo obtener dataUrl para:", src); 
            console.log("📊 imageMap keys:", Array.from(this.imageMap.keys()));  
            return null;  
        }  

        const id = uuidv4();
        const styles = this.extractStyles(element, {});
        this.blocks[id] = {
            type: "Image",
            data: {
                style: { 
                    ...styles, 
                    padding: { top: 16, bottom: 16, left: 24, right: 24 } },
                props: {
                    url: dataUrl,
                    alt: element.getAttribute("alt") || "",
                    linkHref: linkHref || undefined,
                    width: element.getAttribute("width") ? 
                        parseInt(element.getAttribute("width")!) : undefined,
                    height: element.getAttribute("height") ? 
                        parseInt(element.getAttribute("height")!) : undefined,
                    contentAlignment: "middle"
                }
            }
        };
        return id;
    }

    private createButtonBlock(element: Element, styles: any): string {
        const id = uuidv4();
        const text = element.textContent?.trim() || "Button";
        const href = element.getAttribute("href") || "#";
        this.blocks[id] = {
            type: "Button",
            data: {
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },
                props: { text, url: href }
            }
        };
        return id;
    }

    private createBarBlock(color: string, height?: number): string {
        // Barra de color como contenedor con padding equivalente al alto
        const id = uuidv4();
        const pad = Math.max(0, Math.floor((height || 20) / 2));
        this.blocks[id] = {
            type: "Container",
            data: {
                style: {
                    backgroundColor: this.normalizeColor(color),
                    padding: { top: pad, right: 0, bottom: pad, left: 0 }
                },
                props: { childrenIds: [] }
            }
        };
        return id;
    }

    private createContainerBlock(childrenIds: string[], styles?: any): string | null {
        if (!childrenIds.length) return null;
        const id = uuidv4();
        const safePadding = styles?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
        const styleToApply: any = { padding: safePadding };

        if (styles?.backgroundColor) styleToApply.backgroundColor = styles.backgroundColor;
        if (styles?.margin) styleToApply.margin = styles.margin;
        if (styles?.textAlign) styleToApply.textAlign = styles.textAlign;

        this.blocks[id] = {
            type: "Container",
            data: {
                style: styleToApply,
                props: { childrenIds }
            }
        };
        return id;
    }

    private createDividerBlock(): string {
        const id = uuidv4();
        this.blocks[id] = {
            type: "Divider",
            data: { style: { padding: { top: 16, bottom: 16, left: 0, right: 0 } }, props: { lineColor: "#CCCCCC" } }
        };
        return id;
    }

    
    private createFlexContainer(element: Element, styles: any): string {  
        const childrenIds: string[] = [];  
        this.processChildren(element, childrenIds, styles);  
        
        const id = uuidv4();  
        this.blocks[id] = {  
            type: "Container", // o nuevo tipo "FlexContainer"  
            data: {  
                style: {  
                    ...styles,  
                    display: 'flex',  
                    flexDirection: styles.flexDirection || 'row',  
                    justifyContent: styles.justifyContent || 'flex-start',  
                    alignItems: styles.alignItems || 'stretch',  
                    padding: { top: 16, bottom: 16, left: 24, right: 24 }  
                },  
                childrenIds  
            }  
        };  
        return id;  
    }

    private createVideoBlock(element: Element): string | null {  
        const src = element.getAttribute("src") || "";  
        if (!src) return null;  
    
        const dataUrl = this.mediaMap.get(src) || src;  
        const id = uuidv4();  
        const styles = this.extractStyles(element, {});  
        
        this.blocks[id] = {  
            type: "Video", // Nuevo tipo de bloque  
            data: {  
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },  
                props: {  
                    url: dataUrl,  
                    poster: element.getAttribute("poster") || "",  
                    controls: element.hasAttribute("controls"),  
                    autoplay: element.hasAttribute("autoplay"),  
                    width: element.getAttribute("width") ? parseInt(element.getAttribute("width")!) : undefined,  
                    height: element.getAttribute("height") ? parseInt(element.getAttribute("height")!) : undefined  
                }  
            }  
        };  
        return id;  
    }

    private createListBlock(element: Element, styles: any): string | null {  
        const items: string[] = [];  
        const isOrdered = element.tagName.toLowerCase() === 'ol';  
        
        Array.from(element.querySelectorAll(':scope > li')).forEach(li => {  
            const { text, formats } = this.processInlineContent(li, styles);  
            if (text.trim()) {  
                const itemId = uuidv4();  
                this.blocks[itemId] = {  
                    type: "ListItem",  
                    data: {  
                        props: { text, formats, ordered: isOrdered },  
                        style: { ...styles }  
                    }  
                };  
                items.push(itemId);  
            }  
        });  
        
        if (items.length === 0) return null;  
        
        const id = uuidv4();  
        this.blocks[id] = {  
            type: "List",  
            data: {  
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },  
                childrenIds: items  
            }  
        };  
        return id;  
    }  
    
    private createFormBlock(element: Element, styles: any): string | null {  
        const formItems: string[] = [];  
        
        Array.from(element.querySelectorAll('input, select, textarea, button')).forEach(field => {  
            const fieldId = this.createFormField(field, styles);  
            if (fieldId) formItems.push(fieldId);  
        });  
        
        if (formItems.length === 0) return null;  
        
        const id = uuidv4();  
        this.blocks[id] = {  
            type: "Form",  
            data: {  
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },  
                props: {  
                    action: element.getAttribute("action") || "",  
                    method: element.getAttribute("method") || "POST"  
                },  
                childrenIds: formItems  
            }  
        };  
        return id;  
    }

    private createGridContainer(element: Element, styles: any): string | null {  
        const childrenIds: string[] = [];  
        this.processChildren(element, childrenIds, styles);  
        
        if (childrenIds.length === 0) return null;  
        
        const id = uuidv4();  
        this.blocks[id] = {  
            type: "Container", // o nuevo tipo "GridContainer"  
            data: {  
                style: {  
                    ...styles,  
                    display: 'grid',  
                    gridTemplateColumns: styles.gridTemplateColumns || 'repeat(auto-fit, minmax(200px, 1fr))',  
                    gap: styles.gap || '16px',  
                    padding: { top: 16, bottom: 16, left: 24, right: 24 }  
                },  
                childrenIds  
            }  
        };  
        return id;  
    }  
    
    private createAudioBlock(element: Element): string | null {  
        const src = element.getAttribute("src") || "";  
        if (!src) return null;  
    
        const dataUrl = this.mediaMap.get(src) || src;  
        const id = uuidv4();  
        const styles = this.extractStyles(element, {});  
        
        this.blocks[id] = {  
            type: "Audio", // Nuevo tipo de bloque  
            data: {  
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },  
                props: {  
                    url: dataUrl,  
                    controls: element.hasAttribute("controls"),  
                    autoplay: element.hasAttribute("autoplay"),  
                    loop: element.hasAttribute("loop")  
                }  
            }  
        };  
        return id;  
    }  
    
    private createFormField(element: Element, styles: any): string | null {  
        const id = uuidv4();  
        const fieldType = element.tagName.toLowerCase();  
        
        this.blocks[id] = {  
            type: "FormField", // Nuevo tipo de bloque  
            data: {  
                style: { ...styles, padding: { top: 8, bottom: 8, left: 16, right: 16 } },  
                props: {  
                    type: fieldType,  
                    name: element.getAttribute("name") || "",  
                    placeholder: element.getAttribute("placeholder") || "",  
                    required: element.hasAttribute("required"),  
                    value: element.getAttribute("value") || ""  
                }  
            }  
        };  
        return id;  
    }

    /* =========================================================
       Estilos / helpers
       ========================================================= */
    private getDirectTextContent(element: Element): string {
        return Array.from(element.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent?.trim() || "")
            .join(" ")
            .replace(/\s+/g, " ");
    }

    private extractStyles(element: Element, inheritedStyles: Record<string, any> = {}): any {  
        const styles: any = { ...inheritedStyles };  
        const htmlElement = element as HTMLElement;  
    
        // 1. Obtener estilos de CSS externo  
        if (this.cssParser) {  
            const external = this.cssParser.getStylesForElement(element);  
            Object.assign(styles, external);  
        }  
    
        // 2. Obtener estilos inline  
        const inline = htmlElement.getAttribute("style");  
        if (inline) Object.assign(styles, this.parseInlineStyles(inline));  
    
        // 3. Obtener atributos HTML legacy  
        const bgAttr = htmlElement.getAttribute("bgcolor");  
        if (bgAttr) styles["background-color"] = bgAttr;  
        const alignAttr = htmlElement.getAttribute("align");  
        if (alignAttr) styles["text-align"] = alignAttr;  
        const valignAttr = htmlElement.getAttribute("valign");  
        if (valignAttr) styles["vertical-align"] = valignAttr;  
        const widthAttr = htmlElement.getAttribute("width");  
        if (widthAttr) styles["width"] = widthAttr;  
        const heightAttr = htmlElement.getAttribute("height");  
        if (heightAttr) styles["height"] = heightAttr;  
    
        // 4. Procesar y normalizar todas las propiedades  
        const final: any = {};  
        const tag = element.tagName.toLowerCase();  
        
    
        for (const prop in styles) {  
            const value = styles[prop];  
            if (typeof value === "object" && value !== null) {  
                final[prop] = value;  
                continue;  
            }  
    
            switch (prop.toLowerCase()) {  
            // Colores  
            case "color":  
                final.color = this.normalizeColor(value);  
                break;  
            case "background-color":  
            case "background":  
                final.backgroundColor = this.normalizeColor(value);  
                break;  
            case "border-color":  
                final.borderColor = this.normalizeColor(value);  
                break;  
  
            // Tipografía  
            case "font-size":  
                final.fontSize = this.parseDimension(value);  
                break;  
            case "font-weight":  
                final.fontWeight = this.normalizeFontWeight(value);  
                break;  
            case "font-family":  
                final.fontFamily = this.normalizeFontFamily(value);  
                break;  
            case "font-style":  
                final.fontStyle = this.normalizeFontStyle(value);  
                break;  
            case "line-height":  
                final.lineHeight = this.parseLineHeight(value);  
                break;  
            case "letter-spacing":  
                final.letterSpacing = this.parseLetterSpacing(value);  
                break;  
            case "text-decoration":  
                final.textDecoration = this.normalizeTextDecoration(value);  
                break;  
            case "text-transform":  
                final.textTransform = this.normalizeTextTransform(value);  
                break;  
  
            // Layout y Display  
            case "display":  
                final.display = this.normalizeDisplay(value);  
                break;  
            case "position":  
                final.position = this.normalizePosition(value);  
                break;  
            case "float":  
                final.float = this.normalizeFloat(value);  
                break;  
            case "clear":  
                final.clear = this.normalizeClear(value);  
                break;  
            case "overflow":  
                final.overflow = this.normalizeOverflow(value);  
                break;  
            case "z-index":  
                final.zIndex = this.parseZIndex(value);  
                break;  
  
            // Dimensiones  
            case "width":  
            case "height":  
            case "min-width":  
            case "min-height":  
            case "max-width":  
            case "max-height":  
                final[prop] = this.parseDimension(value);  
                break;  
  
            // Espaciado  
            case "padding":  
                final.padding = this.parseSpacing(value);  
                break;  
            case "margin":  
                final.margin = this.parseSpacing(value);  
                break;  
  
            // Bordes  
            case "border":  
                final.border = this.parseBorder(value);  
                break;  
            case "border-radius":  
                final.borderRadius = this.parseBorderRadius(value);  
                break;  
            case "border-width":  
            case "border-style":  
            case "border-color":  
                final[prop] = value; // Mantener como está por ahora  
                break;  
  
            // Fondos avanzados  
            case "background-image":  
                if (value.includes("gradient")) {  
                    final.backgroundImage = this.parseGradient(value);  
                } else {  
                    final.backgroundImage = value;  
                }  
                break;  
  
            // Sombras y efectos  
            case "box-shadow":  
                final.boxShadow = this.parseBoxShadow(value);  
                break;  
            case "text-shadow":  
                final.textShadow = value; // Parseo básico por ahora  
                break;  
  
            // Transformaciones y animaciones  
            case "transform":  
                final.transform = this.parseTransform(value);  
                break;  
            case "animation":  
                final.animation = this.parseAnimation(value);  
                break;  
  
            // Flexbox  
            case "flex-direction":  
            case "flex-wrap":  
            case "justify-content":  
            case "align-items":  
            case "align-content":  
            case "flex-grow":  
            case "flex-shrink":  
            case "flex-basis":  
                final[prop] = value;  
                break;  
  
            // Grid  
            case "grid-template-columns":  
            case "grid-template-rows":  
            case "grid-gap":  
            case "grid-column-gap":  
            case "grid-row-gap":  
                final[prop] = value;  
                break;  
  
            // Alineación  
            case "text-align":  
                final.textAlign = this.normalizeTextAlign(value);  
                break;  
            case "vertical-align":  
                final.verticalAlign = value;  
                break;  
  
            // Visibilidad  
            case "visibility":  
                final.visibility = value === "hidden" ? "hidden" : "visible";  
                break;  
            case "opacity":  
                final.opacity = parseFloat(value) || 1;  
                break;  
        }  
    }  
    
        // 5. Aplicar estilos por tag HTML  
        if (tag === "strong" || tag === "b") final.fontWeight = "bold";  
        if (tag === "em" || tag === "i") final.fontStyle = "italic";  
        if (tag === "u") final.textDecoration = "underline";  
        if (tag === "a") final.textDecoration = "underline";  
        if (tag === "strike" || tag === "s" || tag === "del") final.textDecoration = "line-through";  
    
        const supportedProperties = [  
            'color', 'backgroundColor', 'fontFamily', 'fontSize',   
            'fontWeight', 'textAlign', 'padding'  
        ];  
        
        const filteredFinal: any = {};  
        supportedProperties.forEach(prop => {  
            if (final[prop] !== undefined) {  
                filteredFinal[prop] = final[prop];  
            }  
        }); 

        return filteredFinal;  
    }
/*     private extractStyles(element: Element, inheritedStyles: Record<string, any> = {}): any {
        const styles: any = { ...inheritedStyles };
        const htmlElement = element as HTMLElement;

        if (this.cssParser) {
            const external = this.cssParser.getStylesForElement(element);
            Object.assign(styles, external);
        }

        const inline = htmlElement.getAttribute("style");
        if (inline) Object.assign(styles, this.parseInlineStyles(inline));

        const bgAttr = htmlElement.getAttribute("bgcolor");
        if (bgAttr) styles["background-color"] = bgAttr;
        const alignAttr = htmlElement.getAttribute("align");
        if (alignAttr) styles["text-align"] = alignAttr;

        const final: any = {};
        const tag = element.tagName.toLowerCase();

        for (const prop in styles) {
            const value = styles[prop];
            if (typeof value === "object" && value !== null) {
                final[prop] = value;
                continue;
            }

            switch (prop) {
                case "color":
                    final.color = this.normalizeColor(value);
                    break;
                case "background-color":
                    final.backgroundColor = this.normalizeColor(value);
                    break;
                case "font-size":
                    final.fontSize = this.parseFontSize(value);
                    break;
                case "font-weight":
                    final.fontWeight = value === "bold" || parseInt(value) >= 600 ? "bold" : value;
                    break;
                case "font-family":
                    final.fontFamily = this.normalizeFontFamily(value);
                    break;
                case "padding":
                    final.padding = this.parsePadding(value);
                    break;
                case "text-align":
                    final.textAlign = this.normalizeTextAlign(value);
                    break;
            }
        }

        if (tag === "strong" || tag === "b") final.fontWeight = "bold";
        if (tag === "em" || tag === "i") final.fontStyle = "italic";
        if (tag === "a") final.textDecoration = "underline";

        return final;
    } */

    private parseInlineStyles(inlineStyle: string): Record<string, string> {
        const s: Record<string, string> = {};
        const decl = inlineStyle.split(";").map((v) => v.trim()).filter(Boolean);
        decl.forEach((d) => {
            const [prop, val] = d.split(":").map((v) => v.trim());
            if (prop && val) s[prop.toLowerCase()] = val;
        });
        return s;
    }

    private hslToHex(hsl: string): string {  
        // Parse HSL values  
        const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);  
        if (!match) return hsl;  
        
        const [_, h, s, l] = match.map(Number);  
        
        // Convert HSL to RGB  
        const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;  
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));  
        const m = l / 100 - c / 2;  
        
        let r = 0, g = 0, b = 0;  
        
        if (h >= 0 && h < 60) {  
            r = c; g = x; b = 0;  
        } else if (h >= 60 && h < 120) {  
            r = x; g = c; b = 0;  
        } else if (h >= 120 && h < 180) {  
            r = 0; g = c; b = x;  
        } else if (h >= 180 && h < 240) {  
            r = 0; g = x; b = c;  
        } else if (h >= 240 && h < 300) {  
            r = x; g = 0; b = c;  
        } else if (h >= 300 && h < 360) {  
            r = c; g = 0; b = x;  
        }  
        
        r = Math.round((r + m) * 255);  
        g = Math.round((g + m) * 255);  
        b = Math.round((b + m) * 255);  
        
        const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);  
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;  
    }

    private normalizeColor(color: string): string {  
        if (!color || color.trim() === "") return "#FFFFFF";  
        
        const trimmedColor = color.trim().toLowerCase();  
        
        // Valores especiales  
        if (trimmedColor === "transparent") return "transparent";  
        if (trimmedColor === "inherit") return "inherit";  
        if (trimmedColor === "initial") return "#000000";  
        if (trimmedColor === "unset") return "#000000";  
        
        // Ya es hex válido  
        if (/^#[0-9a-f]{6}$/i.test(trimmedColor)) return trimmedColor;  
        if (/^#[0-9a-f]{3}$/i.test(trimmedColor)) {  
            // Expandir hex corto  
            return `#${trimmedColor[1]}${trimmedColor[1]}${trimmedColor[2]}${trimmedColor[2]}${trimmedColor[3]}${trimmedColor[3]}`;  
        }  
        
        // RGB/RGBA  
        if (trimmedColor.startsWith("rgb")) {  
            const hex = this.rgbToHex(trimmedColor);  
            if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;  
        }  
        
        // HSL/HSLA  
        if (trimmedColor.startsWith("hsl")) {  
            const hex = this.hslToHex(trimmedColor);  
            if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;  
        }  
        
        // Colores nombrados extendidos  
        const namedColors: Record<string, string> = {  
            white: "#FFFFFF", black: "#000000", red: "#FF0000", green: "#008000",  
            blue: "#0000FF", gray: "#808080", grey: "#808080", yellow: "#FFFF00",  
            cyan: "#00FFFF", magenta: "#FF00FF", orange: "#FFA500", purple: "#800080",  
            pink: "#FFC0CB", brown: "#A52A2A", olive: "#808000", navy: "#000080",  
            teal: "#008080", lime: "#00FF00", aqua: "#00FFFF", fuchsia: "#FF00FF",  
            silver: "#C0C0C0", maroon: "#800000", darkgray: "#A9A9A9", darkgrey: "#A9A9A9",  
            lightgray: "#D3D3D3", lightgrey: "#D3D3D3"  
        };  
        
        return namedColors[trimmedColor] || "#FFFFFF";  
    }  
    
/*     private normalizeColor(color: string): string {
         // Si no hay color o está vacío, retornar blanco por defecto  
        if (!color || color.trim() === "") return "#FFFFFF";

        const hex = color.startsWith("rgb") ? this.rgbToHex(color) : color;
        if (hex.startsWith("#")) return hex;
        const named: Record<string, string> = {
            white: "#FFFFFF",
            black: "#000000",
            red: "#FF0000",
            green: "#008000",
            blue: "#0000FF",
            gray: "#808080"
        };
        return named[hex.toLowerCase()] || hex;
    } */

    private rgbToHex(rgb: string): string {
        const m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return rgb;
        const [r, g, b] = m.map(Number);
        const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    private parseFontSize(fontSize: string): number {
        const m = fontSize.match(/(\d+)/);
        return m ? parseInt(m[1]) : 16;
    }

    private normalizeFontFamily(fontFamily: string): string {
        const map: Record<string, string> = {
            arial: "MODERN_SANS",
            helvetica: "MODERN_SANS",
            times: "BOOK_ANTIQUA",
            georgia: "BOOK_ANTIQUA",
            "sans-serif": "MODERN_SANS",
            serif: "BOOK_ANTIQUA"
        };
        const norm = fontFamily.toLowerCase().split(",")[0].trim().replace(/['"]/g, "");
        return map[norm] || "MODERN_SANS";
    }

    private parsePadding(p: string): any {
        const v = p.split(" ").map((x) => parseInt(x) || 0);
        if (v.length === 1) return { top: v[0], right: v[0], bottom: v[0], left: v[0] };
        if (v.length === 2) return { top: v[0], right: v[1], bottom: v[0], left: v[1] };
        if (v.length === 4) return { top: v[0], right: v[1], bottom: v[2], left: v[3] };
        return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    private isFontFile(filename: string): boolean{
        const exts = [".woff", ".woff2", ".ttf", ".otf", ".eot"];  
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return exts.includes(ext);
    }

    private mimeFromFontPath(path: string): string {  
        const ext = path.toLowerCase().substring(path.lastIndexOf(".") + 1);  
        switch (ext) {  
            case "woff": return "font/woff";  
            case "woff2": return "font/woff2";  
            case "ttf": return "font/ttf";  
            case "otf": return "font/otf";  
            default: return "application/octet-stream";  
        }  
    }  

    private async processFonts(contents: JSZip): Promise<void> {  
        const fontFiles: string[] = [];  
        contents.forEach((path, file) => {  
            if (!file.dir && this.isFontFile(path)) fontFiles.push(path);  
        });  
    
        await Promise.all(  
            fontFiles.map(async (path) => {  
                try {  
                    const file = contents.file(path);  
                    if (!file) return;  
                    const base64 = await file.async('base64');  
                    const mime = this.mimeFromFontPath(path);  
                    const dataUrl = `data:${mime};base64,${base64}`;  
                    const fontName = path.split('/').pop()?.split('.')[0] || 'custom-font';  
                    
                    this.fontMap.set(fontName, { url: dataUrl, format: mime });  
                } catch (e) {  
                    console.log(`Error procesando fuente ${path}:`, e);  
                }  
            })  
        );  
    }

    private parseDimension(dim: string): any {  
        if (!dim || dim.trim() === "") return undefined;  
        
        const trimmed = dim.trim().toLowerCase();  
        
        // Valores especiales  
        if (trimmed === "auto") return "auto";  
        if (trimmed === "inherit") return "inherit";  
        if (trimmed === "initial") return undefined;  
        if (trimmed === "unset") return undefined;  
        
        // Porcentajes  
        if (trimmed.endsWith("%")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}%`;  
        }  
        
        // Viewport units  
        if (trimmed.endsWith("vw")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}vw`;  
        }  
        if (trimmed.endsWith("vh")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}vh`;  
        }  
        if (trimmed.endsWith("vmin")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}vmin`;  
        }  
        if (trimmed.endsWith("vmax")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}vmax`;  
        }  
        
        // Unidades relativas  
        if (trimmed.endsWith("em")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}em`;  
        }  
        if (trimmed.endsWith("rem")) {  
            const value = parseFloat(trimmed);  
            return isNaN(value) ? undefined : `${value}rem`;  
        }  
        
        // Píxeles y otras unidades absolutas  
        const match = trimmed.match(/^(-?\d*\.?\d+)(px|pt|pc|in|cm|mm|ex|ch)?$/);  
        if (match) {  
            const value = parseFloat(match[1]);  
            const unit = match[2] || "px";  
            return isNaN(value) ? undefined : `${value}${unit}`;  
        }  
        
        return undefined;  
    }  
    
    // Parseo de espaciado (margin/padding) mejorado  
    private parseSpacing(spacing: string): any {  
        if (!spacing || spacing.trim() === "") return { top: 0, right: 0, bottom: 0, left: 0 };  
        
        const values = spacing.trim().split(/\s+/).map(v => this.parseDimension(v));  
        
        if (values.length === 1) {  
            return { top: values[0], right: values[0], bottom: values[0], left: values[0] };  
        }  
        if (values.length === 2) {  
            return { top: values[0], right: values[1], bottom: values[0], left: values[1] };  
        }  
        if (values.length === 3) {  
            return { top: values[0], right: values[1], bottom: values[2], left: values[1] };  
        }  
        if (values.length === 4) {  
            return { top: values[0], right: values[1], bottom: values[2], left: values[3] };  
        }  
        
        return { top: 0, right: 0, bottom: 0, left: 0 };  
    }  

    private parseBorderRadius(radius: string): any {  
        if (!radius || radius.trim() === "") return undefined;  
        
        const values = radius.trim().split(/\s*\/\s*|\s+/).map(v => this.parseDimension(v));  
        
        if (values.length === 1) {  
            return {   
                topLeft: values[0], topRight: values[0],   
                bottomRight: values[0], bottomLeft: values[0]   
            };  
        }  
        if (values.length === 2) {  
            return {   
                topLeft: values[0], topRight: values[1],   
                bottomRight: values[0], bottomLeft: values[1]   
            };  
        }  
        if (values.length === 3) {  
            return {   
                topLeft: values[0], topRight: values[1],   
                bottomRight: values[2], bottomLeft: values[1]   
            };  
        }  
        if (values.length === 4) {  
            return {   
                topLeft: values[0], topRight: values[1],   
                bottomRight: values[2], bottomLeft: values[3]   
            };  
        }  
        
        return undefined;  
    }  
    
    // Parseo de bordes completo  
    private parseBorder(border: string): any {  
        if (!border || border.trim() === "") return undefined;  
        
        const parts = border.trim().split(/\s+/);  
        const result: any = {};  
        
        parts.forEach(part => {  
            if (part.includes("px") || part.includes("em") || part.includes("rem")) {  
                result.width = this.parseDimension(part);  
            } else if (part === "solid" || part === "dashed" || part === "dotted" || part === "double") {  
                result.style = part;  
            } else {  
                result.color = this.normalizeColor(part);  
            }  
        });  
        
        return result;  
    }  
    
    // Parseo de sombras  
    private parseBoxShadow(shadow: string): any[] {  
        if (!shadow || shadow.trim() === "") return [];  
        
        const shadows = shadow.split(",").map(s => s.trim());  
        return shadows.map(shadowStr => {  
            const parts = shadowStr.split(/\s+/);  
            const result: any = {};  
            
            let colorIndex = -1;  
            let insetIndex = parts.findIndex(p => p === "inset");  
            
            if (insetIndex !== -1) {  
                result.inset = true;  
                parts.splice(insetIndex, 1);  
            }  
            
            // Buscar color (usualmente al final o principio)  
            parts.forEach((part, index) => {  
                if (part.startsWith("#") || part.startsWith("rgb") || part.startsWith("hsl") ||   
                    ["red", "blue", "green", "black", "white", "gray", "transparent"].includes(part.toLowerCase())) {  
                    colorIndex = index;  
                }  
            });  
            
            if (colorIndex !== -1) {  
                result.color = this.normalizeColor(parts[colorIndex]);  
                parts.splice(colorIndex, 1);  
            }  
            
            // Los valores restantes son offset-x, offset-y, blur, spread  
            if (parts.length >= 2) {  
                result.offsetX = this.parseDimension(parts[0]);  
                result.offsetY = this.parseDimension(parts[1]);  
            }  
            if (parts.length >= 3) {  
                result.blur = this.parseDimension(parts[2]);  
            }  
            if (parts.length >= 4) {  
                result.spread = this.parseDimension(parts[3]);  
            }  
            
            return result;  
        });  
    }  
    
    // Parseo de transformaciones  
    private parseTransform(transform: string): any[] {  
        if (!transform || transform.trim() === "") return [];  
        
        const functions = transform.match(/\w+\([^)]+\)/g) || [];  
        return functions.map(func => {  
            const match = func.match(/(\w+)\(([^)]+)\)/);  
            if (!match) return null;  
            
            const [, name, params] = match;  
            const values = params.split(",").map(v => this.parseDimension(v.trim()));  
            
            return { type: name, values };  
        }).filter(Boolean);  
    }  

    private getKeyframes(): Map<string, string> {  
        if (this.cssParser instanceof EnhancedCSSParser) {  
            return this.cssParser.getKeyframes();  
        }  
        return new Map();  
    }
    
    // Parseo de animaciones  
    private parseAnimation(animation: string): any {  
        if (!animation || animation.trim() === "") return undefined;  
        
        const parts = animation.trim().split(/\s+/);  
        const result: any = {};  
        
        parts.forEach((part, index) => {  
            if (part.includes("s")) {  
                result.duration = part;  
            } else if (part.includes("ms")) {  
                result.duration = part;  
            } else if (["ease", "ease-in", "ease-out", "ease-in-out", "linear"].includes(part)) {  
                result.timingFunction = part;  
            } else if (part === "infinite") {  
                result.iterationCount = "infinite";  
            } else if (/^\d+$/.test(part)) {  
                result.iterationCount = parseInt(part);  
            } else if (this.cssParser && this.cssParser.getKeyframes().has(part)) {  
                result.name = part;  
            }  
        });  
        
        return result;  
    }  
    
    // Parseo de gradientes  
    private parseGradient(gradient: string): any {  
        if (!gradient || !gradient.includes("gradient")) return undefined;  
        
        if (gradient.startsWith("linear-gradient")) {  
            const match = gradient.match(/linear-gradient\(([^)]+)\)/);  
            if (!match) return undefined;  
            
            const parts = match[1].split(",").map(p => p.trim());  
            const result: any = { type: "linear" };  
            
            // Primer parámetro puede ser el ángulo/dirección  
            if (parts[0].includes("deg") || parts[0].includes("rad") ||   
                ["to top", "to bottom", "to left", "to right"].includes(parts[0])) {  
                result.direction = parts[0];  
                parts.shift();  
            }  
            
            // El resto son color stops  
            result.stops = parts.map(stop => {  
                const colorMatch = stop.match(/^([#\w\s]+)(?:\s+(\d+%?))?$/);  
                if (colorMatch) {  
                    return {  
                        color: this.normalizeColor(colorMatch[1]),  
                        position: colorMatch[2] || undefined  
                    };  
                }  
                return { color: this.normalizeColor(stop) };  
            });  
            
            return result;  
        }  
        
        // Similar para radial-gradient...  
        return undefined;  
    }  
    
    // Normalización de display  
    private normalizeDisplay(display: string): string {  
        const validDisplays = [  
            "block", "inline", "inline-block", "flex", "inline-flex",   
            "grid", "inline-grid", "none", "table", "table-cell", "table-row"  
        ];  
        
        const normalized = display.toLowerCase().trim();  
        return validDisplays.includes(normalized) ? normalized : "block";  
    }  
    
    // Normalización de position  
    private normalizePosition(position: string): string {  
        const validPositions = ["static", "relative", "absolute", "fixed", "sticky"];  
        const normalized = position.toLowerCase().trim();  
        return validPositions.includes(normalized) ? normalized : "static";  
    }  
    
    // Normalización de overflow  
    private normalizeOverflow(overflow: string): string {  
        const validOverflows = ["visible", "hidden", "scroll", "auto"];  
        const normalized = overflow.toLowerCase().trim();  
        return validOverflows.includes(normalized) ? normalized : "visible";  
    }  
    
    // Parseo de z-index  
    private parseZIndex(zIndex: string): number {  
        const parsed = parseInt(zIndex);  
        return isNaN(parsed) ? 0 : parsed;  
    }  
    
    // Normalización de float  
    private normalizeFloat(floatValue: string): string {  
        const validFloats = ["left", "right", "none"];  
        const normalized = floatValue.toLowerCase().trim();  
        return validFloats.includes(normalized) ? normalized : "none";  
    }  
    
    // Normalización de clear  
    private normalizeClear(clear: string): string {  
        const validClears = ["left", "right", "both", "none"];  
        const normalized = clear.toLowerCase().trim();  
        return validClears.includes(normalized) ? normalized : "none";  
    }  
    
    // Normalización de font-style  
    private normalizeFontStyle(style: string): string {  
        const validStyles = ["normal", "italic", "oblique"];  
        const normalized = style.toLowerCase().trim();  
        return validStyles.includes(normalized) ? normalized : "normal";  
    }  
    
    // Normalización de text-decoration  
    private normalizeTextDecoration(decoration: string): string {  
        const validDecorations = ["none", "underline", "overline", "line-through"];  
        const normalized = decoration.toLowerCase().trim();  
        return validDecorations.includes(normalized) ? normalized : "none";  
    }  
    
    // Normalización de text-transform  
    private normalizeTextTransform(transform: string): string {  
        const validTransforms = ["none", "capitalize", "uppercase", "lowercase"];  
        const normalized = transform.toLowerCase().trim();  
        return validTransforms.includes(normalized) ? normalized : "none";  
    }  
    
    // Parseo de line-height  
    private parseLineHeight(lineHeight: string): any {  
        if (!lineHeight || lineHeight.trim() === "") return undefined;  
        
        const trimmed = lineHeight.trim();  
        
        if (trimmed === "normal") return "normal";  
        
        // Unidades numéricas  
        const match = trimmed.match(/^(-?\d*\.?\d+)(px|em|rem|%|vh|vw)?$/);  
        if (match) {  
            const value = parseFloat(match[1]);  
            const unit = match[2] || "";  
            return isNaN(value) ? undefined : `${value}${unit}`;  
        }  
        
        // Sin unidad (número relativo)  
        const numMatch = trimmed.match(/^(-?\d*\.?\d+)$/);  
        if (numMatch) {  
            const value = parseFloat(numMatch[1]);  
            return isNaN(value) ? undefined : value;  
        }  
        
        return undefined;  
    }  
    
    // Parseo de letter-spacing  
    private parseLetterSpacing(spacing: string): any {  
        if (!spacing || spacing.trim() === "") return undefined;  
        
        const trimmed = spacing.trim();  
        if (trimmed === "normal") return "normal";  
        
        return this.parseDimension(trimmed);  
    }  
    
    // Parseo de font-weight mejorado  
    private normalizeFontWeight(weight: string): string {  
        if (!weight || weight.trim() === "") return "normal";  
        
        const normalized = weight.toLowerCase().trim();  
        
        // Valores nominales  
        const nominalWeights = {  
            "normal": "400",  
            "bold": "700",  
            "lighter": "300",  
            "bolder": "900"  
        } as const;  
        
        if (normalized in nominalWeights) {  
            return nominalWeights[normalized as keyof typeof nominalWeights];  
        }  
        
        // Valores numéricos  
        const numMatch = normalized.match(/^(\d+)$/);  
        if (numMatch) {  
            const value = parseInt(numMatch[1]);  
            if (value >= 100 && value <= 900 && value % 100 === 0) {  
                return value.toString();  
            }  
        }  
        
        return "400"; // Default a normal  
    }

    /* ---------------- Build final configuration ---------------- */
    private buildConfiguration(): TEditorConfiguration {  
        const rootId = "root";  
    
        // Limpiar y validar todos los estilos antes de construir  
        Object.keys(this.blocks).forEach(blockId => {  
            const block = this.blocks[blockId];  
            if (block.data?.style) {  

                const padding = block.data.style.padding;  
                // Asegurar que todos los valores de padding sean números  
                if (typeof padding.top === 'string') {  
                    padding.top = parseInt(padding.top) || 0;  
                }  
                if (typeof padding.bottom === 'string') {  
                    padding.bottom = parseInt(padding.bottom) || 0;  
                }  
                if (typeof padding.right === 'string') {  
                    padding.right = parseInt(padding.right) || 0;  
                }  
                if (typeof padding.left === 'string') {  
                    padding.left = parseInt(padding.left) || 0;  
                }  

                if (typeof block.data.style.fontSize === 'string') {  
                    const num = parseInt(block.data.style.fontSize);  
                    block.data.style.fontSize = isNaN(num) ? 16 : num;  
                }  
                
                // Asegurar fontWeight sea válido  
                if (block.data.style.fontWeight && !['bold', 'normal'].includes(block.data.style.fontWeight)) {  
                    const weight = String(block.data.style.fontWeight);  
                    block.data.style.fontWeight = (parseInt(weight) >= 600) ? 'bold' : 'normal';  
                }  

                // Asegurar textAlign válido  
                if (!block.data.style.textAlign ||   
                    !["left", "center", "right"].includes(block.data.style.textAlign)) {  
                    block.data.style.textAlign = "left";  
                }  
                
                // Asegurar backgroundColor válido o eliminarlo  
                if (block.data.style.backgroundColor) {  
                    const normalizedColor = this.normalizeColor(block.data.style.backgroundColor);  
                    if (normalizedColor === "#FFFFFF" && block.data.style.backgroundColor !== "#FFFFFF") {  
                        // Si el normalizado resultó en blanco pero el original no era blanco, eliminar la propiedad  
                        delete block.data.style.backgroundColor;  
                    } else {  
                        block.data.style.backgroundColor = normalizedColor;  
                    }  
                }  
            }  
        });  
    
        const config = {  
            [rootId]: {  
                type: "EmailLayout",  
                data: {  
                    backdropColor: "#F8F8F8",  
                    canvasColor: "#FFFFFF",  
                    textColor: "#242424",  
                    fontFamily: "MODERN_SANS",  
                    childrenIds: this.childrenIds  
                }  
            },  
            ...this.blocks  
        };  
    
        // Validar contra el schema    
        const validation = EditorConfigurationSchema.safeParse(config);  
        if (!validation.success) {  
            console.error('❌ Error de validación:', validation.error);  
            console.error('Detalles:', validation.error.issues);  
            // NO lanzar error, solo registrar para debugging  
        }  
    
        return config;  
    }
/*     private buildConfiguration(): TEditorConfiguration {
        const rootId = "root";

        const config = {
            [rootId]: {
                type: "EmailLayout",
                data: {
                    backdropColor: "#F8F8F8",
                    canvasColor: "#FFFFFF",
                    textColor: "#242424",
                    fontFamily: "MODERN_SANS",
                    childrenIds: this.childrenIds
                }
            },
            ...this.blocks
        };

        // Agregar validación antes de retornar  
        console.log('📋 Configuración generada:', JSON.stringify(config, null, 2));

        // Validar contra el schema  
        const validation = EditorConfigurationSchema.safeParse(config);
        if (!validation.success) {
            console.error('❌ Error de validación:', validation.error);
            console.error('Detalles:', validation.error.issues);
        }

        return config;
    } */
}
