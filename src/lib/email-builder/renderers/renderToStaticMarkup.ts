import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import Reader  from '../Reader/core.vue';
import { h } from 'vue';

type TReaderDocument = Record<string, Record<string, any>>;
type TOptions = {
  rootBlockId: string;
};

export default async function renderToStaticMarkup(document: TReaderDocument, { rootBlockId }: TOptions) {
  const app = createSSRApp({
    render: () => h(Reader, { document, rootBlockId })
  });

  const html = await renderToString(app);

  return `<!DOCTYPE html><html><body>${html}</body></html>`.replace(/<!--[\[\]]-->/gm, '');
}
