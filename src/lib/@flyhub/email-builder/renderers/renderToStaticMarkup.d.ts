type TReaderDocument = Record<string, Record<string, any>>;
type TOptions = {
    rootBlockId: string;
};
export default function renderToStaticMarkup(document: TReaderDocument, { rootBlockId }: TOptions): Promise<string>;
export {};
