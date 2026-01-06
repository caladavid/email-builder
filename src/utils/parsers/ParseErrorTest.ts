import type { TEditorConfiguration } from "../../documents/editor/core";


export class ParseError extends Error {
    constructor(
        message: string,
        public type:  'ZIP_ERROR' | 'HTML_ERROR' | 'CSS_ERROR' | 'IMAGE_ERROR' | 'VALIDATION_ERROR', 
        public details?: any,
        public recoverable: boolean = true  
    ){
        super(message);
        this.name = "ParseError"
    }

}
export interface ParseResult {
    success: boolean;
    configuration?: TEditorConfiguration;
    errors: ParseError[];
    warnings: ParseError[]; 
}