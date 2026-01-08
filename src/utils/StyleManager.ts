// utils/StyleManager.ts

// Listas de Propiedades CSS clasificadas
const PROPS = {
    // Heredables (Tipografía, Alineación)
    INHERITABLE: [
        'color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 
        'letterSpacing', 'lineHeight', 'textAlign', 'textDecoration', 
        'textTransform', 'visibility', 'whiteSpace', 'wordBreak', 'wordWrap', 
        'direction', 'verticalAlign'
    ],
    // Espaciado (Box Model externo/interno)
    SPACING: [
        'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'
    ],
    // Visuales (Caja visible)
    VISUAL: [
        'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition',
        'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
        'borderColor', 'borderStyle', 'borderWidth', 
        'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
        'boxShadow', 'opacity', 'outline'
    ],
    // Dimensiones y Layout
    LAYOUT: [
        'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'float', 'clear', 'overflow', 'zIndex'
    ]
};

// Helper privado para convertir cualquier cosa a string seguro
const safeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).toLowerCase();
};

export const StyleManager = {
    // Exponemos las listas por si se necesitan fuera
    PROPS,

    /**
     * Limpia los estilos para pasarlos a los hijos (Herencia).
     * Mantiene Tipografía y Alineación. Borra Layout, Visuales y Espaciado.
     */
    getStylesForChildren(currentStyles: any): any {
        const cleanStyles: any = {};
        
        // 1. Copiar solo propiedades heredables seguras
        PROPS.INHERITABLE.forEach(prop => {
            if (currentStyles[prop] !== undefined && currentStyles[prop] !== null) {
                cleanStyles[prop] = currentStyles[prop];
            }
        });

        // 2. Excepción: A veces el ancho (width) es necesario que fluya si es %
        // Pero por defecto, en tu caso de "Pure Extraction", preferimos no pasar dimensiones físicas
        // para evitar conflictos de "cajas dentro de cajas".
        
        return cleanStyles;
    },

    /**
     * Detecta si un estilo tiene elementos visuales visibles.
     * A prueba de errores: Maneja undefined, null y números sin crashear.
     */
    hasVisualStyles(styles: any): boolean {
        if (!styles) return false;

        // 1. Background
        const bgCol = safeStr(styles.backgroundColor);
        const bgImg = safeStr(styles.backgroundImage);
        if (bgCol && bgCol !== 'transparent' && bgCol !== 'rgba(0, 0, 0, 0)') return true;
        if (bgImg && bgImg !== 'none' && bgImg !== 'url("")') return true;

        // 2. Border (Check inteligente)
        const border = safeStr(styles.border);
        const borderW = safeStr(styles.borderWidth);
        const borderS = safeStr(styles.borderStyle);
        
        if (border && !border.includes('none') && !border.includes('0px')) return true;
        if (borderW && parseInt(borderW) > 0) return true;
        if (borderS && borderS !== 'none' && borderS !== 'hidden') return true;

        // 3. Height (Espaciadores)
        if (styles.height) {
            const h = parseInt(safeStr(styles.height));
            if (!isNaN(h) && h > 0) return true;
        }

        return false;
    },

    /**
     * Normaliza un objeto de estilos completo.
     * - Convierte números a px (ej: width: 600 -> 600px)
     * - Asegura Box Sizing
     * - Elimina nulos/undefined
     */
    normalizeStyles(styles: any): any {
        const final: any = { ...styles };
        
        // Siempre Box Sizing
        final.boxSizing = 'border-box';

        // Normalización de Dimensiones (Unlayer a veces usa números crudos)
        ['width', 'height', 'maxWidth', 'minWidth'].forEach(prop => {
            if (final[prop] !== undefined) {
                const val = String(final[prop]);
                // Si es solo números (ej: "600"), agregar "px"
                if (/^\d+$/.test(val)) {
                    final[prop] = `${val}px`;
                }
            }
        });

        // Limpieza de basura
        Object.keys(final).forEach(key => {
            if (final[key] === undefined || final[key] === null || final[key] === '') {
                delete final[key];
            }
        });

        return final;
    },

    /**
     * Detecta conflictos de Layout para la Fusión.
     * Retorna TRUE si NO se deben fusionar.
     */
    checkLayoutConflict(parentStyles: any, childStyles: any): boolean {
        // Layout Padre Fluido?
        const pWidth = safeStr(parentStyles.width);
        const pIsFluid = !pWidth || pWidth === '100%' || pWidth === 'auto';

        // Layout Hijo Restringido?
        const cWidth = safeStr(childStyles.width);
        const cMaxW = safeStr(childStyles.maxWidth);
        const cIsConstrained = !!cMaxW || (cWidth && cWidth !== '100%' && cWidth !== 'auto');

        // Padre tiene Visuales?
        const pHasBg = this.hasVisualStyles(parentStyles);

        // CONFLICTO: El padre es el fondo fluido, el hijo es el contenido.
        // Si fusionamos, el fondo se corta al ancho del hijo.
        return pHasBg && pIsFluid && cIsConstrained;
    }
};