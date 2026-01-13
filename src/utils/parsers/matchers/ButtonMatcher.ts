import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";
import type { BlockMatcher, MatcherResult } from "./types";
import { v4 as uuidv4 } from "uuid";

export const ButtonMatcher: BlockMatcher = {
    name: "Button",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();
        if (tag !== "a") return false;
        if (element.querySelector("img")) return false;

        const styles = StyleUtils.extractUnifiedStyles(element);

        const hasBackground = styles.backgroundColor && 
                              styles.backgroundColor !== 'transparent' && 
                              styles.backgroundColor !== 'rgba(0, 0, 0, 0)';

        const hasBorder = styles.border && styles.border !== "none" && styles.border !== "0px";

        const hasPadding = styles.padding && (
            (typeof styles.padding === 'object' && (styles.padding.top > 2 || styles.padding.left > 2)) ||
            (typeof styles.padding === 'string' && parseInt(styles.padding) > 2)
        );

        return !!(hasBackground || hasBorder || hasPadding);
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = parser.extractStyles(element, inheritedStyles);

        const text = element.textContent?.trim() || "Button";
        const href = element.getAttribute("href") || "#";

        // Mapeo de alineación
        let alignment = "center";
        if (inheritedStyles.textAlign) {
            alignment = inheritedStyles.textAlign;
        }

        // Extraemos los colores para las props específicas
        const btnBgColor = styles.backgroundColor;
        const btnTextColor = styles.color || "#ffffff";

        const finalStyles: any = {
            ...styles,
            // 🔥 CLAVE: Eliminamos el backgroundColor del style principal
            // para que el div wrapper no se pinte de ese color.
            backgroundColor: undefined, 
            display: undefined, 
            textDecoration: "none",
            boxSizing: "border-box", 
            width: styles.width === '100%' ? '100%' : undefined,
            cursor: "pointer"
        };

        parser.addBlock(id, {
            type: "Button",
            data: {
                style: finalStyles,
                props: {
                    text: text,
                    url: href,
                    align: alignment,
                    // 🔥 Pasamos los colores aquí. El Reader los aplicará solo al <a>
                    buttonTextColor: btnTextColor,
                    buttonBackgroundColor: btnBgColor,
                    fullWidth: styles.width === '100%'
                }
            }
        });

        return { id };
    },
};