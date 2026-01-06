// src/parsers/matchers/types.ts
import type { HTMLToBlockParser } from "../HTMLToBlockParser";

export interface MatcherResult {
    id: string;
    // En el futuro aquí podrías retornar warnings o metadata extra
}

export interface BlockMatcher {
    /** Identificador único del tipo de bloque (ej: 'Image', 'Button') */
    name: string; 

    /** * Equivalente a `isComponent` de GrapesJS.
     * Determina si este Matcher debe hacerse cargo del nodo DOM.
     */
    isComponent: (element: Element, parser: HTMLToBlockParser) => boolean;

    /**
     * Parsea el nodo y crea el bloque.
     * Debe llamar a `parser.addBlock(...)` internamente.
     */
    fromElement: (element: Element, parser: HTMLToBlockParser, inheritedStyles: any) => MatcherResult | null;
}