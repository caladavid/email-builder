/* =========================================================
   ARCHIVO: StyleUtils.ts (CORREGIDO)
   ========================================================= */
import type { CSSParser, EnhancedCSSParser } from "./CSSParser";

export class StyleUtils {

    /**
     * MÉTODO PRINCIPAL: Extrae y normaliza todos los estilos de un elemento.
     * Combina atributos legacy (bgcolor, width) con estilos inline (style="...").
     * @param element El elemento del DOM a procesar
     * @param externalStyles (Opcional) Estilos externos calculados previamente
     */
    static extractUnifiedStyles(element: Element, externalStyles: Record<string, string> = {}): Record<string, any> {
        const styles: Record<string, any> = { ...externalStyles };
        const htmlElement = element as HTMLElement;
        const tag = element.tagName.toLowerCase();

        // 1. Parsear estilos inline (style="color: red;")
        const inlineAttr = htmlElement.getAttribute("style");
        if (inlineAttr) {
            const inlineStyles = this.parseInlineStyles(inlineAttr);
            Object.assign(styles, inlineStyles);
        }

        // 2. Mapear atributos HTML Legacy a estilos CSS
        const bgAttr = htmlElement.getAttribute("bgcolor");
        if (bgAttr) styles["background-color"] = bgAttr;
        
        const alignAttr = htmlElement.getAttribute("align");
        if (alignAttr) styles["text-align"] = alignAttr;
        
        const valignAttr = htmlElement.getAttribute("valign");
        if (valignAttr) styles["vertical-align"] = valignAttr;
        
        const widthAttr = htmlElement.getAttribute("width");
        if (widthAttr) {
            // Si es solo número, asumimos px. Si tiene %, lo dejamos.
            styles["width"] = widthAttr.includes('%') ? widthAttr : `${widthAttr.replace('px', '')}px`;
        }
        
        const heightAttr = htmlElement.getAttribute("height");
        if (heightAttr) {
            styles["height"] = heightAttr.includes('%') ? heightAttr : `${heightAttr.replace('px', '')}px`;
        }

        const borderAttr = htmlElement.getAttribute("border");
        if (borderAttr && parseInt(borderAttr) > 0) {
            styles["border-width"] = `${borderAttr}px`;
            styles["border-style"] = "solid";
        }

        // 3. Normalización y Limpieza (El gran switch)
        const final: Record<string, any> = {};

        for (const prop in styles) {
            const value = styles[prop];
            if (typeof value === "object" && value !== null) {
                final[prop] = value;
                continue;
            }
            if (!value) continue;

            switch (prop.toLowerCase()) {
                // Colores
                case "color":
                    final.color = this.normalizeColor(value);
                    break;
                case "background-color":
                case "background":
                    final.backgroundColor = this.normalizeColor(value);
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
                case "text-align":
                    final.textAlign = this.normalizeTextAlign(value);
                    break;

                // Dimensiones y Layout
                case "width":
                case "min-width":
                case "max-width":
                    const wVal = this.parseDimension(value);
                    if (wVal) final[this.camelCase(prop)] = wVal;
                    break;
                case "height":
                case "min-height":
                case "max-height":
                    const hVal = this.parseDimension(value);
                    if (hVal) final[this.camelCase(prop)] = hVal;
                    break;
                
                case "padding":
                    final.padding = this.parseSpacing(value);
                    break;
                case "margin":
                    final.margin = this.parseSpacing(value);
                    break;
                case "display":
                    final.display = this.normalizeDisplay(value);
                    break;
                
                // Bordes
                case "border":
                    final.border = this.parseBorder(value);
                    break;
                case "border-radius":
                    final.borderRadius = this.parseBorderRadius(value);
                    break;
                
                // Otros
                case "vertical-align":
                    final.verticalAlign = value;
                    break;
            }
        }

        // 4. Reglas específicas por Tag
        if (tag === "strong" || tag === "b") final.fontWeight = "bold";
        if (tag === "em" || tag === "i") final.fontStyle = "italic";
        if (tag === "u" || tag === "a") final.textDecoration = "underline";
        if (tag === "center") final.textAlign = "center";

        return final;
    }

    // --- Helpers Utilitarios (Los que ya tenías) ---

    static camelCase(str: string) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }

    static parseInlineStyles(inlineStyle: string): Record<string, string> {
        const s: Record<string, string> = {};
        const decl = inlineStyle.split(";").map((v) => v.trim()).filter(Boolean);
        
        decl.forEach((d) => {
            // CORRECCIÓN: Usar slice(1) para unir el resto si hay más de un ':' (ej: URLs)
            const parts = d.split(":");
            if (parts.length < 2) return;
            
            const prop = parts[0].trim().toLowerCase();
            const val = parts.slice(1).join(":").trim(); // Une el valor por si era una URL
            
            if (prop && val) s[prop] = val;
        });
        return s;
    }

    static hslToHex(hsl: string): string {  
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

    static rgbToHex(rgb: string): string {
        const m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return rgb;
        const [r, g, b] = m.map(Number);
        const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    static normalizeColor(color: string): string {  
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

    /**
     * Expande shorthands CSS (padding: 10px -> padding-top: 10px...)
     * y normaliza propiedades confusas.
     */
    static normalizeStyles(styles: any): any {
        const normalized = { ...styles };

        // 1. PADDING
        if (normalized.padding) {
            if (typeof normalized.padding === 'object') {
                // CASO A: Ya es un objeto (lo que muestra tu log)
                // Asignamos directamente si no existen las propiedades individuales
                if (normalized.paddingTop === undefined) normalized.paddingTop = normalized.padding.top;
                if (normalized.paddingRight === undefined) normalized.paddingRight = normalized.padding.right;
                if (normalized.paddingBottom === undefined) normalized.paddingBottom = normalized.padding.bottom;
                if (normalized.paddingLeft === undefined) normalized.paddingLeft = normalized.padding.left;
            } 
            else {
                // CASO B: Es un string "10px 20px" (Shorthand CSS)
                const p = this.expandSpacing(normalized.padding);
                if (p) {
                    if (normalized.paddingTop === undefined) normalized.paddingTop = p.top;
                    if (normalized.paddingRight === undefined) normalized.paddingRight = p.right;
                    if (normalized.paddingBottom === undefined) normalized.paddingBottom = p.bottom;
                    if (normalized.paddingLeft === undefined) normalized.paddingLeft = p.left;
                }
            }
        }

        // 2. MARGIN
        if (normalized.margin) {
            if (typeof normalized.margin === 'object') {
                if (normalized.marginTop === undefined) normalized.marginTop = normalized.margin.top;
                if (normalized.marginRight === undefined) normalized.marginRight = normalized.margin.right;
                if (normalized.marginBottom === undefined) normalized.marginBottom = normalized.margin.bottom;
                if (normalized.marginLeft === undefined) normalized.marginLeft = normalized.margin.left;
            } 
            else {
                const m = this.expandSpacing(normalized.margin);
                if (m) {
                    if (normalized.marginTop === undefined) normalized.marginTop = m.top;
                    if (normalized.marginRight === undefined) normalized.marginRight = m.right;
                    if (normalized.marginBottom === undefined) normalized.marginBottom = m.bottom;
                    if (normalized.marginLeft === undefined) normalized.marginLeft = m.left;
                }
            }
        }

        // 3. LIMPIEZA DE BASURA "[object" (Protección Extra)
        // Si por alguna razón anterior se coló un "[object", lo borramos para que no rompa el parseInt
        ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop'].forEach(k => {
            if (typeof normalized[k] === 'string' && normalized[k].includes('[object')) {
                delete normalized[k]; // Al borrarlo, createContainerBlock buscará en el objeto padding
            }
        });

        // 4. BORDER
        if (normalized.border) {
            if (String(normalized.border).includes('none') || String(normalized.border) === '0') {
                normalized.borderWidth = '0px';
                normalized.borderColor = 'transparent';
            }
        }

        return normalized;
    }

    // Helper para parsear "10px 20px 10px 20px"
    static expandSpacing(val: string | number): { top: string, right: string, bottom: string, left: string } | null {
        if (!val) return null;
        const v = String(val).trim();
        const parts = v.split(/\s+/);
        
        let t, r, b, l;

        if (parts.length === 1) { t = r = b = l = parts[0]; }
        else if (parts.length === 2) { t = b = parts[0]; r = l = parts[1]; }
        else if (parts.length === 3) { t = parts[0]; r = l = parts[1]; b = parts[2]; }
        else if (parts.length === 3) { 
            t = parts[0]; 
            r = parts[1]; // Derecha
            l = parts[1]; // Izquierda (toma el valor del medio)
            b = parts[2]; 
        }
        else { t = parts[0]; r = parts[1]; b = parts[2]; l = parts[3]; }

        return { top: t, right: r, bottom: b, left: l };
    }

    static parseDimension(dim: string): any {
        if (!dim) return undefined;
        const v = dim.trim().toLowerCase();
        if (v === 'auto' || v === 'inherit') return v;
        if (v.endsWith('%') || v.endsWith('px') || v.endsWith('em') || v.endsWith('vw') || v.endsWith('vh')) return v;
        // Si es numérico puro, agregar px
        if (!isNaN(Number(v))) return `${v}px`;
        return undefined;
    }

    static parseSpacing(spacing: string): any {
        if (!spacing) return { top: 0, right: 0, bottom: 0, left: 0 };
        const parts = spacing.trim().split(/\s+/).map(v => this.parseDimension(v) || '0px');
        
        if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
        if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
        if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] || parts[1] };
    }

    static normalizeTextAlign(val?: string) {
        const v = String(val || "").toLowerCase().trim();
        if (v === "justify") return "left";
        if (['left', 'center', 'right'].includes(v)) return v;
        return 'left';
    }

    static normalizeFontWeight(val: string): string {
        if (!val || val.trim() === "") return "normal";
        const v = val.toLowerCase().trim();
        
        // CORRECCIÓN: Incluimos '600' explícitamente en la lista de BOLD
        if (['bold', 'bolder', '600', '700', '800', '900'].includes(v)) return 'bold';
        
        if (['normal', '400', '300', 'lighter', '100', '200'].includes(v)) return 'normal';
        
        // Si es otro número (ej: 500), lo devolvemos tal cual por si acaso
        const numMatch = v.match(/^(\d+)$/);
        if (numMatch) return v;
        
        return "normal";
    }

    static normalizeFontStyle(val: string): string {
        return val.includes('italic') ? 'italic' : 'normal';
    }

    static normalizeTextDecoration(val: string): string {
        return val.includes('underline') ? 'underline' : 'none';
    }

    static normalizeTextTransform(val: string): string {
        return ['uppercase', 'lowercase', 'capitalize'].includes(val) ? val : 'none';
    }

    static normalizeDisplay(val: string): string {
        return ['block', 'inline-block', 'flex', 'grid', 'none'].includes(val) ? val : 'block';
    }

    static normalizeFontFamily(val: string): string {
        const v = val.toLowerCase();
        if (v.includes('sans-serif') || v.includes('arial') || v.includes('helvetica')) return 'MODERN_SANS';
        if (v.includes('times') || v.includes('georgia') || v.includes('serif')) return 'BOOK_ANTIQUA';
        if (v.includes('courier') || v.includes('mono')) return 'BOOK_ANTIQUA';
        return 'MODERN_SANS'; // Default
    }

    static parseLineHeight(val: string): any {
        if (!val) return undefined;
        if (val === 'normal') return undefined;
        return val; // Devolver string directo para que CSS lo maneje
    }

    static parseLetterSpacing(val: string): any {
        if (!val || val === 'normal') return undefined;
        return this.parseDimension(val);
    }

    static parseBorder(val: string): any {
        // Parseo simplificado de borde: "1px solid red"
        if (!val) return undefined;
        const parts = val.split(/\s+/);
        // Heurística simple
        const width = parts.find(p => p.includes('px')) || '1px';
        const style = parts.find(p => ['solid', 'dashed', 'dotted'].includes(p)) || 'solid';
        const color = parts.find(p => p.startsWith('#') || p.startsWith('rgb') || ['red', 'blue', 'black', 'white'].includes(p)) || '#000000';
        
        return { width: this.parseDimension(width), style, color: this.normalizeColor(color) };
    }

    static parseBorderRadius(value: string): any {
        if (!value) return undefined;
        const num = parseInt(String(value));
        return isNaN(num) ? 0 : num; 
    }

    static normalizePosition(value: any): string | undefined {
        if (!value) return undefined;
        const val = String(value).toLowerCase();
        return ['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(val) ? val : undefined;
    }

    static normalizeFloat(value: any): string | undefined {
        if (!value) return undefined;
        const val = String(value).toLowerCase();
        return ['left', 'right', 'none', 'inline-start', 'inline-end'].includes(val) ? val : undefined;
    }

    static normalizeClear(value: any): string | undefined {
        if (!value) return undefined;
        const val = String(value).toLowerCase();
        return ['none', 'left', 'right', 'both', 'inline-start', 'inline-end'].includes(val) ? val : undefined;
    }

    static normalizeOverflow(value: any): string | undefined {
        if (!value) return undefined;
        const val = String(value).toLowerCase();
        return ['visible', 'hidden', 'scroll', 'auto'].includes(val) ? val : undefined;
    }

    static parseZIndex(value: any): number | undefined {
        if (value === undefined || value === null || value === 'auto') return undefined;
        const parsed = parseInt(String(value), 10);
        return isNaN(parsed) ? undefined : parsed;
    }

    static parseGradient(value: string): string {
        // Validación básica de seguridad para evitar inyección, aunque en CSS es raro.
        // Permitimos linear-gradient, radial-gradient, etc.
        if (value.toLowerCase().includes('gradient')) {
            return value;
        }
        return '';
    }

    static parseBoxShadow(value: any): string | undefined {
        if (!value || value === 'none') return undefined;
        // Retornamos el valor tal cual, asumiendo que el navegador lo validará o ignorará si es inválido.
        return String(value);
    }

    static parseTransform(value: any): string | undefined {
        if (!value || value === 'none') return undefined;
        return String(value);
    }

    static parseAnimation(value: any, cssParser: any): string | undefined {
        // La animación es compleja porque depende de @keyframes definidos en el CSS global.
        // Por ahora, simplemente pasamos el valor. En una Fase 3 (Avanzada) podríamos
        // intentar extraer los keyframes y moverlos.
        if (!value || value === 'none') return undefined;
        return String(value);
    }
}