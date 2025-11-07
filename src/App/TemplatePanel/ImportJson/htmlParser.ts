import JSZip, { type JSZipObject } from "jszip";
import { v4 as uuidv4 } from "uuid";
import { EditorConfigurationSchema, type TEditorConfiguration } from "../../../documents/editor/core";

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
                /* selector inválido → ignorar */
            }
        });
        return matchingStyles;
    }
}

/* =========================================================
   HTMLToBlockParser
   ========================================================= */
export class HTMLToBlockParser {
    private imageMap: Map<string, string> = new Map();
    private blocks: Record<string, any> = {};
    private childrenIds: string[] = [];
    private processedElements: WeakSet<Element> = new WeakSet();
    private cssParser: CSSParser | null = null;

    /* ---------------- ZIP → Blocks ---------------- */
    async parseZipToBlocks(zipFile: File): Promise<TEditorConfiguration> {
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipFile);

        await this.processImages(contents);
        const styleContent = await this.extractAndProcessStyles(contents);
        this.cssParser = new CSSParser(styleContent);

        let htmlFile: JSZipObject | null = null;
        contents.forEach((_rel, file) => {
            if (!file.dir && file.name.toLowerCase().endsWith("index.html")) htmlFile = file;
        });
        if (!htmlFile) throw new Error("No se encontró archivo HTML en el ZIP");

        const htmlContent = await (htmlFile as JSZipObject).async("string");
        return this.parseHtmlToBlocks(htmlContent);
    }

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
        const exts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];
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
                    console.warn(`Error procesando imagen ${path}:`, e);
                }
            })
        ).then(() => undefined);
    }

    private normalizeTextAlign(val?: string) {
        const v = String(val || "").toLowerCase();
        return v === "justify" ? "left" : v; // clamp
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
                    console.warn(`Error procesando CSS ${p}:`, e);
                }
            })
        );
        return all;
    }

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
            const img = element.querySelector("img");
            if (img && element.children.length === 1) {
                return this.createImageBlock(img, element.getAttribute("href") || "#");
            }
        }

        switch (tagName) {
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                return this.createHeadingBlock(element, currentStyles);

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
                const hasChildren = element.children.length > 0;

                // (A) <p> completamente inline → Text
                if (tagName === "p" && this.isInlineOnly(element)) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (B) td/div/span con un único <p> inline → Text
                if ((tagName === "td" || tagName === "div" || tagName === "span") && this.hasSingleInlineP(element)) {
                    const pEl = element.children[0] as Element;
                    const { text, formats } = this.processInlineContent(pEl, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (C) td/div/span completamente inline → Text
                if (
                    (tagName === "td" || tagName === "div" || tagName === "span") &&
                    this.isInlineOnly(element) &&
                    !this.elementContainsOtherBlockTypes(element)
                ) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    if (text.length) return this.createTextBlock(text, formats, currentStyles);
                }

                // (D) Texto directo sin otros bloques → Text
                const textContent = this.getDirectTextContent(element);
                if (textContent.length > 0 && !this.elementContainsOtherBlockTypes(element)) {
                    const { text, formats } = this.processInlineContent(element, currentStyles);
                    return this.createTextBlock(text, formats, currentStyles);
                }

                // (E) TD con “botón” (fondo + <a><img/>) → solo la imagen, envuelta a la izquierda
                if (tagName === "td" && this.isButtonLikeCell(element) && element.querySelector("a img")) {
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

                // (F) Contenedor genérico
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

                    formats.push(fmt);
                }
            }
        });

        text = text.replace(/[ \t]+\n/g, "\n").trimEnd();
        return { text: text.trim(), formats };
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
        Array.from(parentElement.children).forEach((child) => {
            const id = this.processElement(child as Element, inheritedStyles);
            if (id) targetArray.push(id);
        });
    }

    /** Detecta tablas por filas aunque la primera sea 1×1 (barras de color, etc.) */
    private isColumnsTable(element: Element): boolean {
        const rows = Array.from(element.querySelectorAll(":scope > tbody > tr, :scope > tr"));
        if (rows.length === 0) return false;

        const hasMultiCellRow = rows.some((r) => r.querySelectorAll(":scope > td").length > 1);

        const hasBarRow = rows.some((r) => {
            const tds = Array.from(r.querySelectorAll(":scope > td"));
            if (tds.length !== 1) return false;
            const td = tds[0];
            const textLen = this.collectText(td).length;
            const st = this.extractStyles(td, {});
            const bg = (st?.backgroundColor || "").toString();
            return textLen === 0 && !!bg; // barra de color
        });

        return hasMultiCellRow || hasBarRow || rows.length > 1;
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

        const base = (src.split("/").pop() || src).toLowerCase();
        if (/^blanco\.(png|gif|jpg|jpeg)$/.test(base)) return null;

        const dataUrl =
            this.imageMap.get(src.split("/").pop() || src) || this.imageMap.get(base);
        if (!dataUrl) return null;

        const id = uuidv4();
        const styles = this.extractStyles(element, {});
        this.blocks[id] = {
            type: "Image",
            data: {
                style: { ...styles, padding: { top: 16, bottom: 16, left: 24, right: 24 } },
                props: {
                    url: dataUrl,
                    alt: element.getAttribute("alt") || "",
                    linkHref,
                    width: element.getAttribute("width") ? parseInt(element.getAttribute("width")!) : undefined,
                    height: element.getAttribute("height") ? parseInt(element.getAttribute("height")!) : undefined,
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

        if (!final.color) final.color = "#242424";
        if (!final.backgroundColor) final.backgroundColor = "#FFFFFF";

        return final;
    }

    private parseInlineStyles(inlineStyle: string): Record<string, string> {
        const s: Record<string, string> = {};
        const decl = inlineStyle.split(";").map((v) => v.trim()).filter(Boolean);
        decl.forEach((d) => {
            const [prop, val] = d.split(":").map((v) => v.trim());
            if (prop && val) s[prop.toLowerCase()] = val;
        });
        return s;
    }

    private normalizeColor(color: string): string {
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
    }

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

    /* ---------------- Build final configuration ---------------- */
    private buildConfiguration(): TEditorConfiguration {
        const rootId = "root";
        /* return {
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
        }; */

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
    }
}
