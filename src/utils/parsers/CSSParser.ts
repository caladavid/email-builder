/* =========================================================
   ARCHIVO: CSSParser.ts
   ========================================================= */

export class CSSParser {
    protected rules: { selector: string; styles: Record<string, string> }[] = [];

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

export class EnhancedCSSParser extends CSSParser {
    private fontFaces: string[] = [];
    private mediaQueries: string[] = [];
    private keyframes: Map<string, string> = new Map();

    constructor(cssContent: string) {
        super(cssContent);
        this.parseAdvancedCSS(cssContent);
    }

    private parseAdvancedCSS(cssContent: string) {
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