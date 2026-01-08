import type { HTMLToBlockParser } from "../HTMLToBlockParser";
import { v4 as uuidv4 } from "uuid";
import { ImageMatcher } from "./ImageMatcher";
import type { BlockMatcher, MatcherResult } from "./types";
import { StyleUtils } from "../StyleUtils";

export const InlineIconsMatcher: BlockMatcher = {
    name: "InlineIcons",

    isComponent(element: Element) {
        const tag = element.tagName.toLowerCase();

        // Only analyze common flow containers
        if (!['td', 'div', 'p', 'span', 'center'].includes(tag)) return false;

        const children = element.childNodes;
        let validImagesCount = 0;
        let invalidContent = false;

        for (let index = 0; index < children.length; index++) {
            const node = children[index];

            if (node.nodeType === Node.TEXT_NODE) {
                // Check for visible text (ignoring whitespace)
                const text = node.textContent?.replace(/[\s\u00A0\n\r]/g, '') || '';
                if (text.length > 0) {
                    invalidContent = true; 
                    break;
                }
            }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                
                // Use ImageMatcher to validate if child is an image/wrapper
                if (ImageMatcher.isComponent(el)) {
                    validImagesCount++;
                } else if (el.tagName.toLowerCase() === 'br') {
                    // Ignore breaks
                } else {
                    // Abort if other content types found
                    invalidContent = true;
                    break; 
                }
            }
        }

        // Must have at least 2 images and no invalid text/elements
        return validImagesCount >= 2 && !invalidContent;
    },

    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any): MatcherResult | null => {
        const id = uuidv4();
        const styles = StyleUtils.extractUnifiedStyles(element, inheritedStyles);

        const validChildElements: Element[] = [];
        const children = element.children;

        for (let index = 0; index < children.length; index++) {
            if (children[index].tagName.toLowerCase() !== 'br') {
                validChildElements.push(children[index]);
            }
        }

        const columnsCount = validChildElements.length;
        const childBlocksIds: string[] = [];

        // Distribute icons into columns with specific alignment to simulate centering
        validChildElements.forEach((child, index) => {
            let imageStyles: any = {};

            if (columnsCount === 2) {
                if (index === 0) imageStyles = { align: "right", textAlign: "right", margin: "0 0 0 auto" };
                if (index === 1) imageStyles = { align: "left", textAlign: "left", margin: "0 auto 0 0" };
            } 
            else if (columnsCount === 3) {
                if (index === 0) imageStyles = { align: "right", textAlign: "right", margin: "0 0 0 auto" };
                if (index === 1) imageStyles = { align: "center", textAlign: "center", margin: "0 auto" };
                if (index === 2) imageStyles = { align: "left", textAlign: "left", margin: "0 auto 0 0" };
            }

            // Parse child with forced alignment styles
            const result = parser.parseElement(child, imageStyles);
            if (result) {
                childBlocksIds.push(result.id);
            }
        });

        const columnsData = childBlocksIds.map((childId) => ({
            style: {
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                verticalAlign: "middle",
            },
            childrenIds: [childId]
        }));

        let safeBgColor = styles.backgroundColor;
        if (safeBgColor === 'transparent' || !safeBgColor) {
            safeBgColor = undefined; 
        }

        const containerStyle = {
            ...styles,
            backgroundColor: safeBgColor,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            border: "none"
        };

        if (containerStyle.width === '100%') delete containerStyle.width;

        parser.addBlock(id, {
            type: "ColumnsContainer",
            data: {
                style: containerStyle,
                props: {
                    columnsCount: columnsCount,
                    columns: columnsData,
                    gap: 0, 
                    layout: "auto"
                }
            }
        });

        return { id };
    },
};