import juice from 'juice';
import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';

export class CSSProcessor {
    /**
     * Toma el HTML crudo y el CSS global (del ZIP o <style>)
     * y devuelve HTML con todos los estilos metidos dentro de las etiquetas (inline).
     */
    public static async process(html: string, css: string): Promise<string> {
        // 1. Limpieza y normalización de CSS con PostCSS
        // Esto arregla errores de sintaxis comunes en emails viejos
        const processedCss = await postcss()
            .process(css, { parser: safeParser, from: undefined })
            .then(result => result.css);

        // 2. Inlining con Juice
        // Juice toma el CSS y lo aplica a cada elemento HTML según su especificidad.
        // preserveMediaQueries: true es VITAL para que el diseño móvil no se rompa.
        const juiceOptions = {
            applyStyleTags: true,
            removeStyleTags: true,
            preserveMediaQueries: true,
            widthElements: ['table', 'td', 'img'],
            heightElements: ['img']
        } as any; // 👈 Forzamos el tipo aquí
        
        const inlinedHtml = juice.inlineContent(html, processedCss, juiceOptions);

        return inlinedHtml;
    }
}