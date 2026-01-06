import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";
import type { BlockMatcher, MatcherResult } from "./types";
import { v4 as uuidv4 } from "uuid";

export const ButtonMatcher: BlockMatcher = {
    name: "Button",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();

        // A veces el botón es un <a>, a veces una <table> (VML/Outlook hacks)
        // Por simplicidad inicial, nos centraremos en el <a> principal.
        if (tag !== "a") {
            return false;
        };

        // Si contiene imágenes, NO es un botón de texto (es un link-imagen, ya cubierto por ImageMatcher)
        if (element.querySelector("img")) {
            return false;
        }

        const styles = StyleUtils.extractUnifiedStyles(element);

        // HEURÍSTICA: ¿Parece un botón?
        // 1. Tiene color de fondo (que no sea transparente/blanco)
        const hasBackground = styles.backgroundColor && 
                              styles.backgroundColor !== 'transparent' && 
                              styles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                              styles.backgroundColor !== '#ffffff' && 
                              styles.backgroundColor !== 'white';

        const hasBorder = styles.border && styles.border !== "none" && styles.border !== "0px";

        const hasPadding = styles.padding && (
            (typeof styles.padding === 'object' && (styles.padding.top > 2 || styles.padding.left > 2)) ||
            (typeof styles.padding === 'string' && parseInt(styles.padding) > 2)
        );

        return !!(hasBackground || hasBorder || hasPadding);
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);

        const text = element.textContent?.trim() || "Botón";
        const href = element.getAttribute("href") || "#";

        // Limpieza de estilos para el bloque Button
        // El bloque Button suele manejar su propio layout, así que a veces
        // conviene limpiar margins externos si el editor los pone por defecto.

        // Limpieza de estilos para Zod
        let safeBgColor = styles.backgroundColor;
        // Si no tiene color de fondo propio, le ponemos uno por defecto para que sea visible
        // (ya que ahora no hereda del padre)
        if (!safeBgColor || safeBgColor === 'transparent' || safeBgColor === 'rgba(0, 0, 0, 0)') {
             // Si tenía borde pero no fondo, quizás querían un botón ghost (transparente)
             if (styles.border && styles.border !== 'none') {
                 safeBgColor = undefined; 
             } else {
                 // Si no tiene ni borde ni fondo, le damos color negro por defecto
                 safeBgColor = "#000000"; 
             }
        }

        let alignment = "center";
        if (inheritedStyles.textAlign) {
            if (inheritedStyles.textAlign === 'left') alignment = "left";
            if (inheritedStyles.textAlign === 'right') alignment = "right";
        }
        // Si el propio botón tiene margin: auto, es center
        if (styles.margin === '0 auto' || styles.display === 'block') {
             // Ajuste fino según tu caso
        }

        const finalStyles: any = {
            ...styles,
            backgroundColor: undefined,
            display: "inline-block", // Forzamos inline-block para que respete paddings
            textDecoration: "none",
            boxSizing: "border-box", // Importante para que padding no rompa el ancho
            // width: lo dejamos tal cual viene del <a>. Si no trae, será auto.
            width: styles.width === '100%' ? undefined : styles.width,
            cursor: "pointer"
        };

        // Colores por defecto si falló la extracción
        if (!finalStyles.color) finalStyles.color = "#ffffff";

        // Limpieza final de propiedades que a veces molestan a Zod
        if (finalStyles.lineHeight) delete finalStyles.lineHeight; // A veces rompe el centrado vertical

        parser.addBlock(id, {
            type: "Button",
            data: {
                style: finalStyles,
                props: {
                    text: text,
                    url: href,
                    align: alignment, // Propiedad específica de muchos editores para alinear el botón
                    // Otras props comunes:
                    buttonBackgroundColor: styles.backgroundColor,
                    fullWidth: styles.width === '100%'
                }
            }
        });

        return { id };
    },
}