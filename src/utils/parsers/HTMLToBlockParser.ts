/* =========================================================
   ARCHIVO: HTMLToBlockParser.ts
   ========================================================= */
import JSZip, { type JSZipObject } from "jszip";
import { v4 as uuidv4 } from "uuid";
import { EditorConfigurationSchema, type TEditorConfiguration } from "../../documents/editor/core";

import { CSSParser, EnhancedCSSParser } from "./CSSParser";
import { StyleUtils } from "./StyleUtils";
import { ParseError, type ParseResult } from "./ParseErrorTest";
import type { BlockMatcher, MatcherResult } from "./matchers/types";
import { ImageMatcher } from "./matchers/ImageMatcher";
import { InlineIconsMatcher } from "./matchers/InlineIconsMatcher";
import { ButtonMatcher } from "./matchers/ButtonMatcher";
import { ContainerMatcher } from "./matchers/ContainerMatcher";
import { TextElementsMatcher } from "./matchers/TextElementsMatcher";
import { SpacerMatcher } from "./matchers/SpacerMatcher";
import { TableBlockMatcher } from "./matchers/TableBlockMatcher";
import { ScriptMatcher } from "./matchers/ScriptMatcher";
import { MixedContentMatcher } from "./matchers/MixedContentMatcher";
import { TableRowMatcher } from "./matchers/TableRowMatcher";
import { TableCellMatcher } from "./matchers/TableCellMatcher";
import { LayoutTableMatcher } from "./matchers/LayoutTableMatcher";
import { ComparisonSystem } from "./ComparisonSystem";
import { CriticalLogger } from "./CriticalLogger";
import { HeadingMatcher } from "./matchers/HeadingMatcher";

export class HTMLToBlockParser {

    private imageMap: Map<string, string> = new Map();
    private fontMap: Map<string, { url: string; format: string }> = new Map();
    private mediaMap: Map<string, string> = new Map();
    public blocks: Record<string, any> = {};
    private mobileStylesMap: Map<string, any> = new Map();
    private childrenIds: string[] = [];
    public processedElements: WeakSet<Element> = new WeakSet();
    private cssParser: CSSParser | EnhancedCSSParser | null = null;
    public protectedBlocks: Set<string> = new Set();
    private globalCssString: string = "";
    private comparisonSystem: ComparisonSystem = new ComparisonSystem();
    private comparisonMode: boolean = false;
    public useLegacyMode: boolean = false;

    private matchers: BlockMatcher[] = [
        /* ScriptMatcher, */
        ButtonMatcher,
        ImageMatcher,
        InlineIconsMatcher,
        
        TableBlockMatcher,
        TableRowMatcher,
        TableCellMatcher,
        LayoutTableMatcher,

        HeadingMatcher,
        TextElementsMatcher,
        ContainerMatcher,
        MixedContentMatcher,
        SpacerMatcher
    ];

    /* ---------------- ZIP → Blocks ---------------- */
    async parseZipToBlocks(zipFile: File): Promise<ParseResult> {
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(zipFile);

            const validFiles = Object.keys(contents.files).filter(path =>
                !path.includes('__MACOSX/') &&
                !path.includes('.DS_Store') &&
                !path.startsWith('.')
            );

            const fileCount = validFiles.length;
            if (fileCount === 0) {
                throw new ParseError(
                    'El archivo ZIP está vacío',
                    'ZIP_ERROR',
                    { fileCount }
                );
            }

            // Procesar imágenes con recolección de errores
            const imageResult = await this.processImagesWithErrors(contents);
            errors.push(...imageResult.errors);
            warnings.push(...imageResult.warnings);

            const cssResult = await this.extractAndProcessStylesWithErrors(contents);
            errors.push(...cssResult.errors);
            warnings.push(...cssResult.warnings);

            /* await this.processFonts(contents); */
            await this.processVideos(contents);
            await this.processAudio(contents);

            const htmlFiles = Object.keys(contents.files).filter(name =>
                !contents.files[name].dir &&
                name.toLowerCase().endsWith(".html") &&
                !name.includes('__MACOSX/') &&
                !name.includes('.DS_Store') &&
                !name.startsWith('.')
            );

            if (htmlFiles.length === 0) {
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

    /* ---------------- Limpieza HTML ---------------- */
    private cleanHtml(htmlContent: string): string {
        let cleaned = htmlContent;

        // Eliminar Comentarios de IE/Outlook viejos
        cleaned = cleaned.replace(/<!-- \[if[\s\S]*?endif\] -->/gi, "");
        const msoRegex = new RegExp("", "gi");
        cleaned = cleaned.replace(msoRegex, "");

        // a. Si hay <tbody ...><tbody ...>, quitamos el segundo apertura
        cleaned = cleaned.replace(/(<tbody[^>]*>)\s*<tbody[^>]*>/gi, "$1");
        
        // b. Si hay </tbody></tbody>, quitamos el primero
        cleaned = cleaned.replace(/<\/tbody>\s*<\/tbody>/gi, "</tbody>");

        // Arregla filas/celdas cortadas
        cleaned = cleaned.replace(/<\/tr>\s*<td/gi, "</tr><tr><td");
        cleaned = cleaned.replace(/td>\s*<\/tr>/gi, "td></tr>");

        // Quita </b>/<strong> huérfanos justo antes de </td> / </tr> / fin
        /* cleaned = cleaned.replace(/<\/(b|strong)>\s*(?=(<\/td>|<\/tr>|$))/gi, ""); */
        // …y también cuando hay <br> entremedio (caso típico de plantillas de email)
        /* cleaned = cleaned.replace(/<\/(b|strong)>(?=(?:\s|<br\s*\/?>)*<\/td>)/gi, ""); */

        //Limpieza de etiquetas cerradas huérfanas
        cleaned = cleaned.replace(/<\/(b|strong|i|em|u|span)>\s*(?=(<\/td>|<\/tr>|$))/gi, "");
        cleaned = cleaned.replace(/<\/(b|strong|i|em|u|span)>(?=(?:\s|<br\s*\/?>)*<\/td>)/gi, "");

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

        // 6. [Fase 2] Sanitización de URLs en atributos background legacy
        // Algunos emails viejos usan background="..." en tablas. Lo convertimos a style.
        doc.querySelectorAll('[background]').forEach(element => {
            const bg = element.getAttribute('background');
            if (bg) {
                // Solo si no tiene ya un background-image
                element.removeAttribute('background');

                if (!element.getAttribute("style")?.includes('background-image')) {
                    const currentStyle = element.getAttribute('style') || '';
                    element.setAttribute('style', `${currentStyle} background-image: url('${bg}');`);
                }
            }
        })

        return doc.documentElement.outerHTML;
    }

    /**
     * TOMA LOS ESTILOS DEL CSS PARSER Y LOS INYECTA EN EL DOM
     * Esto asegura que extractStyles detecte todo como si fuera inline.
     */
    private inlineCssToDom(doc: Document) {
        if (!this.cssParser) {
            console.log("⚠️ [INLINER] No hay CSS Parser activo.");
            return;
        }

        const allElements = doc.querySelectorAll('*');

        let matchesFound = 0;

        allElements.forEach((element, index) => {
            const htmlEl = element as HTMLElement;
            
            // 1. Intentamos obtener estilos
            const matchedStyles = this.cssParser!.getStylesForElement(element);
            const hasMatches = Object.keys(matchedStyles).length > 0;

            if (hasMatches) matchesFound++;

            // 3. Inyección (Tu lógica robusta)
            const existingInlineStyles = new Set<string>();
            if (htmlEl.style.length > 0) {
                for (let i = 0; i < htmlEl.style.length; i++) {
                    existingInlineStyles.add(htmlEl.style[i]); 
                }
            }

            for (const [prop, value] of Object.entries(matchedStyles)) {
                if (!value) continue;
                const cssProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                
                if (!existingInlineStyles.has(cssProp)) {
                    htmlEl.style.setProperty(cssProp, String(value), "important");
                }
            }
        });
    }

    /**
     * Convierte un elemento HTML y sus estilos en un objeto de formato 
     * compatible con tu array de formats (start, end, bold, etc.)
     */
    public extractFormatFromElement(el: HTMLElement, styles: any, start: number, end: number): any {
        const tag = el.tagName.toLowerCase();
        const fmt: any = { start, end };
        let hasFormat = false;

        // 1. Detección por Tag
        if (tag === 'strong' || tag === 'b') { fmt.bold = true; hasFormat = true; }
        if (tag === 'em' || tag === 'i') { fmt.italic = true; hasFormat = true; }
        if (tag === 'u') { fmt.underline = true; hasFormat = true; }
        if (tag === 'a') { 
            fmt.link = el.getAttribute('href') || '#'; 
            hasFormat = true; 
        }

        // 2. Detección por Estilos (Computed)
        const fw = String(styles.fontWeight || "").toLowerCase();
        if (fw === 'bold' || parseInt(fw) >= 600) { fmt.bold = true; hasFormat = true; }
        
        if (styles.fontStyle === 'italic') { fmt.italic = true; hasFormat = true; }
        if (styles.textDecoration === 'underline') { fmt.underline = true; hasFormat = true; }
        
        if (styles.color && styles.color !== 'inherit') { 
            fmt.color = styles.color; 
            hasFormat = true; 
        }

        return hasFormat ? fmt : null;
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

    /**
     * Extrae reglas CSS dentro de @media queries (max-width) para soporte móvil.
     * Soporta selectores simples (.clase, #id, tag).
     */
    private processMobileStyles(cssContent: string) {
        // Regex para encontrar bloques @media
        // Busca: @media (...) { CONTENIDO }
        const mediaRegex = /@media[^{]+\((?:max-width|width)[^)]+\)[^{]*\{([\s\S]+?})\s*}/gi;

        let match;
        while ((match = mediaRegex.exec(cssContent)) !== null) {
            const rulesContent = match[1];

            // Iterar sobre las reglas internas (Selector { Estilos })
            // Separamos por '}' para obtener bloques "selector { estilos"
            const ruleBlocks = rulesContent.split("}");

            ruleBlocks.forEach(block => {
                if (!block.trim()) return;

                const parts = block.split("{");
                if (parts.length !== 2) return;

                const selectorRaw = parts[0].trim();
                const stylesRaw = parts[1].trim();

                const stylesObj = StyleUtils.parseInlineStyles(stylesRaw);
                const normalizedStyles = StyleUtils.normalizeStyles(stylesObj);

                const selectors = selectorRaw.split(",").map(s => s.trim());

                selectors.forEach(selector => {
                    const existing = this.mobileStylesMap.get(selector) || {};
                    this.mobileStylesMap.set(selector, { ...existing, ...normalizedStyles })
                })
            })
        }
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
            warnings.push(new ParseError(
                'No se encontraron archivos CSS en el ZIP - se usarán solo estilos inline',
                'CSS_ERROR',
                { supportedFormats: ['.css'] },
                true
            ));
        } else {
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

        if (all.length > 0) {
            this.globalCssString = all;
            try {
                this.processMobileStyles(all);
            } catch (error) {
                console.warn("Error procesando media queries:", error);
            }

            this.cssParser = new CSSParser(all);
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
    }



    private async parseHtmlToBlocksWithErrors(htmlContent: string): Promise<{
        configuration?: TEditorConfiguration,
        errors: ParseError[],
        warnings: ParseError[]
    }> {
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];

        try {
            // 1. Limpieza y Parseo del DOM
            // (Asegúrate de que tu función cleanHtml devuelva doc.documentElement.outerHTML para no perder el HEAD)
            const cleanedHtml = this.cleanHtml(htmlContent);
            const parser = new DOMParser();
            const doc = parser.parseFromString(cleanedHtml, 'text/html');

            const body = doc.body || doc.documentElement;
            if (!body) {
                errors.push(new ParseError(
                    'No se pudo parsear el contenido HTML - no se encontró body',
                    'HTML_ERROR',
                    undefined,
                    false
                ));
                return { errors, warnings };
            }

            // 2. Extracción de CSS Embebido (<style>) del documento actual
            const styleTags = doc.querySelectorAll("head style, body style");

            let embeddedCss = "";
            styleTags.forEach(tag => {
                if (tag.textContent) {
                    embeddedCss += tag.textContent + "\n";
                }
            });

            // 3. FUSIÓN DE ESTILOS (Global del ZIP + Local del HTML)
            // Combinamos lo que venía del ZIP (globalCssString) con lo nuevo del HTML (embeddedCss)
            const finalCssContent = (this.globalCssString || "") + "\n" + (embeddedCss || "");

            if (finalCssContent.trim().length > 0) {
                // A. Procesar estilos móviles 
                // (Procesamos el embeddedCss para actualizar el mapa de móviles con lo nuevo)
                if (embeddedCss.trim().length > 0) {
                    try {
                        this.processMobileStyles(embeddedCss);
                    } catch (e) {
                        console.warn("Error procesando estilos móviles:", e);
                    }
                }

                // B. REINICIAR EL PARSER CON TODO EL CONTENIDO
                // Esto es vital: crea un 'Cerebro CSS' que sabe tanto lo del archivo externo como lo del style tag.
                try {
                    this.cssParser = new CSSParser(finalCssContent);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    warnings.push(new ParseError(`Error iniciando CSS Parser: ${msg}`, 'CSS_ERROR'));
                }

            }

            // 4. INLINING (La Magia)
            // Aplica las clases CSS a los atributos style="" de cada elemento
            if (this.cssParser) {
                try {
                    this.inlineCssToDom(doc);
                } catch (e) {
                    console.warn("Error inlining CSS:", e);
                    warnings.push(new ParseError('Error inyectando estilos CSS', 'CSS_ERROR', { originalError: e }));
                }
            }

            // 5. Validación de Estructura HTML
            const validationErrors = this.validateHtmlStructure(doc);
            errors.push(...validationErrors);

            if (this.comparisonMode) {
                this.comparisonSystem.clearResults();
                console.log('%c[COMPARISON] Modo comparación activado', 'color: #FF9800; font-weight: bold;');
            }
            CriticalLogger.reset();

            // 6. Generación de Bloques
            this.blocks = {};
            this.childrenIds = [];
            this.processedElements = new WeakSet();

            // Aquí processChildren leerá los estilos correctamente porque:
            // a) inlineCssToDom los puso en el atributo style=""
            // b) extractStyles lee ese atributo style=""
            this.processChildren(body, this.childrenIds, {});

            // Opcional: Aplanar contenedores redundantes si usas esa función
            this.flattenRedundantContainers();

            const configuration = this.buildConfiguration();

            if (this.comparisonMode) {
                this.comparisonSystem.printReport();
                
                const report = this.comparisonSystem.generateReport();
                const highSeverity = report.summary.bySeverity.HIGH;
                
                if (highSeverity > 0) {
                    warnings.push(new ParseError(
                        `Se encontraron ${highSeverity} diferencias críticas entre legacy y matchers`,
                        'COMPARISON_WARNING',
                        { comparisonResults: report.details },
                        true
                    ));
                }
            }
            
            // Estadísticas de logging
            const logStats = CriticalLogger.getStats();
            if (logStats.errors > 0 || logStats.warnings > 0) {
                console.log('%c=== LOGGING STATS ===', 'color: #333; font-weight: bold;');
                console.log(`Errores críticos: ${logStats.errors}`);
                console.log(`Advertencias: ${logStats.warnings}`);
            }

            return { configuration, errors, warnings };

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error("💥 Error Fatal en Parser:", e);
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

    private validateHtmlStructure(doc: Document): ParseError[] {
        const errors: ParseError[] = [];

        if (!doc.body) {
            errors.push(new ParseError(
                'El HTML no tiene elemento body',
                'HTML_ERROR',
                {},
                false
            ));
        }

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

    /**
     * Determina si un elemento es candidato para ser fusionado en un bloque de texto grande.
     * Incluimos párrafos, listas y divs que solo contienen texto.
     */
    private isMergeableTextElement(element: Element): boolean {
        const tag = element.tagName.toLowerCase();

        // Etiquetas de texto clásicas
        const textTags = ["p", "ul", "ol", "blockquote", "pre"];
        if (textTags.includes(tag)) return true;

        // Divs que actúan como párrafos (sin estilos de contenedor complejos)
        if (tag === "div") {
            // Si tiene hijos bloque (como tablas o imágenes), NO es texto puro
            if (element.querySelector('table, img, video, button')) return false;
            // Si tiene texto directo o solo spans/b/i, es texto
            return false;
        }

        if (/^h[1-6]$/.test(tag)) return true;

        return false;
    }

    /* =========================================================
       NUEVOS MÉTODOS PÚBLICOS (API para los Matchers)
       ========================================================= */

    /** Permite a un Matcher registrar un bloque en el estado global */
    public addBlock(id: string, blockData: any) {
        this.blocks[id] = blockData;
    }

    /** Permite a un Matcher resolver una URL (lógica extraída de tu código antiguo) */
    public resolveAssetUrl(src: string): string {
        const PLACEHOLDER_IMG = 'https://placehold.net/default.png';
        if (!src) return PLACEHOLDER_IMG;

        // Tu lógica existente para buscar en imageMap
        let dataUrl: string | undefined;
        let fileName: string;

        if (src.startsWith("http")) {
            try {
                const url = new URL(src);
                fileName = url.pathname.split("/").pop() || "";
            } catch (error) {
                fileName = src.split("/").pop() || "";
            }
            const baseName = fileName.toLowerCase().split('?')[0];
            dataUrl = this.imageMap.get(baseName);
            if (!dataUrl) dataUrl = src;
        } else {
            fileName = src.split("/").pop() || src;
            const baseName = fileName.toLowerCase().split('?')[0];
            dataUrl = this.imageMap.get(baseName);
            if (!dataUrl) {
                const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "");
                const matchingKey = Array.from(this.imageMap.keys()).find(key =>
                    key.toLowerCase().includes(nameWithoutExt)
                );
                if (matchingKey) dataUrl = this.imageMap.get(matchingKey);
            }
        }
        return dataUrl || PLACEHOLDER_IMG;
    }

    private debugMatch(element: Element, matcherName: string, matched: boolean) {
        try {
            const tag = element.tagName ? element.tagName.toLowerCase() : 'unknown';
            const id = element.id ? `#${element.id}` : '';
            const classes = element.className ? `.${String(element.className).split(' ').join('.')}` : '';
            
            // 🔥 FIX: Leemos el estilo directo del atributo, NO usamos window.getComputedStyle
            const styleAttr = element.getAttribute('style') || '';
            const displayMatch = styleAttr.match(/display\s*:\s*([a-z-]+)/i);
            const display = displayMatch ? displayMatch[1] : 'default';

            // Solo imprimimos si hubo match para no inundar la consola, o quita el 'if' para ver todo
            if (matched) {
                console.log(
                    `%c[MATCHER] ${matcherName.padEnd(20)}`, 'color: cyan; font-weight: bold;',
                    `| <${tag}${id}${classes}>`,
                    `| display: ${display}`,
                    `| children: ${element.children.length}`
                );
            }
        } catch (e) {
            console.error("Error en debugMatch:", e);
        }
    }

    /**
     * Método público para permitir recursividad desde los Matchers.
     * Busca el matcher adecuado para un elemento y lo procesa.
     */
    public parseElement(element: Element, inheritedStyles: any = {}): MatcherResult | null {
        for (const matcher of this.matchers) {
            // Pasamos 'this' como segundo argumento porque la interfaz lo requiere
            const matched = matcher.isComponent(element, this);
            if (matched) {
                return matcher.fromElement(element, this, inheritedStyles);
            }
        }
        return null;
    }

    private getLegacyResult(
        element: Element, 
        inheritedStyles: Record<string, string>
    ): { id: string; block: any } | null {
        try {
            // Clonamos los bloques actuales para poder revertir cambios
            // (Esto es una simulación ligera para no instanciar todo el parser de nuevo)
            const snapshotIds = Object.keys(this.blocks);
            
            // Ejecutamos legacy
            const tempId = this.processElementLegacy(element, inheritedStyles);
            
            if (!tempId) return null;

            const legacyBlock = { ...this.blocks[tempId] }; // Copia del bloque
            
            // REVERTIR CAMBIOS: Borramos el bloque creado y cualquier hijo nuevo
            // para que no ensucien el resultado final del Matcher
            const currentIds = Object.keys(this.blocks);
            const newIds = currentIds.filter(id => !snapshotIds.includes(id));
            newIds.forEach(id => delete this.blocks[id]);

            return { id: tempId, block: legacyBlock };
            
        } catch (error) {
            return null;
        }
    }

/*     private getLegacyResult(
        element: Element, 
        inheritedStyles: Record<string, string>
    ): { id: string; block: any } | null {
        try {
            // CREAR UN PARSER TEMPORAL COMPLETAMENTE AISLADO
            const tempParser = new HTMLToBlockParser();
            
            // Copiar solo los recursos de assets (no el estado)
            tempParser.imageMap = this.imageMap;
            tempParser.fontMap = this.fontMap;
            tempParser.mediaMap = this.mediaMap;
            tempParser.mobileStylesMap = new Map(this.mobileStylesMap);
            tempParser.globalCssString = this.globalCssString;
            
            // Copiar el CSS parser si existe
            if (this.cssParser) {
                // Crear uno nuevo con el mismo CSS para evitar problemas de referencia
                tempParser.cssParser = new CSSParser(this.globalCssString);
            }
            
            // Ejecutar legacy en el parser temporal
            const tempId = tempParser.processElementLegacy(element, inheritedStyles);
            
            if (!tempId) {
                return null;
            }
            
            return {
                id: tempId,
                block: tempParser.blocks[tempId]
            };
        } catch (error) {
            CriticalLogger.error(`Error en getLegacyResult`, element, error);
            return null;
        }
    } */

    private processElement(
        element: Element,
        inheritedStyles: Record<string, string>
    ): string | null {
        // Evitar bucles infinitos
        if (this.processedElements.has(element)) return null;

        // =========================================================
        // ESCENARIO 1: MODO LEGACY PURO (Switch de emergencia)
        // =========================================================
        if (this.useLegacyMode) {
            const legacyId = this.processElementLegacy(element, inheritedStyles);
            if (legacyId) {
                this.processedElements.add(element);
            }
            return legacyId;
        }

        const tagName = element.tagName.toLowerCase();
        const id = element.id || 'sin-id';

        // 🔍 DEBUG LOG: Solo para los elementos problemáticos
        const isProblematic = id === 'iflem' || id === 'irtcdy' || tagName === 'table'; 
        
        /* if (isProblematic) {
            console.group(`🔍 Analizando <${tagName} id="${id}">`);
        } */

        // =========================================================
        // ESCENARIO 2 & 3: MODO MATCHERS (con o sin comparación)
        // =========================================================

        // 1. Ejecutar Matchers (Nuestra prioridad)
        let matcherResult: MatcherResult | null = null;
        let matcherName: string | null = null;
        
        for (const matcher of this.matchers) {
            const isMatch = matcher.isComponent(element, this);

            /* if (isProblematic) {
                console.log(`   ❓ ${matcher.name}: ${isMatch ? "✅ SÍ" : "❌ NO"}`);
            } */

            if (isMatch) {
                matcherResult = matcher.fromElement(element, this, inheritedStyles);
                /* if (isProblematic) {
                     console.log(`   ✨ Resultado ${matcher.name}:`, matcherResult ? "OK" : "NULL (Falló en fromElement)");
                } */
                if (matcherResult) break; 
            }
        }

        /* if (isProblematic) {
            console.groupEnd();
        } */

        // 2. Si el modo comparación está activo, obtenemos el resultado legacy "en la sombra"
        if (this.comparisonMode) {
             const legacyData = this.getLegacyResult(element, inheritedStyles);
             
             // Comparamos lo que habría hecho el legacy vs lo que hizo el matcher
             this.comparisonSystem.compare(
                element,
                legacyData,
                matcherResult ? { id: matcherResult.id, block: this.blocks[matcherResult.id] } : null,
                matcherName || 'unknown'
            );
        }

        // 3. Retornar resultado del Matcher
        if (matcherResult) {
            this.processedElements.add(element);
            return matcherResult.id;
        }
        
        // 4. Fallback: Si los Matchers fallaron, usamos Legacy para no dejar huecos
        // (A menos que queramos ser estrictos, pero por ahora es seguro dejarlo)
        const fallbackId = this.processElementLegacy(element, inheritedStyles);
        if (fallbackId) {
            this.processedElements.add(element);
            return fallbackId;
        }
        
        // 5. Nada funcionó
        CriticalLogger.warning(`Elemento no procesado: <${tagName}>`, element);
        return null;
    }

    private processElementLegacy(
        element: Element,
        inheritedStyles: Record<string, string>
    ): string | null {
        if (this.processedElements.has(element)) return null; 
        const tagName = element.tagName.toLowerCase();
        const currentStyles = this.extractStyles(element, inheritedStyles);


        // Si es una de estas etiquetas, la convertimos a Markdown y paramos aquí.
        const markdownTags = ['blockquote', 'ul', 'ol'];

        if (markdownTags.includes(tagName)) {
            // 1. Convertimos todo el árbol interno a Markdown
            const markdownText = this.nodeToMarkdown(element).trim();

            // 2. Creamos el bloque de Texto con ese contenido
            if (markdownText) {
                return this.createTextBlock(markdownText, [], currentStyles, true);
            }
            return null;
        }

        if (tagName === "table" && this.isColumnsTable(element)) {
            return this.createColumnsContainer(element, currentStyles);
        }
        if (this.isFlexContainer(element)) return this.createFlexContainer(element, currentStyles);
        if (this.isGridContainer(element)) return this.createGridContainer(element, currentStyles);

        if (tagName === "table" && this.isInlineCompactTable(element)) {
            const id = this.createInlineCompactTableBlock(element, currentStyles);
            if (id) return id;
        }

        if (tagName === 'img' && this.isAvatar(element, currentStyles)) {
            const imgId = this.createImageBlock(element as HTMLImageElement);
            if (imgId && this.blocks[imgId]) {
                this.blocks[imgId].type = 'Avatar';
                return imgId;
            }
        }

        if (tagName === "a") {
            const imgs = element.querySelectorAll("img");
            const text = element.textContent?.trim() || "";
            if (imgs.length === 1 && text === "") {
                const img = imgs[0];
                const id = this.createImageBlock(img, element.getAttribute("href") || "#");
                const hasContainerStyles = currentStyles.padding || currentStyles.backgroundColor;
                if (id && hasContainerStyles) {
                    return this.createContainerBlock([id], { ...currentStyles, width: currentStyles.width });
                }
                return id;
            }
        }

        if (tagName === "img") {
            return this.createImageBlock(element as HTMLImageElement);
        }

        if (this.isButton(element, currentStyles)) {
            return this.createButtonBlock(element, currentStyles);
        }

        if (this.isButtonLikeCell(element)) {
            const anchor = element.querySelector('a');
            if (anchor) return this.createButtonBlock(anchor, currentStyles);
        }

        if (this.isSeparator(element, currentStyles)) {
            const id = uuidv4();
            this.blocks[id] = { type: "Separator", data: { style: currentStyles } };
            return id;
        }

        if (this.isSpacer(element, currentStyles)) {
            const id = uuidv4();
            const height = parseInt(String(currentStyles.height)) || 20;
            this.blocks[id] = {
                type: "Spacer",
                data: { style: {}, props: { height } }
            };
            return id;
        }

        if (/^h[1-6]$/.test(tagName)) {
            return this.createHeadingBlock(element, currentStyles);
        }

        const isTextTag = ["p", "span", "div", "td", "li"].includes(tagName);
        if (isTextTag) {
            if (!currentStyles.fontSize && inheritedStyles.fontSize) currentStyles.fontSize = inheritedStyles.fontSize;
            if (!currentStyles.fontFamily && inheritedStyles.fontFamily) currentStyles.fontFamily = inheritedStyles.fontFamily;
            if (!currentStyles.color && inheritedStyles.color) currentStyles.color = inheritedStyles.color;
            if (!currentStyles.textAlign && inheritedStyles.textAlign) currentStyles.textAlign = inheritedStyles.textAlign;

            const { text, formats, hasListStructure } = this.processInlineContent(element, currentStyles);
            if (text.length > 0 && !this.elementContainsOtherBlockTypes(element)) {
                return this.createTextBlock(text, formats, currentStyles, hasListStructure);
            }
        }

        const childrenIds: string[] = [];
        const cleanStyles = this.filterInheritableStyles(currentStyles);

        this.processChildren(element, childrenIds, cleanStyles);

        if (childrenIds.length > 0) {
            const isTransparent = !currentStyles.backgroundColor && !currentStyles.border;
            if (childrenIds.length === 1 && isTransparent && !currentStyles.padding) {
                return childrenIds[0];
            }
            return this.createContainerBlock(childrenIds, currentStyles);
        }

        const hasContent = (element.textContent?.trim().length || 0) > 0 || element.children.length > 0;
        const ignoredTags = ['br', 'script', 'style', 'meta', 'title', 'link', 'tbody', 'tr'];

        if (hasContent && !ignoredTags.includes(tagName)) {
            const id = uuidv4();
            this.blocks[id] = {
                type: "Html",
                data: {
                    props: { content: element.outerHTML },
                    style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, backgroundColor: null }
                }
            };
            return id;
        }

        return null;
    }

    public processInlineContent(
        element: Element,
        inheritedStyles: Record<string, any>
    ): { text: string; formats: any[]; hasListStructure: boolean } {
        let text = "";
        const formats: any[] = [];
        let hasListStructure = false;

        const append = (t: string) => {
            if (!t) return;
            text += t;
        };

        const inlineTags = new Set(["strong", "b", "em", "i", "u", "a", "span", "small", "sup", "sub", "br", "img"]);

        Array.from(element.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                let content = node.textContent || "";
                content = content.replace(/[\n\r\t]/g, " ");
                content = content.replace(/\s{2,}/g, " ");

                if (text.length === 0) {
                    content = content.trimStart();
                }

                const trimmed = content.trim();
                const isBullet = trimmed.startsWith("•") || trimmed.startsWith('·') || trimmed.startsWith('-') || /^\d+\./.test(trimmed);

                if (isBullet) {
                    hasListStructure = true;
                    if (text.length > 0 && !text.endsWith('\n')) {
                        const idx = content.indexOf(trimmed.charAt(0));
                        if (idx > -1) {
                            content = '\n' + content.substring(idx);
                        } else {
                            content = '\n' + content;
                        }
                    }
                }

                append(content);
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

                if (["p", "div", "li", "ul", "ol", "section"].includes(tag)) {
                    if (text.length > 0 && !text.endsWith('\n')) {
                        append("\n");
                    }
                }

                if (tag === 'ul' || tag === 'ol' || tag === 'li') {
                    hasListStructure = true;
                }

                if (tag === "img") return;

                if (tag === "li") {
                    const parent = el.parentElement?.tagName.toLowerCase();
                    if (parent === 'ol') {
                        const idx = Array.from(el.parentElement?.children || []).indexOf(el) + 1;
                        append(`${idx}. `);
                    } else {
                        append("• ");
                    }
                }

                if ((tag === "strong" || tag === "b") && el.querySelector("a")) {
                    const link = el.querySelector("a");
                    if (link && link.getAttribute("href") && link.textContent?.trim()) {
                        const md = `**[${link.textContent.trim()}](${link.getAttribute("href")})**`;
                        append(md);
                        return;
                    }
                }
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

                if (childRes.hasListStructure) hasListStructure = true;

                if (childRes.text.length) {
                    const start = text.length;
                    append(childRes.text);
                    const end = text.length;

                    childRes.formats.forEach(fmt => {
                        formats.push({
                            ...fmt,
                            start: fmt.start + start,
                            end: fmt.end + start
                        });
                    });

                    const fmt: any = { start, end };
                    let hasFormat = false;

                    const styleAttr = el.getAttribute('style') || '';
                    const fw = String(childStyles.fontWeight ?? "").toLowerCase();
                    const fs = String(childStyles.fontStyle ?? "").toLowerCase();

                    const isBoldTag = tag === "strong" || tag === "b";
                    const isBoldRegex = /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(styleAttr);
                    const isBoldStyle = fw === "bold" || (!isNaN(parseInt(fw)) && parseInt(fw) >= 600);

                    if (isBoldTag || isBoldStyle || isBoldRegex) {
                        fmt.bold = true;
                        hasFormat = true;
                    }

                    const isItalicTag = tag === "em" || tag === "i";
                    const isItalicRegex = /font-style\s*:\s*(italic|oblique)/i.test(styleAttr);
                    const isItalicStyle = fs.includes("italic") || fs.includes("oblique");

                    if (isItalicTag || isItalicStyle || isItalicRegex) {
                        fmt.italic = true;
                        hasFormat = true;
                    }

                    if (tag === 'u' || childStyles.textDecoration === 'underline') {
                        fmt.underline = true;
                        hasFormat = true;
                    }

                    if (childStyles.color && childStyles.color !== '#000000' && childStyles.color !== 'inherit') {
                        fmt.color = childStyles.color;
                        hasFormat = true;
                    }

                    if (childStyles.fontFamily && childStyles.fontFamily !== "MODERN_SANS") {
                        fmt.fontFamily = childStyles.fontFamily;
                        hasFormat = true;
                    }

                    if (childStyles.fontSize) {
                        const size = parseInt(String(childStyles.fontSize));
                        if (!isNaN(size) && size !== 16) {
                            fmt.fontSize = size;
                            hasFormat = true;
                        }
                    }

                    if (hasFormat) {
                        formats.push(fmt);
                    }
                }

                if (["div", "p", "li", "section"].includes(tag) && text.length > 0 && !text.endsWith('\n')) {
                    append("\n");
                }
            }
        });

        return { text, formats, hasListStructure };
    }

    // Método auxiliar para procesar nodos en legacy
    private processNodeForLegacy(node: Node, inheritedStyles: Record<string, any>): string | null {
        if (node.nodeType === Node.TEXT_NODE) {
            const textContent = node.textContent;
            if (!textContent || !textContent.trim()) return null;
            return this.createTextBlock(textContent, [], inheritedStyles);
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            return this.processElementLegacy(node as Element, inheritedStyles);
        }

        return null;
    }

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
        // 1. Etiquetas que SIEMPRE son bloques y rompen el flujo de texto
        const strictBlockTags = ["table", "img", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "form"];

        return Array.from(element.children).some((c) => {
            const tag = c.tagName.toLowerCase();

            // Si es una etiqueta de bloque estricta, devolvemos true
            if (strictBlockTags.includes(tag)) return true;

            // 2. Lógica especial para enlaces (<a>)
            if (tag === 'a') {
                // ¿Tiene imagen dentro? -> Es un bloque (Link-Imagen)
                if (c.querySelector('img')) return true;

                // Analizamos si tiene estilos de Botón
                const style = c.getAttribute('style') || '';

                // Heurística rápida para detectar botones visuales:
                // - Tiene background-color (que no sea transparente ni blanco/negro por defecto de texto)
                // - Tiene border
                // - Tiene display: block o inline-block explícito con padding

                const hasBg = /background(-color)?\s*:\s*(?!transparent|white|#fff|rgba\(0,\s*0,\s*0,\s*0\))/i.test(style);
                const hasBorder = /border\s*:\s*(?!none|0px)/i.test(style);
                const hasButtonClass = (c.className || "").includes("btn") || (c.className || "").includes("button");
                const isBlockDisplay = /display\s*:\s*(block|inline-block)/i.test(style);
                const hasPadding = /padding\s*:\s*[1-9]/.test(style); // Tiene algo de padding

                // Si cumple características de botón, lo tratamos como bloque.
                // Si no, devolvemos false para que el procesador de texto lo absorba como link inline.
                if (hasBg || hasBorder || hasButtonClass || (isBlockDisplay && hasPadding)) {
                    return true;
                }
            }

            return false;
        });
    }

    public processChildren(parentElement: Element, targetArray: string[], inheritedStyles: Record<string, string>): void {
        Array.from(parentElement.childNodes).forEach((node) => {
            const id = this.processNode(node, inheritedStyles);
            if (id) targetArray.push(id);
        });
    }

    private processNode(node: Node, inheritedStyles: Record<string, any>): string | null {
        if (node.nodeType === Node.TEXT_NODE) {
            const textContent = node.textContent;
            if (!textContent || !textContent.trim()) return null;
            return this.createTextBlock(textContent, [], inheritedStyles);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            return this.processElement(node as Element, inheritedStyles);
        }
        return null;
    }

    private isColumnsTable(element: Element): boolean {
        const rows = Array.from(element.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        if (rows.length === 0) return false;

        const hasMultiCellRow = rows.some((r) => r.querySelectorAll(":scope > td").length > 1);
        if (hasMultiCellRow) return true;

        const hasComplexSingleCell = rows.some((r) => {
            const tds = Array.from(r.querySelectorAll(":scope > td"));
            if (tds.length !== 1) return false;
            const td = tds[0];
            const hasSections = td.querySelectorAll("section, p, div").length > 1;
            const hasMultipleBlocks = td.children.length > 1;
            return hasSections || hasMultipleBlocks;
        });

        if (hasComplexSingleCell) return true;

        const hasHybridColumns = rows.some(r => {
            const tds = Array.from(r.querySelectorAll(":scope > td"));
            if (tds.length === 0) return false;
            return tds.some(td => {
                const style = td.getAttribute("style") || "";
                const hasWidth = /width\s*:/i.test(style) || td.getAttribute("width");
                const isInline = /display\s*:\s*inline-block/i.test(style);
                return isInline && hasWidth;
            });
        });

        const isWrapperTable = rows.length === 1 && rows[0].children.length >= 2;
        return hasHybridColumns || isWrapperTable;
    }

    private isInlineCompactTable(table: Element): boolean {
        if (table.tagName.toLowerCase() !== "table") return false;
        const rows = Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        if (rows.length === 0) return false;
        if (table.querySelector("table, h1, h2, h3, h4, h5, h6, ul, ol, section, article")) return false;
        const totalTextLen = this.collectText(table).length;
        if (totalTextLen > 200) return false;

        for (const row of rows) {
            const tds = Array.from(row.querySelectorAll(":scope > td"));
            const hasMultipleImgsInSingleCell = tds.length === 1 && tds[0].querySelectorAll("img").length >= 2;
            if (tds.length < 2 && !hasMultipleImgsInSingleCell) continue;
            if (tds.length > 6) continue;
            const simple = tds.filter((td) => this.isSimpleInlineCell(td)).length;
            if (simple >= Math.max(2, Math.floor(tds.length * 0.8))) {
                return true;
            }
        }
        return false;
    }

    private isSimpleInlineCell(td: Element): boolean {
        if (td.querySelector("table, h1, h2, h3, h4, h5, h6, ul, ol, section, article")) return false;
        if (td.querySelector("div div")) return false;
        const textLen = this.collectText(td).length;
        if (textLen > 80) return false;
        const hasImg = !!td.querySelector("img");
        const hasLink = !!td.querySelector("a");
        const hasShortText = textLen > 0 && textLen <= 80;
        const multipleImgs = td.querySelectorAll("img").length >= 2;
        const multipleLinks = td.querySelectorAll("a").length >= 2;
        return hasImg || hasLink || hasShortText || (multipleImgs && multipleLinks);
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

    private isFlexContainer(element: Element): boolean {
        const styles = this.extractStyles(element, {});
        return styles.display === "flex" || styles.display === "inline-flex";
    }

    private isGridContainer(element: Element): boolean {
        const styles = this.extractStyles(element, {});
        return styles.display === "grid" || styles.display === "inline-grid";
    }

    private isVideoFile(filename: string): boolean {
        const exts = [".mp4", ".webm", ".ogg", ".avi", ".mov"];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return exts.includes(ext);
    }

    private isAudioFile(filename: string): boolean {
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

    private isAvatar(element: Element, styles: any): boolean {
        if (element.tagName.toLowerCase() !== 'img') return false;
        
        const radius = styles.borderRadius;
        if (!radius) return false;

        // 🔥 FIX: Convertir a String antes de usar includes
        const radiusStr = String(radius); 
        
        // Comprobamos si es porcentaje (50%) o número alto (>= 50px)
        const isCircle = radiusStr.includes('50%');
        const isLargeValue = parseInt(radiusStr) >= 50;

        return isCircle || isLargeValue;
    }

    private isSpacer(element: Element, styles: any): boolean {
        const isEmpty = !element.textContent?.trim() && element.children.length === 0;
        const hasHeight = styles.height && parseInt(styles.height) > 0;
        const isBr = element.tagName.toLowerCase() === 'br';
        return (isEmpty && hasHeight) || (isBr && styles.display === 'block');
    }

    private isSeparator(element: Element, styles: any): boolean {
        if (element.tagName.toLowerCase() === 'hr') return true;
        const isEmpty = !element.textContent?.trim() && element.children.length === 0;
        const hasBorderTop = styles.borderTopWidth && parseInt(styles.borderTopWidth) > 0;
        const hasBorderBottom = styles.borderBottomWidth && parseInt(styles.borderBottomWidth) > 0;
        return isEmpty && (hasBorderTop || hasBorderBottom) && (!styles.height || parseInt(styles.height) < 5);
    }

    private isButton(element: Element, styles: any): boolean {
        if (element.tagName.toLowerCase() !== 'a') return false;
        const hasBg = styles.backgroundColor && styles.backgroundColor !== 'transparent' && styles.backgroundColor !== '#ffffff';
        const hasPadding = styles.padding && (styles.padding.top > 0 || styles.padding.left > 0);
        const isBlock = styles.display === 'inline-block' || styles.display === 'block';
        return hasBg && hasPadding && isBlock;
    }

    public nodeToMarkdown(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || "";
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }

        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        let content = "";

        el.childNodes.forEach(child => {
            content += this.nodeToMarkdown(child);
        })

        switch (tagName) {
            // --- Bloques ---
            case "blockquote":
                // Añadimos "> " al inicio de cada línea
                return "\n" + content.split('\n').map(line => line.trim() ? `> ${line}` : line).join('\n') + "\n";

            case "p":
            case "div":
                return content + "\n\n";

            case "br":
                return "\n";

            // --- Listas ---
            case "ul":
            case "ol":
                return "\n" + content + "\n";

            case "li":
                // Truco: Si el padre es OL, deberíamos usar números, pero '-' funciona genérico
                // Para ser más estricto, podrías pasar el tipo de padre como argumento.
                return `- ${content.trim()}\n`;

            // --- Estilos Inline ---
            case "b":
            case "strong":
                return `**${content}**`;

            case "i":
            case "em":
                return `*${content}*`;

            case "u":
                // Markdown no tiene subrayado estándar, a veces se usa HTML directo o nada.
                return content;

            case "a":
                const href = el.getAttribute("href") || "#";
                return `[${content}](${href})`;

            case "img":
                // Si encuentras una imagen inline, la conviertes a MD
                const src = el.getAttribute("src") || "";
                const alt = el.getAttribute("alt") || "imagen";
                return `![${alt}](${src})`;

            default:
                return content;
        }
    }


    /* 
        private createColumnsContainerFromIds(childrenIds: string[], styles: any): string {
            const id = uuidv4();
            const count = childrenIds.length;
            const width = Math.floor(100 / count) + "%";
            const columnsData = childrenIds.map(childId => ({
                childrenIds: [childId],
                width: width,
                style: { flexBasis: width, flexGrow: 1, flexShrink: 1, minWidth: '50px' }
            }));
            this.blocks[id] = {
                type: "ColumnsContainer",
                data: {
                    style: {
                        ...styles,
                        display: 'flex',
                        flexWrap: 'wrap',
                        padding: { top: 0, bottom: 0, left: 0, right: 0 }
                    },
                    props: { columnsCount: count, columns: columnsData }
                }
            };
            return id;
        }
    
        private createFlexContainerFromIds(childrenIds: string[], styles: any): string {
            const id = uuidv4();
            const count = childrenIds.length;
            if (count > 1) {
                const widthPercent = Math.floor(100 / count) + "%";
                childrenIds.forEach(childId => {
                    if (this.blocks[childId]?.data?.style) {
                        const s = this.blocks[childId].data.style;
                        s.width = widthPercent;
                        s.flexBasis = widthPercent;
                        s.display = "inline-block";
                        s.maxWidth = "100%";
                        if (this.blocks[childId].type === 'Image') s.margin = "0 auto";
                    }
                });
            }
            this.blocks[id] = {
                type: "Container",
                data: {
                    style: {
                        ...styles,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: styles.textAlign === 'center' ? 'center' : 'flex-start',
                        alignItems: 'stretch'
                    },
                    props: { childrenIds }
                }
            };
            return id;
        }
     */
    private createInlineCompactTableBlock(table: Element, inherited: Record<string, any>): string | null {
        const rows = Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        const stackIds: string[] = [];
        const tableStyle = this.extractStyles(table, inherited);

        for (const row of rows) {
            const tds = Array.from(row.querySelectorAll(":scope > td"));
            if (!tds.length) continue;

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

    private createColumnsContainer(tableElement: Element, styles: any): string | null {
        const elementId = tableElement.id || "sin-id";

        let rows: Element[] = [];
        const tbody = Array.from(tableElement.children).find(c => c.tagName.toLowerCase() === 'tbody');
        const container = tbody ? tbody : tableElement;
        rows = Array.from(container.children).filter(c => c.tagName.toLowerCase() === 'tr');

        const rowBlocks: string[] = [];
        const stylesForChildren = this.filterInheritableStyles(styles);
        delete stylesForChildren.padding;
        delete stylesForChildren.width;       // <--- AGREGAR ESTO
        delete stylesForChildren.maxWidth;    // <--- AGREGAR ESTO
        delete stylesForChildren.height;      // <--- AGREGAR ESTO
        delete stylesForChildren.margin;      // <--- AGREGAR ESTO
        delete stylesForChildren.marginLeft;
        delete stylesForChildren.marginRight;
        delete stylesForChildren.marginTop;
        delete stylesForChildren.marginBottom;
        delete stylesForChildren.display;

        for (const row of rows) {
            const cells = Array.from(row.children).filter(c => c.tagName.toLowerCase() === 'td');
            if (cells.length === 0) continue;

            const barColor = this.pickFirstBgColor(cells);
            const rowText = cells.map(c => c.textContent || "").join("").trim();
            const hasImages = cells.some(c => c.querySelector('img'));

            if (barColor && rowText.length === 0 && !hasImages && cells.length === 1) {
                const height = this.pickRowHeight(cells);
                rowBlocks.push(this.createBarBlock(barColor, height));
                continue;
            }

            const producedColumns: Array<{ childrenIds: string[], width?: string, style?: any }> = [];

            for (const cell of cells) {
                const cellElement = cell as HTMLElement;
                const cellStyles = this.extractStyles(cellElement, stylesForChildren);
                const contentId = this.processElement(cellElement, stylesForChildren);

                const imagesInCell = cellElement.querySelectorAll('img');
                if (imagesInCell.length > 0) {
                    // console.log ...
                }

                if (contentId) {
                    let finalWidth = "auto";
                    let flexBasis = "auto";
                    const styleMaxWidth = cellStyles.maxWidth;
                    const attrWidth = cellElement.getAttribute("width");

                    if (styleMaxWidth && String(styleMaxWidth).includes('px')) {
                        finalWidth = styleMaxWidth;
                        flexBasis = styleMaxWidth;
                    }
                    else if (attrWidth && !isNaN(parseInt(attrWidth))) {
                        finalWidth = `${parseInt(attrWidth)}px`;
                        flexBasis = `${parseInt(attrWidth)}px`;
                    }
                    else if (cellStyles.width && String(cellStyles.width).includes('px')) {
                        finalWidth = cellStyles.width;
                        flexBasis = cellStyles.width;
                    }

                    if (this.blocks[contentId]?.data?.style) {
                        const childStyle = this.blocks[contentId].data.style;
                        if (childStyle.width === '100%' || childStyle.width === '100.0%') {
                            delete childStyle.width;
                        }
                        childStyle.maxWidth = '100%';
                        if (this.blocks[contentId].type === 'Image') {
                            childStyle.height = 'auto';
                            childStyle.display = 'block';
                        }
                    }

                    producedColumns.push({
                        childrenIds: [contentId],
                        width: finalWidth,
                        style: {
                            flexBasis: flexBasis,
                            flexGrow: 1,
                            flexShrink: 1,
                            minWidth: '200px',
                            maxWidth: '100%'
                        }
                    });
                }
            }

            if (producedColumns.length === 0) continue;

            if (producedColumns.length === 1) {
                rowBlocks.push(producedColumns[0].childrenIds[0]);
                continue;
            }


            const ccId = uuidv4();
            const rowNativeStyle = this.extractStyles(row as Element, {});
            const bg = rowNativeStyle.backgroundColor || styles.backgroundColor;
            const align = styles.textAlign === 'center' || styles.textAlign === '-webkit-center' ? 'center' : 'flex-start';

            this.blocks[ccId] = {
                type: "ColumnsContainer",
                data: {
                    style: {
                        padding: { top: 0, bottom: 0, left: 0, right: 0 },
                        backgroundColor: bg !== "#FFFFFF" ? bg : undefined,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: align,
                        textAlign: align,
                        gap: '0px'
                    },
                    props: {
                        columnsCount: producedColumns.length,
                        columns: producedColumns
                    }
                }
            };
            rowBlocks.push(ccId);
        }

        if (rowBlocks.length === 0) return null;
        if (rowBlocks.length === 1 && !styles.padding && !styles.backgroundColor && !styles.width && !styles.maxWidth) {
            return rowBlocks[0];
        }



        return this.createContainerBlock(rowBlocks, {
            ...styles,
            padding: styles.padding
        });
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

    public createTextBlock(text: string, formats: any[], styles: any, forceMarkdown: boolean = false): string | null {
        if (!text) return null;
        const id = uuidv4();

        let finalStyles = { ...styles };
        let finalFormats = [...formats];
        let finalText = text;

        const fullLength = finalText.length;
        const globalFormats = finalFormats.filter(f => f.start === 0 && f.end === fullLength);

        globalFormats.forEach(fmt => {
            if (fmt.bold) finalStyles.fontWeight = "bold";
            if (fmt.italic) finalStyles.fontStyle = "italic";
            if (fmt.color) finalStyles.color = fmt.color;
            if (fmt.fontFamily && fmt.fontFamily !== "MODERN_SANS") finalStyles.fontFamily = fmt.fontFamily;
            if (fmt.fontSize) finalStyles.fontSize = fmt.fontSize;
        });

        finalFormats = finalFormats.filter(f => {
            if (f.start !== 0 || f.end !== fullLength) return true;
            return false;
        });

        /* finalStyles.whiteSpace = "pre-line"; */
        finalStyles.textAlign = StyleUtils.normalizeTextAlign(finalStyles?.textAlign);


        const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(finalText);
        const hasRemainingFormats = finalFormats.length > 0;
        const hasLineBreaks = text.includes('\n');

        this.blocks[id] = {
            type: "Text",
            data: {
                style: {
                    ...finalStyles,
                    padding: finalStyles.padding
                },
                props: {
                    text: finalText,
                    formats: finalFormats,
                    markdown: hasMarkdownLinks || hasRemainingFormats || forceMarkdown || hasLineBreaks
                }
            }
        };
        return id;
    }

    private createImageBlock(element: Element, linkHref?: string): string | null {
        let src = element.getAttribute("src") || "";

        const dataUrl = this.resolveAssetUrl(src);

        const base = (src.split("/").pop() || src).toLowerCase();
        if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null;

        const id = uuidv4();
        const styles = this.extractStyles(element, {});

        const width = element.getAttribute("width");
        const isSmallIcon = width && parseInt(width) <= 50;

        let blockStyle: any = {
            ...styles,
            padding: styles.padding || { top: 0, right: 0, bottom: 0, left: 0 },
            textAlign: styles.textAlign || "center",
        }

        if (isSmallIcon) {
            blockStyle.display = "inline-block";
            if (!blockStyle.margin) {
                blockStyle.margin = { top: 0, right: 0, bottom: 0, left: 0 };
            }
        }

        this.blocks[id] = {
            type: "Image",
            data: {
                style: blockStyle,
                props: {
                    url: dataUrl,
                    alt: element.getAttribute("alt") || "Imagen",
                    linkHref: linkHref || undefined,
                    width: width ? parseInt(width) : undefined,
                    height: element.getAttribute("height") ?
                        parseInt(element.getAttribute("height")!) : undefined,
                    contentAlignment: "middle",

                }
            }
        };
        return id;
    }

    /*     private createImageBlock(element: Element, linkHref?: string): string | null {
            const PLACEHOLDER_IMG = 'https://placehold.net/default.png';
            let src = element.getAttribute("src") || "";
            if (!src) src = PLACEHOLDER_IMG;
    
            const base = (src.split("/").pop() || src).toLowerCase();
            if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null;
    
            let dataUrl: string | undefined;
            let fileName: string;
    
            if (src.startsWith("http")) {
                try {
                    const url = new URL(src);
                    fileName = url.pathname.split("/").pop() || "";
                } catch (error) {
                    fileName = src.split("/").pop() || "";
                }
                const baseName = fileName.toLowerCase().split('?')[0];
                dataUrl = this.imageMap.get(baseName);
    
                if (!dataUrl) {
                    dataUrl = src;
                };
            } else {
                fileName = src.split("/").pop() || src;
                const baseName = fileName.toLowerCase().split('?')[0];
                dataUrl = this.imageMap.get(baseName);
    
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
                dataUrl = PLACEHOLDER_IMG;
            }
    
            const id = uuidv4();
            const styles = this.extractStyles(element, {});
    
            const width = element.getAttribute("width");
            const isSmallIcon = width && parseInt(width) <= 50;
    
            let blockStyle: any = {
                ...styles,
                padding: styles.padding || { top: 0, right: 0, bottom: 0, left: 0 },
                textAlign: styles.textAlign || "center",
            }
    
            if (isSmallIcon) {
                blockStyle.display = "inline-block";
                if (!blockStyle.margin) {
                    blockStyle.margin = { top: 0, right: 0, bottom: 0, left: 0 };
                }
            }
    
            this.blocks[id] = {
                type: "Image",
                data: {
                    style: blockStyle,
                    props: {
                        url: dataUrl,
                        alt: element.getAttribute("alt") || "Imagen",
                        linkHref: linkHref || undefined,
                        width: width ? parseInt(width) : undefined,
                        height: element.getAttribute("height") ?
                            parseInt(element.getAttribute("height")!) : undefined,
                        contentAlignment: "middle",
    
                    }
                }
            };
            return id;
        } */

    private createButtonBlock(element: Element, styles: any): string {
        const id = uuidv4();
        const text = element.textContent?.trim() || "Button";
        const href = element.getAttribute("href") || "#";
        const defaultPadding = { top: 16, bottom: 16, left: 24, right: 24 };
        const finalPadding = styles.padding || defaultPadding;

        this.blocks[id] = {
            type: "Button",
            data: {
                style: {
                    ...styles,
                    padding: finalPadding
                },
                props: { text, url: href }
            }
        };
        return id;
    }

    private createBarBlock(color: string, height?: number): string {
        const id = uuidv4();
        const pad = Math.max(0, Math.floor((height || 20) / 2));
        this.blocks[id] = {
            type: "Container",
            data: {
                style: {
                    backgroundColor: StyleUtils.normalizeColor(color),
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

        // 1. Normalización inicial
        const s = StyleUtils.normalizeStyles(styles || {});

        // Helpers para extracción segura de valores numéricos
        const getVal = (v1: any, v2?: any) => {  
            let val = v1 !== undefined ? v1 : v2;  
                
            // 🔥 FIX: Si es un array, tomar el primer valor  
            if (Array.isArray(val)) {  
                console.log('🔍 Padding es array, usando primer valor:', val);  
                val = val[0];  
            }  
                
            return parseInt(String(val || 0).replace(/px/g, '').trim()) || 0;  
        };
        const getRaw = (v1: any, v2?: any) => v1 !== undefined ? v1 : v2;

        // 2. Cálculo de valores seguros (garantiza que sean objetos {top, right...})
        const safePadding = {
            top: getVal(s.paddingTop, s.padding?.top),
            right: getVal(s.paddingRight, s.padding?.right),
            bottom: getVal(s.paddingBottom, s.padding?.bottom),
            left: getVal(s.paddingLeft, s.padding?.left)
        };

        const safeMargin = {
            top: getVal(s.marginTop, s.margin?.top),
            right: getVal(s.marginRight, s.margin?.right),
            bottom: getVal(s.marginBottom, s.margin?.bottom),
            left: getVal(s.marginLeft, s.margin?.left)
        };

        // 3. Construcción del Estilo Base
        const styleToApply: any = {
            ...s,
            display: s.display || "block",
            boxSizing: "border-box",
            // Forzamos que sean objetos desde el inicio
            padding: safePadding,
            margin: safeMargin,
            // Sincronización de propiedades planas
            paddingTop: safePadding.top + 'px',
            paddingRight: safePadding.right + 'px',
            paddingBottom: safePadding.bottom + 'px',
            paddingLeft: safePadding.left + 'px',
            marginTop: safeMargin.top + 'px',
            marginRight: safeMargin.right + 'px',
            marginBottom: safeMargin.bottom + 'px',
            marginLeft: safeMargin.left + 'px'
        };

        if (styles?.backgroundColor) styleToApply.backgroundColor = styles.backgroundColor;
        if (styles?.width) styleToApply.width = styles.width;

        // --- 4. LÓGICA DE CENTRADO UNIFICADA ---
        const align = s.align;
        const textAlign = s.textAlign;
        const rawMarginLeft = getRaw(s.marginLeft, s.margin?.left);
        const rawMarginRight = getRaw(s.marginRight, s.margin?.right);

        const isAlignedCenter = align === 'center' || textAlign === 'center' || textAlign === '-webkit-center';
        const isExplicitlyLeft = align === 'left' || s.float === 'left';
        // Check seguro de auto margin
        const isAutoMargin = String(rawMarginLeft).includes('auto') || String(rawMarginRight).includes('auto') || (typeof s.margin === 'string' && s.margin.includes('auto'));

        let shouldCenter = false;

        if (isAutoMargin || (s.width && isAlignedCenter && !isExplicitlyLeft)) {
            shouldCenter = true;

            styleToApply.marginLeft = "auto";
            styleToApply.marginRight = "auto";

            // 🔥 FIX CRÍTICO 1: Asegurar que margin sea objeto antes de tocarlo
            if (!styleToApply.margin || typeof styleToApply.margin !== 'object') {
                styleToApply.margin = { top: 0, bottom: 0, left: 0, right: 0 };
            }
            // Ahora es seguro asignar
            // @ts-ignore
            styleToApply.margin.left = "auto";
            // @ts-ignore
            styleToApply.margin.right = "auto";
        }

        // Configuración Flexbox si aplica
        if (styleToApply.display === "flex") {
            styleToApply.flexDirection = styleToApply.flexDirection || "row";
            styleToApply.justifyContent = styleToApply.justifyContent || "flex-start";
            styleToApply.alignItems = styleToApply.alignItems || "stretch";
            styleToApply.flexWrap = styleToApply.flexWrap || "nowrap";
            if (childrenIds.length > 1 && styleToApply.justifyContent === "center") {
                styleToApply.alignItems = "center";
            }
        }

        // --- 5. FUSIÓN (MERGE) CON HIJO ÚNICO ---
        if (childrenIds.length === 1) {
            const childId = childrenIds[0];
            const childBlock = this.blocks[childId];
            
            const isMergeableType = ['Container', 'Image', 'Text', 'Button'].includes(childBlock?.type);

            if (childBlock && isMergeableType) {
                const childStyle = childBlock.data.style || {};

                const pBg = styleToApply.backgroundColor ? String(styleToApply.backgroundColor).toLowerCase() : '';
                const cBg = childStyle.backgroundColor ? String(childStyle.backgroundColor).toLowerCase() : '';
                
                const parentHasBg = pBg && pBg !== 'transparent' && pBg !== '#ffffff' && pBg !== '#fff' && pBg !== 'rgba(0, 0, 0, 0)';
                const childHasBg = cBg && cBg !== 'transparent';

                const colorsAreSame = parentHasBg && pBg === cBg;
                const colorsAreDifferent = parentHasBg && childHasBg && !colorsAreSame;

                const childIsConstrained = childStyle.width && childStyle.width !== '100%' && childStyle.width !== '100.0%';
                
                const preventFusion = colorsAreDifferent || (parentHasBg && childIsConstrained && !colorsAreSame);

                if (!preventFusion) {
                    // === CASO A: FUSIÓN ACEPTADA (El padre absorbe al hijo) ===
                    const mergedStyle = { ...childStyle };

                    // Fusionar Padding
                    mergedStyle.paddingTop = this.mergePx(childStyle.paddingTop, safePadding.top);
                    mergedStyle.paddingBottom = this.mergePx(childStyle.paddingBottom, safePadding.bottom);
                    mergedStyle.paddingLeft = this.mergePx(childStyle.paddingLeft, safePadding.left);
                    mergedStyle.paddingRight = this.mergePx(childStyle.paddingRight, safePadding.right);

                    mergedStyle.padding = {
                        top: mergedStyle.paddingTop,
                        bottom: mergedStyle.paddingBottom,
                        left: mergedStyle.paddingLeft,
                        right: mergedStyle.paddingRight
                    };

                    // Heredar fondo del padre si el hijo no tiene
                    if (!childHasBg && parentHasBg) mergedStyle.backgroundColor = pBg;

                    // Aplicar centrado
                    if (shouldCenter) {
                        mergedStyle.marginLeft = "auto";
                        mergedStyle.marginRight = "auto";
                        mergedStyle.display = "block";
                        
                        // 🔥 FIX CRÍTICO 2 (FUSIÓN): Validar margin del hijo antes de tocar
                        if (!mergedStyle.margin || typeof mergedStyle.margin !== 'object') {
                            mergedStyle.margin = { top: 0, bottom: 0, left: 0, right: 0 };
                        }
                        // @ts-ignore
                        mergedStyle.margin.left = "auto";
                        // @ts-ignore
                        mergedStyle.margin.right = "auto";
                    }

                    // Heredar ancho del padre si el hijo es fluido
                    if (s.width && !childIsConstrained) {
                        mergedStyle.width = s.width;
                        if (s.maxWidth) mergedStyle.maxWidth = s.maxWidth;
                    }

                    // Actualizamos el bloque hijo y devolvemos su ID (eliminando el contenedor padre)
                    this.blocks[childId].data.style = mergedStyle;
                    return childId;
                }
                else {
                    // === CASO B: NO FUSIÓN (Mantenemos padre e hijo separados) ===
                    const currentChildStyle = { ...childBlock.data.style };

                    if (shouldCenter || childIsConstrained) {
                        currentChildStyle.marginLeft = "auto";
                        currentChildStyle.marginRight = "auto";
                        currentChildStyle.display = "block";

                        // 🔥 FIX CRÍTICO 3 (HIJO): Validar margin del hijo
                        if (!currentChildStyle.margin || typeof currentChildStyle.margin !== 'object') {
                            currentChildStyle.margin = { top: 0, bottom: 0, left: 0, right: 0 };
                        }
                        // @ts-ignore
                        currentChildStyle.margin.left = "auto";
                        // @ts-ignore
                        currentChildStyle.margin.right = "auto";

                        if (s.width && !currentChildStyle.width) {
                            currentChildStyle.width = s.width;
                        }
                    }

                    this.blocks[childId].data.style = currentChildStyle;

                    // Ajustes finales al padre si tiene fondo
                    if (parentHasBg) {
                        styleToApply.width = '100%';
                        styleToApply.maxWidth = '100%';
                        styleToApply.marginLeft = 0;
                        styleToApply.marginRight = 0;
                        
                        // 🔥 FIX CRÍTICO 4 (PADRE): Validar margin del padre
                        if (!styleToApply.margin || typeof styleToApply.margin !== 'object') {
                            styleToApply.margin = { top: 0, bottom: 0, left: 0, right: 0 };
                        }
                        // @ts-ignore
                        styleToApply.margin.left = 0;
                        // @ts-ignore
                        styleToApply.margin.right = 0;
                    }
                }
            }
        }

        // 6. Limpieza de padding redundante en hijos (Fix para Unlayer/Outlook)
        if (childrenIds.length > 0) {
            const pTop = parseInt(styleToApply.paddingTop) || 0;
            const pBottom = parseInt(styleToApply.paddingBottom) || 0;

            if (pTop > 0 || pBottom > 0) {
                childrenIds.forEach(childId => {
                    const child = this.blocks[childId];
                    if (!child || !child.data || !child.data.style) return;

                    const cStyle = child.data.style;
                    const cTop = parseInt(cStyle.paddingTop) || 0;
                    const cBottom = parseInt(cStyle.paddingBottom) || 0;

                    if (cTop === pTop && cTop > 0) {
                        cStyle.paddingTop = "0px";
                        // 🔥 FIX: Validar objeto padding antes de tocar
                        if (cStyle.padding && typeof cStyle.padding === 'object') cStyle.padding.top = 0;
                    }
                    if (cBottom === pBottom && cBottom > 0) {
                        cStyle.paddingBottom = "0px";
                        // 🔥 FIX: Validar objeto padding antes de tocar
                        if (cStyle.padding && typeof cStyle.padding === 'object') cStyle.padding.bottom = 0;
                    }
                });
            }
        }

        // 7. Crear y guardar el bloque
        this.blocks[id] = {
            type: "Container",
            data: {
                style: { ...styleToApply },
                props: { childrenIds }
            }
        };
        return id;
    }

    private mergePx(v1: any, v2: any): string {
        const clean = (v: any) => parseInt(String(v || 0).replace(/px/g, '').trim()) || 0;
        const maxVal = Math.max(clean(v1), clean(v2));
        return `${maxVal}px`;
    }

    private createFlexContainer(element: Element, styles: any): string {
        const childrenIds: string[] = [];
        this.processChildren(element, childrenIds, styles);

        const id = uuidv4();
        this.blocks[id] = {
            type: "Container",
            data: {
                style: {
                    ...styles,
                    display: 'flex',
                    flexDirection: styles.flexDirection || 'row',
                    justifyContent: styles.justifyContent || 'flex-start',
                    alignItems: styles.alignItems || 'stretch',
                    padding: { top: 0, bottom: 0, left: 0, right: 0 },

                },
                childrenIds
            }
        };
        return id;
    }

    /*     private createVideoBlock(element: Element): string | null {
            const src = element.getAttribute("src") || "";
            if (!src) return null;
    
            const dataUrl = this.mediaMap.get(src) || src;
            const id = uuidv4();
            const styles = this.extractStyles(element, {});
    
            this.blocks[id] = {
                type: "Video",
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
        } */

    /*     private createListBlock(element: Element, styles: any): string | null {
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
        } */

    private createGridContainer(element: Element, styles: any): string | null {
        const childrenIds: string[] = [];
        this.processChildren(element, childrenIds, styles);

        if (childrenIds.length === 0) return null;

        const id = uuidv4();
        this.blocks[id] = {
            type: "Container",
            data: {
                style: {
                    ...styles,
                    display: 'grid',
                    gridTemplateColumns: styles.gridTemplateColumns || 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: styles.gap || '16px',
                    padding: { top: 0, bottom: 0, left: 0, right: 0 }
                },
                childrenIds
            }
        };
        return id;
    }
    /* 
        private createAudioBlock(element: Element): string | null {
            const src = element.getAttribute("src") || "";
            if (!src) return null;
    
            const dataUrl = this.mediaMap.get(src) || src;
            const id = uuidv4();
            const styles = this.extractStyles(element, {});
    
            this.blocks[id] = {
                type: "Audio",
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
                type: "FormField",
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
        } */

    // Esta función se usa SOLO para pasar estilos a los hijos (processChildren)
/*     private filterInheritableStyles(styles: Record<string, any>): Record<string, any> {
        const inheritableProps = [
            "color", "fontFamily", "fontSize", "fontWeight",
            "fontStyle", "letterSpacing", "lineHeight",
            "textAlign", "textTransform", "visibility", "wordSpacing",
            "width", "maxWidth", "minWidth", "height",
            "align", "float",
            "backgroundColor", "backgroundImage", "backgroundRepeat", "backgroundSize", "backgroundPosition",
            "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
            "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
            "border", "borderTop", "borderBottom", "borderLeft", "borderRight",
            "borderRadius",
            "display"
        ];

        const filtered: Record<string, any> = {};
        inheritableProps.forEach(prop => {
            if (styles[prop] !== undefined) {
                filtered[prop] = styles[prop];
            }
        });
        return filtered;
    } */

        private filterInheritableStyles(styles: Record<string, any>): Record<string, any> {
        
        return styles;
    }

    public extractStyles(element: Element, inheritedStyles: Record<string, any> = {}): any {
        const styles: any = { ...inheritedStyles };
        const htmlElement = element as HTMLElement;
        const final: any = {};
        const tag = element.tagName.toLowerCase();
        const elClass = element.getAttribute("class");
        const elId = element.getAttribute("id");
        const elTag = element.tagName.toLowerCase();
        let mobileStyles = {};

        if (this.cssParser) {
            const external = this.cssParser.getStylesForElement(element);
            Object.assign(styles, external);
        }

        const inline = htmlElement.getAttribute("style");
        if (inline) {
            const parsedInline = StyleUtils.parseInlineStyles(inline);
            Object.assign(styles, parsedInline);
        }

        const bgAttr = htmlElement.getAttribute("bgcolor");
        if (bgAttr) styles["background-color"] = bgAttr;
        const alignAttr = htmlElement.getAttribute("align");
        if (alignAttr) {
            styles["align"] = alignAttr.toLowerCase();
            styles["text-align"] = alignAttr; // Centra el contenido interno

            if (!styles["text-align"]) {
                styles["text-align"] = alignAttr.toLowerCase();
            }

            if (!styles.textAlign) {
                styles.textAlign = alignAttr.toLowerCase();
            }
        }
        const valignAttr = htmlElement.getAttribute("valign");
        if (valignAttr) styles["vertical-align"] = valignAttr;
        const widthAttr = htmlElement.getAttribute("width");
        if (widthAttr) {
            styles["width"] = widthAttr.includes('%') ? widthAttr : `${widthAttr}px`;
        }
        const heightAttr = htmlElement.getAttribute("height");
        if (heightAttr) styles["height"] = heightAttr;

        const bordercolorAttr = htmlElement.getAttribute("bordercolor");  
        if (bordercolorAttr) {  
            styles["border-color"] = bordercolorAttr;  
        } 

        if (element.textContent?.includes('Order Now')) {
            console.log('--------------------------------');
            console.log('🕵️‍♂️ PARSEANDO BOTÓN "Order Now"');
            console.log('Estilo Inline Original:', element.getAttribute('style'));
            
            // Verifica si StyleUtils está matando el color
            const rawBorderColor = "rgb(224, 62, 45)";
            const normalized = StyleUtils.normalizeColor(rawBorderColor);
            console.log(`Prueba Normalize RGB: '${rawBorderColor}' ->`, normalized);
        }

        for (const prop in styles) {
            const value = styles[prop];
            if (typeof value === "object" && value !== null) {
                final[prop] = value;
                continue;
            }

            switch (prop.toLowerCase()) {
                case "color":
                case "background-color":
                    // Ahora retorna null si no es válido, lo cual es aceptado por COLOR_SCHEMA.nullable()
                    final[prop === 'color' ? 'color' : 'backgroundColor'] = StyleUtils.normalizeColor(value);
                    break;
                case "background":
                    final.backgroundColor = StyleUtils.normalizeColor(value);
                    break;
                case "font-size":
                    final.fontSize = StyleUtils.parseDimension(value);
                    break;
                case "font-weight":
                    final.fontWeight = StyleUtils.normalizeFontWeight(value);
                    break;
                case "font-family":
                    if (inheritedStyles.fontFamily && !value) {
                        final.fontFamily = inheritedStyles.fontFamily;
                    } else if (value) {
                        final.fontFamily = StyleUtils.normalizeFontFamily(value);
                    } else {
                        final.fontFamily = inheritedStyles.fontFamily || "MODERN_SANS";
                    }
                    break;
                case "font-style":
                    final.fontStyle = value;
                    break;
                case "line-height":
                    final.lineHeight = StyleUtils.parseLineHeight(value);
                    break;
                case "letter-spacing":
                    final.letterSpacing = StyleUtils.parseLetterSpacing(value);
                    break;
                case "text-decoration":
                    final.textDecoration = StyleUtils.normalizeTextDecoration(value);
                    break;
                case "text-transform":
                    final.textTransform = StyleUtils.normalizeTextTransform(value);
                    break;
                case "display":
                    final.display = StyleUtils.normalizeDisplay(value);
                    break;
                case "position":
                    final.position = StyleUtils.normalizePosition(value);
                    break;
                case "float":
                    final.float = StyleUtils.normalizeFloat(value);
                    break;
                case "clear":
                    final.clear = StyleUtils.normalizeClear(value);
                    break;
                case "overflow":
                    final.overflow = StyleUtils.normalizeOverflow(value);
                    break;
                case "z-index":
                    final.zIndex = StyleUtils.parseZIndex(value);
                    break;
                case "width":
                case "height":
                case "min-width":
                case "min-height":
                case "max-height":
                    final[prop] = StyleUtils.parseDimension(value);
                    break;
                case "max-width":
                    final.maxWidth = StyleUtils.parseDimension(value);
                    break;
                case "padding":
                    final.padding = StyleUtils.parseSpacing(value);
                    break;
                case "margin":
                    final.margin = StyleUtils.parseSpacing(value);
                    break;
                case "border":
                    const b = StyleUtils.parseBorder(value);
                    // Solo asignamos si parseBorder devolvió algo válido (no null)
                    if (b) {
                        final.border = b; 
                        final.borderWidth = b.width;
                        final.borderStyle = b.style;
                        final.borderColor = b.color;
                    }
                    break;

                case "border-width":
                    // Solo guardamos el ancho. NO creamos el objeto border artificialmente todavía.
                    final.borderWidth = StyleUtils.parseDimension(value);
                    break;

                case "border-style":
                    final.borderStyle = value;
                    break;

                case "border-color":
                    final.borderColor = StyleUtils.normalizeColor(value);
                    break;
                case "background-image":
                    if (value.includes("gradient")) {
                        final.backgroundImage = StyleUtils.parseGradient(value);
                    } else {
                        // Extracción y resolución de URL de imagen de fondo
                        const urlMatch = value.match(/url\(['"]?([^'")]+)['"]?\)/i);
                        if (urlMatch && urlMatch[1]) {
                            const originalUrl = urlMatch[1];

                            const resolvedUrl = this.resolveAssetUrl(originalUrl);
                            final.backgroundImage = `url('${resolvedUrl}')`;
                        } else {
                            final.backgroundImage = value;
                        }
                    }
                    break;
                case "box-shadow":
                    final.boxShadow = StyleUtils.parseBoxShadow(value);
                    break;
                case "text-shadow":
                    final.textShadow = value;
                    break;
                case "transform":
                    final.transform = StyleUtils.parseTransform(value);
                    break;
                case "animation":
                    final.animation = StyleUtils.parseAnimation(value, this.cssParser);
                    break;
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
                case "grid-template-columns":
                case "grid-template-rows":
                case "grid-gap":
                case "grid-column-gap":
                case "grid-row-gap":
                    final[prop] = value;
                    break;
                case "text-align":
                    final.textAlign = StyleUtils.normalizeTextAlign(value);
                    break;
                case "vertical-align":
                    final.verticalAlign = value;
                    break;
                case "visibility":
                    final.visibility = value === "hidden" ? "hidden" : "visible";
                    break;
                case "opacity":
                    final.opacity = parseFloat(value) || 1;
                    break;

                // Aseguramos capturar las propiedades individuales si vienen en el CSS
                case "padding-top": final.paddingTop = StyleUtils.parseDimension(value); break;
                case "padding-right": final.paddingRight = StyleUtils.parseDimension(value); break;
                case "padding-bottom": final.paddingBottom = StyleUtils.parseDimension(value); break;
                case "padding-left": final.paddingLeft = StyleUtils.parseDimension(value); break;

                case "margin-top": final.marginTop = StyleUtils.parseDimension(value); break;
                case "margin-right": final.marginRight = StyleUtils.parseDimension(value); break;
                case "margin-bottom": final.marginBottom = StyleUtils.parseDimension(value); break;
                case "margin-left": final.marginLeft = StyleUtils.parseDimension(value); break;
            }
        }

        if (tag === "strong" || tag === "b") final.fontWeight = "bold";
        if (tag === "em" || tag === "i") final.fontStyle = "italic";
        if (tag === "u") final.textDecoration = "underline";
        if (tag === "a") final.textDecoration = "underline";
        if (tag === "strike" || tag === "s" || tag === "del") final.textDecoration = "line-through";

        if (!final.fontFamily && inheritedStyles.fontFamily) {
            final.fontFamily = inheritedStyles.fontFamily;
        }

        if (!final.border) {
            const w = final.borderWidth;
            const s = final.borderStyle;
            const c = final.borderColor;

            const hasWidth = w && w !== '0px' && w !== '0' && w !== 'none';
            const hasStyle = s && s !== 'none' && s !== 'hidden';
            
            if (hasWidth || hasStyle || (c && c !== 'transparent')) {
                final.border = {
                    width: w || '1px',
                    style: s || 'solid',
                    color: c || '#000000'
                };
            }
        }   

        const normalized = StyleUtils.normalizeStyles(final) || {};

        // LISTA BLANCA (Actualizada con todas las propiedades necesarias)
        const supportedProperties = [
            // Texto y Fuentes
            'color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'letterSpacing', 'lineHeight', 'textAlign', 'textDecoration',
            'textTransform', 'textShadow', 'wordSpacing',

            // Dimensiones
            'width', 'minWidth', 'maxWidth',
            'height', 'minHeight', 'maxHeight',

            // Espaciado (Expandido)
            'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
            'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',

            // Bordes y Esquinas
            'border', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
            'borderTop', 'borderBottom', 'borderLeft', 'borderRight',

            // Fondo
            'background', 'backgroundColor',
            'backgroundImage', 'backgroundRepeat', 'backgroundSize', 'backgroundPosition',

            // Layout y Posicionamiento
            'display', 'align', 'verticalAlign',
            'float', 'clear', 'position', 'zIndex',
            'overflow', 'visibility', 'opacity'
        ];

        const filteredFinal: any = {};
        supportedProperties.forEach(prop => {
            if (normalized[prop] !== undefined) {
                filteredFinal[prop] = normalized[prop];
            }
        });

        //  OVERRIDES POR ETIQUETA (Heurística final)
        if (tag === "strong" || tag === "b") filteredFinal.fontWeight = "bold";
        if (tag === "i" || tag === "em") filteredFinal.fontStyle = "italic";
        if (tag === "u") filteredFinal.textDecoration = "underline";
        if (tag === "strike" || tag === "s" || tag === "del") filteredFinal.textDecoration = "line-through";

        // Si el elemento es una celda de tabla, asegurar alineación vertical por defecto
        if (tag === "td" && !filteredFinal.verticalAlign) {
            filteredFinal.verticalAlign = "top"; // Estándar en emails
        }

        // 1. Buscar coincidencias por Tag
        if (this.mobileStylesMap.has(elTag)) {
            Object.assign(mobileStyles, this.mobileStylesMap.get(elTag));
        }

        // 2. Buscar coincidencias por Clase (soportamos múltiples clases)
        if (elClass) {
            const classes = elClass.split(/\s+/);
            classes.forEach(cls => {
                const selector = `.${cls}`;
                if (this.mobileStylesMap.has(selector)) {
                    Object.assign(mobileStyles, this.mobileStylesMap.get(selector));
                }
            });
        }

        // 3. Buscar coincidencias por ID (Prioridad máxima)
        if (elId) {
            const selector = `#${elId}`;
            if (this.mobileStylesMap.has(selector)) {
                Object.assign(mobileStyles, this.mobileStylesMap.get(selector));
            }
        }

        // Si encontramos algo, lo agregamos al objeto final
        if (Object.keys(mobileStyles).length > 0) {
            // Nota: Dependiendo de tu Editor, esto puede ir en 'mobileStyle' 
            // o mezclarse condicionalmente. Lo estándar es una propiedad separada.
            filteredFinal.mobileStyle = mobileStyles;
        }

        if (element.textContent?.includes('Order Now')) {
        console.log('✅ ESTILOS FINALES EXTRAÍDOS:', final);
        console.log('--------------------------------');
    }

        return filteredFinal;
    }

    /**
     * Extrae todos los atributos HTML que NO son estilos ni clases.
     * Útil para scripts, inputs, video, enlaces con data-attributes, etc.
     */
    public extractAttributes(element: Element): Record<string, string> {
        const attributes: Record<string, string> = {};
        
        if (element.hasAttributes()) {
            Array.from(element.attributes).forEach(attr => {
                const name = attr.name;
                const value = attr.value;

                // Ignoramos los que ya procesamos en otros lugares
                if (['style', 'class', 'id', 'width', 'height'].includes(name)) {
                    return;
                }

                attributes[name] = value;
            });
        }
        
        return attributes;
    }

    /**
     * Post-procesamiento: Aplana estructuras de contenedores redundantes.
     * Ejemplo: Div > Div > Div -> Div (con estilos fusionados)
     */
    private flattenRedundantContainers() {
        let changed = true;
        const protectedGrandchildTypes = ['Button', 'Image', 'Timer', 'Divider'];

        while (changed) {
            changed = false;
            const blockIds = Object.keys(this.blocks);

            for (const parentId of blockIds) {
                const parent = this.blocks[parentId];
                if (!parent) continue;

                // =================================================================
                // 🧹 FASE 1: RECOLECTOR DE BASURA (GARBAGE COLLECTOR)
                // =================================================================
                if (parent.data.props?.childrenIds) {
                    const cleanChildrenIds: string[] = [];
                    let childrenChanged = false;

                    for (const childId of parent.data.props.childrenIds) {
                        const child = this.blocks[childId];
                        
                        // Si el hijo no existe, lo saltamos
                        if (!child) { childrenChanged = true; continue; }

                        let shouldDelete = false;
                        const grandKids = child.data.props?.childrenIds || [];
                        const isEmpty = grandKids.length === 0;

                        // --- CASO A: TableRow o Table vacíos ---
                        // 🔥 NUEVO: Si es una fila o tabla y no tiene hijos, es basura inmediata.
                        if ((child.type === 'TableRow' || child.type === 'Table') && isEmpty) {
                            shouldDelete = true;
                        }

                        // --- CASO B: Container vacío ---
                        else if (child.type === 'Container' && isEmpty) {
                            const s = child.data.style || {};
                            
                            // Análisis de Invisibilidad
                            const isTrans = !s.backgroundColor || s.backgroundColor === 'transparent' || s.backgroundColor === null;
                            const hasImage = s.backgroundImage && s.backgroundImage !== 'none';
                            
                            // Borde
                            const bW = parseInt(String(s.borderWidth || s.border?.width || 0));
                            const hasBorder = bW > 0 && !String(s.borderColor).includes('transparent');
                            
                            // Altura: 🔥 FIX DEL PORCENTAJE (Ignorar 100%)
                            const hStr = String(s.height || s.minHeight || '0');
                            const hVal = parseInt(hStr);
                            const isPxHeight = !hStr.includes('%') && !isNaN(hVal) && hVal > 1;

                            // Contenido de texto
                            const hasContent = child.data.props.content || child.data.props.text;

                            if (isTrans && !hasBorder && !hasImage && !isPxHeight && !hasContent) {
                                shouldDelete = true;
                            }
                        }

                        // --- EJECUCIÓN DE BORRADO ---
                        if (shouldDelete) {
                            // console.log(`🗑️ Eliminando ${child.type} vacío: ${childId}`);
                            delete this.blocks[childId];
                            childrenChanged = true;
                            changed = true; 
                            continue; // No lo agregamos a cleanChildrenIds
                        }

                        cleanChildrenIds.push(childId);
                    }

                    if (childrenChanged) {
                        parent.data.props.childrenIds = cleanChildrenIds;
                        if (childrenChanged) changed = true;
                    }
                }

                // =================================================================
                // 🔨 FASE 2: FUSIÓN DE CONTENEDORES (Solo Parent = Container)
                // =================================================================
                
                if (parent.type !== 'Container') continue;

                const childrenIds = parent.data.props?.childrenIds || [];
                if (childrenIds.length !== 1) continue; 

                const childId = childrenIds[0];
                const child = this.blocks[childId];

                if (!child || child.type !== 'Container') continue;

                // A. Identidad
                if (child.data.props?.id || child.data.props?.className || child.data.props?.tagName === 'table') continue;

                const pStyle = parent.data.style || {};
                const cStyle = child.data.style || {};

                // B. Estructura (Ancho)
                const pWidth = String(pStyle.width || '100%');
                const cWidth = String(cStyle.width || '100%');

                if (cWidth !== '100%' && cWidth !== 'auto' && cWidth !== pWidth) continue; 

                // C. Nietos Complejos
                const grandChildrenIds = child.data.props?.childrenIds || [];
                if (grandChildrenIds.length > 0) {
                    const grandChildId = grandChildrenIds[0];
                    const grandChild = this.blocks[grandChildId];
                    if (grandChild && protectedGrandchildTypes.includes(grandChild.type)) continue; 
                }

                // D. Conflicto Visual
                const pBg = pStyle.backgroundColor;
                const cBg = cStyle.backgroundColor;
                const isParentTrans = !pBg || pBg === 'transparent' || pBg === 'rgba(0, 0, 0, 0)' || pBg === null;
                const isChildTrans = !cBg || cBg === 'transparent' || cBg === 'rgba(0, 0, 0, 0)' || cBg === null;

                if (!isParentTrans && !isChildTrans && pBg !== cBg) continue;

                const hasVisualBoundary = (cStyle.borderWidth && parseInt(String(cStyle.borderWidth)) > 0) || 
                                          (cStyle.border && cStyle.border !== 'none') ||
                                          cStyle.backgroundImage;
                if (hasVisualBoundary) continue;

                // === ¡FUSIÓN APROBADA! ===

                // 1. Heredar Nietos
                parent.data.props.childrenIds = child.data.props.childrenIds;

                // 2. Fusionar Estilos
                pStyle.padding = this.mergeSpacings(pStyle.padding, cStyle.padding);
                
                if (!isChildTrans) pStyle.backgroundColor = cBg;

                if ((!pStyle.width || pStyle.width === 'auto') && cStyle.width) {
                    pStyle.width = cStyle.width;
                } 
                if (cStyle.maxWidth) pStyle.maxWidth = cStyle.maxWidth;

                ['textAlign', 'verticalAlign', 'fontFamily', 'fontSize', 'lineHeight', 'color'].forEach(k => {
                    if (cStyle[k]) pStyle[k] = cStyle[k];
                });

                // 3. Matar Hijo
                delete this.blocks[childId];
                changed = true;
            }
        }
    }

    // Helper para sumar objetos de padding/margin
    private mergeSpacings(p1: any, p2: any) {
        // 1. Convertimos inputs a objeto {top, right...} numérico
        // (Ya no necesitamos la variable 'normalize' local)
        const o1 = StyleUtils.normalizePadding(p1);
        const o2 = StyleUtils.normalizePadding(p2);

        // 2. Sumamos matemáticamente
        return {
            top: o1.top + o2.top,
            right: o1.right + o2.right,
            bottom: o1.bottom + o2.bottom,
            left: o1.left + o2.left
        };
    }

    /**
     * Configurar modo de comparación
     */
    public setComparisonMode(enabled: boolean): void {
        this.comparisonMode = enabled;
        if (enabled) {
            console.log('%c[COMPARISON] Modo comparación activado', 'color: #FF9800; font-weight: bold;');
        }
    }

    /**
     * Obtener reporte de comparación
     */
    public getComparisonReport(): any {
        return this.comparisonSystem.generateReport();
    }

    /**
     * Imprimir reporte de comparación
     */
    public printComparisonReport(): void {
        this.comparisonSystem.printReport();
    }

    /**
     * Obtener estadísticas de logging
     */
    public getLogStats(): { errors: number; warnings: number } {
        return CriticalLogger.getStats();
    }

    private buildConfiguration(): TEditorConfiguration {
        const rootId = "root";

        Object.keys(this.blocks).forEach(blockId => {
            const block = this.blocks[blockId];
            if (block.data && block.data?.style) {
                const style = block.data.style;

                ['lineHeight', 'verticalAlign', 'textAlign', 'color', 'backgroundColor', 'borderColor'].forEach(prop => {
                    if (typeof style[prop] === 'string') {
                        style[prop] = style[prop].replace(/!important/gi, '').trim();
                        
                        // 🔥 UNIFICACIÓN: Si es transparent o inherit, lo tratamos como null o lo borramos
                        const valLower = style[prop].toLowerCase();
                        if (valLower === 'transparent' || valLower.includes('rgba(0,0,0,0)')) {
                            style[prop] = null;
                        } else if (valLower === 'inherit') {
                            delete style[prop];
                        }
                    }
                });

                // 2. NORMALIZACIÓN DE PADDING A NÚMEROS (Soluciona el error invalid_type)
                if (style.padding && typeof style.padding === 'object') {  
                    // 🔥 FIX: Validar que los valores no sean arrays  
                    ['top', 'right', 'bottom', 'left'].forEach(side => {  
                        if (Array.isArray(style.padding[side])) {  
                        console.warn('🔍 Padding.' + side + ' es array, convirtiendo:', style.padding[side]);  
                        style.padding[side] = parseInt(String(style.padding[side][0] || 0)) || 0;  
                        } else {  
                        style.padding[side] = parseInt(String(style.padding[side] || 0)) || 0;  
                        }  
                    });  
                }

                const colorProps = ['backgroundColor', 'color', 'borderColor'];
                
               colorProps.forEach(prop => {
                if (style[prop]) {
                    // Normalize to HEX using the improved util
                    const hex = StyleUtils.normalizeColor(String(style[prop]));
                    
                    // Final Regex Check para cumplir con el Schema
                    if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
                        style[prop] = hex;
                    } else {
                        // 🔥 Si no es un Hex válido (y ya filtramos transparent arriba), lo hacemos null
                        style[prop] = null; 
                        
                        // Fallback opcional solo para el texto base si quedó vacío
                        if (prop === 'color' && !style[prop]) style.color = '#000000';
                    }
                } else {
                    style[prop] = null; // Asegura consistencia si la prop no existe
                }
            });

                // 3. Fallback para verticalAlign (Enum 'top' | 'middle' | 'bottom')
                const validVA = ['top', 'middle', 'bottom'];
                if (style.verticalAlign && !validVA.includes(style.verticalAlign)) {
                    style.verticalAlign = 'top';
                }

                // 4. Asegurar que fontSize sea Number
                if (style.fontSize) {
                    style.fontSize = parseInt(String(style.fontSize)) || 16;
                }

                if (typeof style.fontSize === 'string') {
                    const num = parseInt(style.fontSize);
                    block.data.style.fontSize = isNaN(num) ? 16 : num;
                }

                if (style.fontWeight && !['bold', 'normal'].includes(style.fontWeight)) {
                    const weight = String(block.data.style.fontWeight);
                    block.data.style.fontWeight = (parseInt(weight) >= 600) ? 'bold' : 'normal';
                }

                const validTA = ['left', 'center', 'right'];
                if (!style.textAlign || !validTA.includes(style.textAlign)) {
                    // Si es 'inherit', intentamos usar el align de las props o 'left'
                    style.textAlign = block.data.props?.align || 'left';
                }


                if (style.borderRadius) {
                    const radius = parseInt(String(style.borderRadius));
                    style.borderRadius = isNaN(radius) ? 0 : radius;
                }

                // 7. CORRECCIÓN FONT FAMILY (Fallback seguro)
                // Asegura que siempre sea uno de los Enums permitidos (MODERN_SANS, etc.)
                if (style.fontFamily) {
                    style.fontFamily = StyleUtils.normalizeFontFamily(style.fontFamily);
                }
                
            }
        });

        const config = {
            [rootId]: {
                type: "EmailLayout" as const,
                data: {
                    backdropColor: "#F8F8F8",
                    canvasColor: "#FFFFFF",
                    textColor: "#242424",
                    fontFamily: "MODERN_SANS" as const,
                    childrenIds: this.childrenIds
                }
            },
            ...this.blocks
        } as unknown as TEditorConfiguration;;

        const validation = EditorConfigurationSchema.safeParse(config);
        if (!validation.success) {
            console.error('❌ Error de validación:', validation.error);
        }

        return config;
    }
}