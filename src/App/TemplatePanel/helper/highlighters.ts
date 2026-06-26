import hljs from 'highlight.js';
import 'highlight.js/styles/default.min.css';
import jsonHighlighter from 'highlight.js/lib/languages/json';
import xmlHighlighter from 'highlight.js/lib/languages/xml';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import { format } from 'prettier/standalone';
import DOMPurify from 'dompurify';

hljs.registerLanguage('json', jsonHighlighter);
hljs.registerLanguage('html', xmlHighlighter);

export async function html(value: string): Promise<string> {
  let source = value;
  try {
    source = await format(value, {
      parser: 'html',
      plugins: [prettierPluginHtml],
    });
  } catch {
    // Malformed HTML (mismatched tags, etc.) — skip formatting, highlight as-is
  }
  try {
    return DOMPurify.sanitize(hljs.highlight(source, { language: 'html' }).value);
  } catch {
    // Highlight also failed — return escaped plain text
    return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export async function json(value: string): Promise<string> {
  const prettyValue = await format(value, {
    parser: 'json',
    printWidth: 0,
    trailingComma: 'all',
    plugins: [prettierPluginBabel, prettierPluginEstree],
  });
  return DOMPurify.sanitize(hljs.highlight(prettyValue, { language: 'javascript' }).value);
}
