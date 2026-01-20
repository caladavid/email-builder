import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";
import type { BlockMatcher, MatcherResult } from "./types";
import { v4 as uuidv4 } from "uuid";

export const ButtonMatcher: BlockMatcher = {
    name: "Button",

    // Tu lógica isComponent funcionaba bien, la dejamos igual para no romper detección
    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();
        if (tag !== "a") return false;
        if (element.querySelector("img")) return false;

        const styles = StyleUtils.extractUnifiedStyles(element);
        const styleAttr = element.getAttribute('style') || '';

        const hasBackground = (styles.backgroundColor && 
                               styles.backgroundColor !== 'transparent' && 
                               styles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                               styles.backgroundColor !== '#ffffff' && 
                               styles.backgroundColor !== 'rgb(255, 255, 255)') ||
                               styleAttr.includes('background-color');

        let hasBorder = false;
        if (styles.border) {
            if (typeof styles.border === 'string') {
                hasBorder = styles.border !== "none" && !styles.border.includes('medium');
            } else if (typeof styles.border === 'object') {
                const b = styles.border as any;
                hasBorder = b.style !== 'none' && b.width !== '0px';
            }
        }
        if (!hasBorder) hasBorder = styleAttr.includes('border:');

        const hasButtonClass = element.className.toLowerCase().includes('button') || 
                               element.className.toLowerCase().includes('btn');

        return !!(hasBackground || hasBorder || hasButtonClass);
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        
        // 1. Extraemos todos los estilos mezclados (Inline + Heredados)
        const styles = parser.extractStyles(element, inheritedStyles);
        
        const text = element.textContent?.trim() || "Button";
        const href = element.getAttribute("href") || "#";
        const styleAttr = element.getAttribute('style') || '';

        // ---------------------------------------------------------
        // PASO 1: DETECTAR LOS ESTILOS DEL BOTÓN (ELEMENTO HIJO)
        // ---------------------------------------------------------
        
        // Background del Botón: Prioridad al inline style del elemento <a>
        let btnBgColor = styles.backgroundColor;
        // Si el parser nos da transparente/inválido, buscamos el real en el HTML
        if (!btnBgColor || btnBgColor === 'transparent' || btnBgColor === 'rgba(0, 0, 0, 0)') {
            const bgMatch = styleAttr.match(/background-color\s*:\s*([^;]+)/i);
            if (bgMatch && bgMatch[1]) btnBgColor = bgMatch[1].trim();
        }

        // Color del Texto del Botón
        let btnTextColor = styles.color;
        if (!btnTextColor || btnTextColor === '#000000') {
             const colorMatch = styleAttr.match(/(?<!background-)color\s*:\s*([^;]+)/i);
             if (colorMatch && colorMatch[1]) btnTextColor = colorMatch[1].trim();
        }
        // Fallback genérico para texto
        if ((!btnTextColor || btnTextColor === 'inherit') && btnBgColor) {
            btnTextColor = "#ffffff"; 
        }

        // Alineación
        let alignment = "center";
        if (inheritedStyles.textAlign) alignment = inheritedStyles.textAlign;
        if (styles.textAlign) alignment = styles.textAlign; // El estilo propio gana

        // ---------------------------------------------------------
        // PASO 2: LIMPIEZA Y PREPARACIÓN DEL WRAPPER (CONTENEDOR)
        // ---------------------------------------------------------
        
        // Clonamos styles para no mutar referencias
        const finalStyles: any = { ...styles };

        // 🔥 REGLA GENÉRICA: El Wrapper NO debe tener los estilos cosméticos del botón
        delete finalStyles.background;
        delete finalStyles.backgroundColor; 
        delete finalStyles.color;
        delete finalStyles.border;
        delete finalStyles.borderColor;
        delete finalStyles.borderWidth;
        delete finalStyles.borderStyle;
        delete finalStyles.textDecoration;
        
        // Resetear display para evitar comportamientos extraños
        finalStyles.display = undefined; 
        finalStyles.boxSizing = "border-box";
        finalStyles.width = styles.width === '100%' ? '100%' : undefined;
        finalStyles.cursor = "pointer";

        // 🔥 MAGIA DE LA HERENCIA:
        // Si el padre (inheritedStyles) tiene un color de fondo, el Wrapper debe tenerlo.
        // Si no, debe ser transparente.
        // Esto arregla el problema de la franja gris (#F0EFEF) sin hardcodear nada.
        
        if (inheritedStyles && inheritedStyles.backgroundColor && 
            inheritedStyles.backgroundColor !== 'transparent') {
            // Solo aplicamos el fondo del padre si es DIFERENTE al del botón.
            // (Si fueran iguales, da igual, pero mejor evitar pintar doble).
            if (inheritedStyles.backgroundColor !== btnBgColor) {
                finalStyles.backgroundColor = inheritedStyles.backgroundColor;
            }
        } else {
            // Si no hay herencia, transparente explícito
            finalStyles.backgroundColor = 'transparent';
        }

        // ---------------------------------------------------------
        // PASO 3: RECONSTRUCCIÓN DEL BORDE (SOLO PARA EL BOTÓN)
        // ---------------------------------------------------------
        
        // Recuperamos datos del borde del estilo original
        let borderWidth = styles.borderWidth;
        let borderStyle = styles.borderStyle;
        let borderColor = styles.borderColor;

        if (styles.border && typeof styles.border === 'object') {
            const b = styles.border as any;
            if (!borderWidth) borderWidth = b.width;
            if (!borderStyle) borderStyle = b.style;
            if (!borderColor) borderColor = b.color;
        }

        // Si existe un borde válido, lo preparamos para los props/estilos finales
        if (borderWidth && borderWidth !== 'medium' && borderWidth !== '0px') {
            finalStyles.borderWidth = borderWidth;
            finalStyles.borderStyle = borderStyle || 'solid';
            
            // Reparación de color inválido ("px" o null)
            if (!borderColor || borderColor === 'px' || borderColor === 'initial' || borderColor === 'null') {
                 const borderMatch = styleAttr.match(/border(?:-color)?:\s*[^;]+(#[0-9a-f]{3,6}|rgb\([^)]+\))/i);
                 if (borderMatch) {
                     borderColor = borderMatch[1];
                 } else {
                     borderColor = btnBgColor || 'transparent'; 
                 }
            }
            finalStyles.borderColor = borderColor;
        }

        // ---------------------------------------------------------
        // PASO 4: GENERACIÓN DEL BLOQUE
        // ---------------------------------------------------------

        parser.addBlock(id, {
            type: "Button",
            data: {
                // Style: Se aplica al Wrapper (<div>) -> Color heredado del padre (Gris)
                style: finalStyles,
                // Props: Se aplican al Botón (<a>) -> Color extraído del elemento (Naranja)
                props: {
                    text: text,
                    url: href,
                    align: alignment,
                    buttonTextColor: btnTextColor,
                    buttonBackgroundColor: btnBgColor,
                    fullWidth: styles.width === '100%'
                }
            }
        });

        return { id };
    },
};