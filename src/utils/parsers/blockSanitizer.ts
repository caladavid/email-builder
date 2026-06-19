export type SourceHtmlMap = Map<string, string>;

// Block types supported by the local READER_DICTIONARY (ReaderBlock.vue)
export const SUPPORTED_BLOCK_TYPES = new Set([
  'ColumnsContainer',
  'Container',
  'EmailLayout',
  'Avatar',
  'Button',
  'Divider',
  'Heading',
  'Html',
  'Image',
  'Spacer',
  'Text',
  'Table',
  'TableRow',
  'TableCell',
  'TableSection',
]);

// Semantic mappings for unsupported types
const TYPE_MAP: Record<string, string> = {
  Separator: 'Divider',
  Espaciador: 'Spacer',
  Script: 'Html',
};

export function sanitizeBlocks(
  blocks: Record<string, any>,
  sourceHtmlMap: SourceHtmlMap
): { blocks: Record<string, any>; remapped: string[] } {
  const remapped: string[] = [];

  for (const blockId of Object.keys(blocks)) {
    const block = blocks[blockId];

    if (SUPPORTED_BLOCK_TYPES.has(block.type)) {
      // ColumnsContainer with >3 columns → Container (Reader renders 3 fixed slots)
      if (block.type === 'ColumnsContainer') {
        const cols = block.data?.props?.columns;
        if (Array.isArray(cols) && cols.length > 3) {
          const childrenIds: string[] = cols.flatMap((c: any) => c.childrenIds ?? []);
          block.type = 'Container';
          block.data.props = { childrenIds };
          remapped.push(`${blockId}: ColumnsContainer(${cols.length} cols) → Container`);
        }
      }

      // Heading h4-h6 → h3 (Reader only renders h1-h3)
      if (block.type === 'Heading') {
        const level = block.data?.props?.level as string | undefined;
        if (level && parseInt(level.replace('h', '')) > 3) {
          block.data.props.level = 'h3';
          remapped.push(`${blockId}: Heading ${level} → h3`);
        }
      }

      continue;
    }

    // Semantic mapping
    if (TYPE_MAP[block.type]) {
      remapped.push(`${blockId}: ${block.type} → ${TYPE_MAP[block.type]}`);
      block.type = TYPE_MAP[block.type];
      continue;
    }

    // Has children → Container preserving them
    const childrenIds = block.data?.props?.childrenIds;
    if (Array.isArray(childrenIds) && childrenIds.length > 0) {
      remapped.push(`${blockId}: ${block.type} → Container (has children)`);
      block.type = 'Container';
      block.data.props = { childrenIds };
      continue;
    }

    // No children → Html with outerHTML if available
    const outerHtml = sourceHtmlMap.get(blockId);
    if (outerHtml) {
      remapped.push(`${blockId}: ${block.type} → Html (outerHTML fallback)`);
      block.type = 'Html';
      block.data = { props: { contents: outerHtml }, style: {} };
      continue;
    }

    // No outerHTML → drop block
    remapped.push(`${blockId}: ${block.type} → DROPPED (no mapping, no children, no outerHTML)`);
    delete blocks[blockId];
  }

  // Remove dropped block references from childrenIds
  const existingIds = new Set(Object.keys(blocks));
  for (const block of Object.values(blocks) as any[]) {
    const ids = block.data?.props?.childrenIds;
    if (Array.isArray(ids)) {
      block.data.props.childrenIds = ids.filter((id: string) => existingIds.has(id));
    }
    const cols = block.data?.props?.columns;
    if (Array.isArray(cols)) {
      for (const col of cols) {
        if (Array.isArray(col.childrenIds)) {
          col.childrenIds = col.childrenIds.filter((id: string) => existingIds.has(id));
        }
      }
    }
  }

  return { blocks, remapped };
}
