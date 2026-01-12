// src/utils/blockStyleUtils.ts

/**
 * Helper para convertir objeto de padding a string CSS
 */
export function getPaddingString(padding: any) {
  if (!padding) return undefined;
  if (typeof padding === 'object' && !Array.isArray(padding)) {
    const t = parseFloat(padding.top) || 0;
    const r = parseFloat(padding.right) || 0;
    const b = parseFloat(padding.bottom) || 0;
    const l = parseFloat(padding.left) || 0;
    return `${t}px ${r}px ${b}px ${l}px`;
  }
  return undefined;
}

/**
 * Helper para convertir objeto de margin a string CSS
 */
export function getMarginString(margin: any) {
  if (!margin) return undefined;
  if (typeof margin === 'object' && !Array.isArray(margin)) {
     const fmt = (v: any) => (v === 'auto' ? 'auto' : (parseFloat(v) || 0) + 'px');
     return `${fmt(margin.top)} ${fmt(margin.right)} ${fmt(margin.bottom)} ${fmt(margin.left)}`;
  }
  return undefined;
}

/**
 * Helper para bordes
 */
export function getBorder(style: any) {
   if (!style) return undefined;
   if (style.border && typeof style.border === 'object' && !Array.isArray(style.border)) {
       return `${style.border.width || 1}px ${style.border.style || 'solid'} ${style.border.color || null}`;
   }
   if (style.borderWidth || style.borderColor) {
       return `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || null}`;
   }
   return undefined;
}

/**
 * 🔥 LA FUNCIÓN MAESTRA DE LIMPIEZA
 * Toma el estilo sucio (con zombis) y devuelve el estilo limpio.
 * @param rawStyle El estilo que viene de props.style
 * @param defaults (Opcional) Valores por defecto específicos del bloque
 */
export function getCleanBlockStyle(rawStyle: any, defaults: any = {}) {
  // 1. CLONAR
  const finalStyle = { ...(rawStyle || {}) };

  // 2. CALCULAR SHORTHANDS
  const paddingStr = getPaddingString(finalStyle.padding);
  const marginStr = getMarginString(finalStyle.margin);

  // 3. EXTERMINAR ZOMBIES
  if (paddingStr) {
    delete finalStyle.paddingTop;
    delete finalStyle.paddingRight;
    delete finalStyle.paddingBottom;
    delete finalStyle.paddingLeft;
    finalStyle.padding = paddingStr;
  }

  if (marginStr) {
    delete finalStyle.marginTop;
    delete finalStyle.marginRight;
    delete finalStyle.marginBottom;
    delete finalStyle.marginLeft;
    finalStyle.margin = marginStr;
  }

  // 4. APLICAR DEFAULTS COMUNES
  finalStyle.boxSizing = 'border-box';
  
  // Bordes
  const borderVal = getBorder(finalStyle);
  if (borderVal) finalStyle.border = borderVal;
  
  if (finalStyle.borderRadius) finalStyle.borderRadius = `${finalStyle.borderRadius}px`;
  if (finalStyle.fontSize) finalStyle.fontSize = `${finalStyle.fontSize}px`;

  // 5. MERGE CON DEFAULTS ESPECÍFICOS DEL BLOQUE
  // (Ej: Un botón puede querer display: inline-block, un container display: block)
  return { ...defaults, ...finalStyle };
}