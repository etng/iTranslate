export interface MarkdownBlockRange {
  startLine: number;
  endLine: number;
}

function isFenceDelimiter(line: string): boolean {
  return /^(```+|~~~+)/.test(line.trim());
}

export function buildMarkdownBlocks(markdownText: string): MarkdownBlockRange[] {
  const lines = markdownText.split(/\r?\n/);
  const blocks: MarkdownBlockRange[] = [];

  let inFence = false;
  let blockStart = -1;

  const closeBlock = (lineIndex: number) => {
    if (blockStart < 0) {
      return;
    }
    blocks.push({
      startLine: blockStart + 1,
      endLine: lineIndex + 1,
    });
    blockStart = -1;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isFenceDelimiter(line)) {
      if (blockStart < 0) {
        blockStart = i;
      }
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      if (blockStart < 0) {
        blockStart = i;
      }
      continue;
    }

    if (trimmed.length === 0) {
      closeBlock(i - 1);
      continue;
    }

    if (blockStart < 0) {
      blockStart = i;
    }
  }

  closeBlock(lines.length - 1);
  return blocks;
}

export function getBlockIndexByLine(markdownText: string, lineNumber: number): number | null {
  if (lineNumber < 1) {
    return null;
  }
  const blocks = buildMarkdownBlocks(markdownText);
  const index = blocks.findIndex((block) => lineNumber >= block.startLine && lineNumber <= block.endLine);
  return index >= 0 ? index : null;
}

export function getBlockRangeByIndex(markdownText: string, blockIndex: number): MarkdownBlockRange | null {
  if (blockIndex < 0) {
    return null;
  }
  const blocks = buildMarkdownBlocks(markdownText);
  return blocks[blockIndex] ?? null;
}
