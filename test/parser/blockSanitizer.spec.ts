import { describe, it, expect } from 'vitest';
import { sanitizeBlocks, SUPPORTED_BLOCK_TYPES } from '../../src/utils/parsers/blockSanitizer';

describe('sanitizeBlocks', () => {
  it('leaves supported block types unchanged', () => {
    const blocks = {
      'b1': { type: 'Text', data: { props: { text: 'hello' }, style: {} } },
      'b2': { type: 'Image', data: { props: { url: 'https://example.com/img.jpg' }, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['b1'].type).toBe('Text');
    expect(result['b2'].type).toBe('Image');
    expect(remapped).toHaveLength(0);
  });

  it('maps Separator to Divider', () => {
    const blocks = {
      'sep1': { type: 'Separator', data: { style: { borderColor: '#ccc' } } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['sep1'].type).toBe('Divider');
    expect(remapped[0]).toContain('Separator → Divider');
  });

  it('maps unknown type with children to Container', () => {
    // 'Carousel' — a genuinely unsupported type, not one of the real ones
    // (Video/List/ListItem now ARE supported, see SUPPORTED_BLOCK_TYPES below).
    const blocks = {
      'unknown1': { type: 'Carousel', data: { props: { childrenIds: ['child1'] }, style: {} } },
      'child1': { type: 'Text', data: { props: { text: 'hi' }, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['unknown1'].type).toBe('Container');
    expect(remapped[0]).toContain('Carousel → Container');
  });

  it('maps unknown type without children to Html using outerHTML', () => {
    const sourceMap = new Map([['car1', '<div class="carousel"></div>']]);
    const blocks = {
      'car1': { type: 'Carousel', data: { props: {}, style: {} } },
    };
    const { blocks: result } = sanitizeBlocks(blocks, sourceMap);
    expect(result['car1'].type).toBe('Html');
    expect(result['car1'].data.props.contents).toBe('<div class="carousel"></div>');
  });

  it('SUPPORTED_BLOCK_TYPES includes Video/List/ListItem (Reader can render them, sanitizer must not downgrade them)', () => {
    const blocks = {
      'v1': { type: 'Video', data: { props: { url: 'https://x.com/v.mp4' }, style: {} } },
      'l1': { type: 'List', data: { props: { childrenIds: ['li1'] }, style: {} } },
      'li1': { type: 'ListItem', data: { props: { text: 'item' }, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['v1'].type).toBe('Video');
    expect(result['l1'].type).toBe('List');
    expect(result['li1'].type).toBe('ListItem');
    expect(remapped).toHaveLength(0);
  });

  it('drops unknown type without children and without outerHTML', () => {
    const blocks = {
      'ghost': { type: 'UnknownBlock', data: { props: {}, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['ghost']).toBeUndefined();
    expect(remapped[0]).toContain('DROPPED');
  });

  it('collapses ColumnsContainer with >3 columns to Container', () => {
    const blocks: Record<string, any> = {
      'cc1': {
        type: 'ColumnsContainer',
        data: {
          props: {
            columns: [
              { childrenIds: ['c1'] },
              { childrenIds: ['c2'] },
              { childrenIds: ['c3'] },
              { childrenIds: ['c4'] },
            ]
          },
          style: {}
        }
      },
      'c1': { type: 'Text', data: { props: { text: '1' }, style: {} } },
      'c2': { type: 'Text', data: { props: { text: '2' }, style: {} } },
      'c3': { type: 'Text', data: { props: { text: '3' }, style: {} } },
      'c4': { type: 'Text', data: { props: { text: '4' }, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['cc1'].type).toBe('Container');
    expect(result['cc1'].data.props.childrenIds).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(remapped[0]).toContain('ColumnsContainer(4 cols) → Container');
  });

  it('normalizes Heading h4 to h3', () => {
    const blocks = {
      'h1': { type: 'Heading', data: { props: { level: 'h4', text: 'title' }, style: {} } },
    };
    const { blocks: result, remapped } = sanitizeBlocks(blocks, new Map());
    expect(result['h1'].data.props.level).toBe('h3');
    expect(remapped[0]).toContain('h4 → h3');
  });

  it('SUPPORTED_BLOCK_TYPES includes Table types', () => {
    expect(SUPPORTED_BLOCK_TYPES.has('Table')).toBe(true);
    expect(SUPPORTED_BLOCK_TYPES.has('TableRow')).toBe(true);
    expect(SUPPORTED_BLOCK_TYPES.has('TableCell')).toBe(true);
    expect(SUPPORTED_BLOCK_TYPES.has('TableSection')).toBe(true);
  });
});
