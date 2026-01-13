import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { StyleUtils } from "../StyleUtils";
import type { BlockMatcher, MatcherResult } from "./types";
import { v4 as uuidv4 } from "uuid";

export const ButtonMatcher: BlockMatcher = {
    name: "Button",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();

        // Focus on <a> tags for standard buttons
        if (tag !== "a") {
            return false;
        };

        // If it contains images, it is an Image Link, not a Text Button.
        if (element.querySelector("img")) {
            return false;
        }

        const styles = StyleUtils.extractUnifiedStyles(element);

        // Heuristic: Does it look like a button?
        // 1. Has background color (not transparent/white)
        const hasBackground = styles.backgroundColor && 
                              styles.backgroundColor !== 'transparent' && 
                              styles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                              styles.backgroundColor !== '#ffffff' && 
                              styles.backgroundColor !== 'white';

        // 2. Has visible border
        const hasBorder = styles.border && styles.border !== "none" && styles.border !== "0px";

        // 3. Has significant padding
        const hasPadding = styles.padding && (
            (typeof styles.padding === 'object' && (styles.padding.top > 2 || styles.padding.left > 2)) ||
            (typeof styles.padding === 'string' && parseInt(styles.padding) > 2)
        );

        return !!(hasBackground || hasBorder || hasPadding);
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);

        const text = element.textContent?.trim() || "Button";
        const href = element.getAttribute("href") || "#";

        // Background color safety for Zod schema
        let safeBgColor = styles.backgroundColor;
        if (!safeBgColor || safeBgColor === 'transparent' || safeBgColor === 'rgba(0, 0, 0, 0)') {
             if (styles.border && styles.border !== 'none') {
                 safeBgColor = undefined; // Ghost/Outline button
             } else {
                 safeBgColor = "#000000"; // Default fallback
             }
        }

        let alignment = "center";
        if (inheritedStyles.textAlign) {
            if (inheritedStyles.textAlign === 'left') alignment = "left";
            if (inheritedStyles.textAlign === 'right') alignment = "right";
        }

        const finalStyles: any = {
            ...styles,
            backgroundColor: null, // Handled via specific prop
            display: "inline-block", // Force inline-block to respect padding/width
            textDecoration: "none",
            boxSizing: "border-box", 
            width: styles.width === '100%' ? undefined : styles.width,
            cursor: "pointer"
        };

        if (!finalStyles.color) finalStyles.color = "#ffffff";
        if (finalStyles.lineHeight) delete finalStyles.lineHeight; 

        parser.addBlock(id, {
            type: "Button",
            data: {
                style: finalStyles,
                props: {
                    text: text,
                    url: href,
                    align: alignment,
                    buttonBackgroundColor: safeBgColor,
                    fullWidth: styles.width === '100%'
                }
            }
        });

        return { id };
    },
};