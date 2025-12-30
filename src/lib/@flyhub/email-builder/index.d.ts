export { default as renderToStaticMarkup } from './renderers/renderToStaticMarkup';
import Reader from './Reader/core.vue';
export type TReaderProps = {
    document: Record<string, any>;
    rootBlockId: string;
};
export type TReaderBlockProps = {
    document: Record<string, any>;
    id: string;
};
export { Reader };
