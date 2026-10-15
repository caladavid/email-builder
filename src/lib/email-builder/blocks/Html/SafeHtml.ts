import { defineComponent, h } from 'vue';
import Html from '@flyhub/email-block-html';
import { sanitizeTemplateHtml } from '../../../../utils/htmlSecurity';

// @flyhub/email-block-html renders props.props.contents with a raw innerHTML,
// in the builder's own DOM (Reader preview, EditorBlock, SSR export). Wrap it
// so the contents go through the same template sanitizer as imports, which
// keeps Outlook conditional comments (DOMPurify would drop them).
export default defineComponent({
  name: 'SafeHtml',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => {
      const p = ((attrs as any).props ?? {}) as Record<string, any>;
      const contents = typeof p.contents === 'string' ? sanitizeTemplateHtml(p.contents) : p.contents;
      return h(Html as any, { ...attrs, props: { ...p, contents } });
    };
  },
});
