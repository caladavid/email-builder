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

    public static normalizeColor(value: any): string | null {
        if (!value || typeof value !== 'string') return null;
        
        let color = value.trim().toLowerCase();

        // 1. Manejo de Transparent (El esquema permite null)
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)' ) {
            return null; 
        }

        // 2. Convertir RGB/RGBA a Hex
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0]);
                const g = parseInt(match[1]);
                const b = parseInt(match[2]);
                // Convertir a hex
                color = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
        }

        // 3. Expandir Hex de 3 dígitos (#fff -> #ffffff)
        if (/^#[0-9a-f]{3}$/.test(color)) {
            color = "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }

        // 4. Validación final contra el Regex de Flyhub
        if (/^#[0-9a-f]{6}$/.test(color)) {
            return color.toUpperCase(); // Estandarizar a mayúsculas
        }

        return null; // Si falla, mejor null que un error de Zod
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
                // 🔥 FIX: Detectar y convertir arrays  
                ['top', 'right', 'bottom', 'left'].forEach(side => {  
                    if (Array.isArray(normalized.padding[side])) {  
                        console.warn('🔍 Padding.' + side + ' es array en normalizeStyles:', normalized.padding[side]);  
                        normalized.padding[side] = normalized.padding[side][0] || 0;  
                    }  
                    // Asegurar que sea string para compatibilidad  
                    if (typeof normalized.padding[side] === 'number') {  
                        normalized.padding[side] = String(normalized.padding[side]) + 'px';  
                    }  
                });  
                
                if (normalized.paddingTop === undefined) normalized.paddingTop = normalized.padding.top;  
                if (normalized.paddingRight === undefined) normalized.paddingRight = normalized.padding.right;  
                if (normalized.paddingBottom === undefined) normalized.paddingBottom = normalized.padding.bottom;  
                if (normalized.paddingLeft === undefined) normalized.paddingLeft = normalized.padding.left;  
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
                normalized.borderColor = null;
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

    static parseSpacing(val: string | number): { top: string, right: string, bottom: string, left: string } | null {  
        if (!val) return null;  
        
        // 🔥 FIX: Si ya es un objeto con propiedades numéricas, convertirlo  
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {  
            return {  
                top: String(val.top || 0),  
                right: String(val.right || 0),   
                bottom: String(val.bottom || 0),  
                left: String(val.left || 0)  
            };  
        }  
        
        const v = String(val).trim();  
        const parts = v.split(/\s+/);  
        
        let t, r, b, l;  
        if (parts.length === 1) { t = r = b = l = parts[0]; }  
        else if (parts.length === 2) { t = b = parts[0]; r = l = parts[1]; }  
        else if (parts.length === 3) { t = parts[0]; r = l = parts[1]; b = parts[2]; }  
        else { t = parts[0]; r = parts[1]; b = parts[2]; l = parts[3]; }  
    
        return { top: t, right: r, bottom: b, left: l };  
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

    public static parseBorder(value: any): { width: string; style: string; color: string } | null {
        if (!value || typeof value !== 'string') return null;
        const clean = value.toLowerCase().trim();

        // 1. Filtros de Salida Rápida
        if (clean === 'none' || clean === 'hidden' || clean === '0' || clean === '0px') {
            return null;
        }

        // Valores por defecto "seguros" (si falta el color, transparente es mejor que negro)
        let width = '1px';
        let style = 'solid';
        let color = null; // 🔥 CAMBIO CLAVE: Antes era #000000

        // 2. Extraer Color
        // Detecta hex, rgb, o nombres de color, ignorando palabras clave de estilo
        const colorMatch = value.match(/(#[0-9a-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|transparent|[a-z]+)/gi);
        if (colorMatch) {
            // Filtramos keywords que parecen colores pero son estilos
            const keywords = ['solid', 'dashed', 'dotted', 'double', 'none', 'hidden', 'thin', 'medium', 'thick'];
            const found = colorMatch.find(c => !keywords.includes(c.toLowerCase()));
            if (found) {
                color = this.normalizeColor(found) || found;
            }
        }

        // 3. Extraer Ancho
        const widthMatch = value.match(/(\d+(?:\.\d+)?(?:px|em|rem|%)?|thin|medium|thick)/i);
        if (widthMatch) {
            width = widthMatch[0];
            // Si es '0' o '0px', invalidamos todo el borde
            if (parseFloat(width) === 0) return null;
            if (!isNaN(parseFloat(width)) && !width.match(/[a-z%]/i)) width += 'px';
        }

        // 4. Extraer Estilo
        const styleMatch = value.match(/(solid|dashed|dotted|double|groove|ridge|inset|outset)/i);
        if (styleMatch) {
            style = styleMatch[0].toLowerCase();
        }

        // Si el color sigue siendo transparente y no se definió explícitamente "transparent",
        // pero tenemos ancho y estilo, entonces sí usamos negro (estándar CSS).
        if (color === 'transparent' && !clean.includes('transparent')) {
             color = '#000000';
        }

        return { width, style, color };
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

    // En StyleUtils.ts

/**
 * Normaliza cualquier entrada de padding a un objeto { top, right, bottom, left } con números.
 * Soporta strings ("10px 20px"), objetos parciales y valores nulos.
 */
public static normalizePadding(input: any): { top: number, right: number, bottom: number, left: number } {
    const result = { top: 0, right: 0, bottom: 0, left: 0 };

    if (!input) return result;

    // 1. Si es un string CSS (ej: "10px" o "10px 20px")
    if (typeof input === 'string') {
        const parts = input.trim().split(/\s+/).map(p => parseInt(p, 10) || 0);
        switch (parts.length) {
            case 1: // "10px" -> Todo 10
                return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
            case 2: // "10px 20px" -> Y: 10, X: 20
                return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
            case 3: // "10px 20px 30px"
                return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
            case 4: // "10px 20px 30px 40px"
                return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
            default:
                return result;
        }
    }

    // 2. Si ya es un objeto (ej: { paddingTop: "10px", ... })
    if (typeof input === 'object') {
        const getVal = (keys: string[]) => {
            for (const key of keys) {
                if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
                    return parseInt(String(input[key]), 10) || 0;
                }
            }
            return 0;
        };

        result.top = getVal(['top', 'paddingTop', 'padding-top']);
        result.right = getVal(['right', 'paddingRight', 'padding-right']);
        result.bottom = getVal(['bottom', 'paddingBottom', 'padding-bottom']);
        result.left = getVal(['left', 'paddingLeft', 'padding-left']);
    }

    return result;
}
}