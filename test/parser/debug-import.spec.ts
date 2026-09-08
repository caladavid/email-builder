import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HTMLToBlockParser } from '../../src/utils/parsers/HTMLToBlockParser';

describe('debug real template import', () => {
  it('dumps blocks for banner + list', async () => {
    const html = readFileSync('C:/Users/DavidC/Desktop/Nuevo Documento de texto (6).txt', 'utf-8');
    const parser = new HTMLToBlockParser();
    const result = await parser.parseHtmlStringToBlocks(html);

    console.log('ERRORS', JSON.stringify(result.errors, null, 2));
    console.log('WARNINGS count', result.warnings.length);

    const cfg = result.configuration as any;
    if (!cfg) {
      console.log('NO CONFIGURATION RETURNED');
      return;
    }

    const findBlocks = (needle: string) => {
      return Object.entries(cfg).filter(([_id, b]: any) => {
        const txt = JSON.stringify(b);
        return txt.includes(needle);
      });
    };

    console.log('--- BANNER TEXT MATCHES ---');
    console.log(JSON.stringify(findBlocks('Multiplica tus conversiones'), null, 2));

    console.log('--- BANNER IMAGE MATCHES ---');
    console.log(JSON.stringify(findBlocks('1480_1785441165856'), null, 2));

    console.log('--- LIST ITEM MATCHES ---');
    console.log(JSON.stringify(findBlocks('Lograste redactar'), null, 2));

    // Walk reachability from root
    const root = cfg.root;
    const reachable = new Set<string>();
    const walk = (id: string) => {
      if (!id || reachable.has(id)) return;
      reachable.add(id);
      const b = cfg[id];
      if (!b) return;
      const props = b.data?.props || {};
      const kidLists: string[] = [];
      if (Array.isArray(props.childrenIds)) kidLists.push(...props.childrenIds);
      if (Array.isArray(props.columns)) {
        props.columns.forEach((c: any) => { if (Array.isArray(c.childrenIds)) kidLists.push(...c.childrenIds); });
      }
      kidLists.forEach(walk);
    };
    walk('root');

    console.log('--- TOTAL BLOCKS vs REACHABLE ---');
    console.log('total:', Object.keys(cfg).length, 'reachable:', reachable.size);

    const orphaned = Object.keys(cfg).filter(id => id !== 'root' && !reachable.has(id));
    console.log('--- ORPHANED BLOCK IDS (sample) ---');
    console.log(orphaned.slice(0, 30));

    const orphanedBannerOrList = orphaned.filter(id => {
      const txt = JSON.stringify(cfg[id]);
      return txt.includes('Multiplica') || txt.includes('1480_1785441165856') || txt.includes('Lograste');
    });
    console.log('--- ORPHANED BANNER/LIST BLOCKS ---');
    console.log(JSON.stringify(orphanedBannerOrList.map(id => ({ id, block: cfg[id] })), null, 2));
  });
});
