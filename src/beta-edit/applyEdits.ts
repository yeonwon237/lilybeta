import { BetaEdit, RenderSegment } from './editTypes';

/**
 * Pure, deterministic engine to construct the Working Version of a paragraph.
 * 
 * Rules:
 * 1. Anchored strictly against the original paragraph text using JavaScript UTF-16 offsets.
 * 2. Only active edits are rendered (deleted/inactive edits are excluded).
 * 3. Edits must not overlap. If an overlap is detected, an error is thrown.
 * 4. Preserves exact untouched text between edits.
 */
export function applyEditsToParagraph(
  originalParagraph: string,
  edits: BetaEdit[]
): RenderSegment[] {
  if (!originalParagraph) {
    return [];
  }

  // Filter only active edits for this paragraph
  const activeEdits = (edits || []).filter(e => e.status === 'ACTIVE');

  if (activeEdits.length === 0) {
    return [{ text: originalParagraph, isEdited: false }];
  }

  // Validate bounds
  for (const edit of activeEdits) {
    if (edit.startOffset < 0 || edit.endOffset > originalParagraph.length || edit.startOffset >= edit.endOffset) {
      throw new Error(
        `Invalid edit range [${edit.startOffset}, ${edit.endOffset}) for paragraph of length ${originalParagraph.length}`
      );
    }
  }

  // Sort edits strictly by startOffset ascending
  const sorted = [...activeEdits].sort((a, b) => a.startOffset - b.startOffset);

  // Validate no overlaps
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.startOffset < prev.endOffset) {
      throw new Error(
        `Collision detected: Edit [${curr.startOffset}, ${curr.endOffset}) overlaps with preceding edit [${prev.startOffset}, ${prev.endOffset})`
      );
    }
  }

  const segments: RenderSegment[] = [];
  let cursor = 0;

  for (const edit of sorted) {
    // Unedited segment before this edit
    if (edit.startOffset > cursor) {
      segments.push({
        text: originalParagraph.slice(cursor, edit.startOffset),
        isEdited: false,
      });
    }

    // Edited segment (replaces originalText with currentText)
    segments.push({
      text: edit.currentText,
      isEdited: true,
      edit,
    });

    cursor = edit.endOffset;
  }

  // Trailing unedited text
  if (cursor < originalParagraph.length) {
    segments.push({
      text: originalParagraph.slice(cursor),
      isEdited: false,
    });
  }

  return segments;
}

/**
 * Check if a proposed range overlaps with any existing active edits.
 */
export function hasOverlap(
  startOffset: number,
  endOffset: number,
  existingEdits: BetaEdit[],
  excludeEditId?: string
): boolean {
  for (const edit of existingEdits) {
    if (edit.status !== 'ACTIVE') continue;
    if (excludeEditId && edit.id === excludeEditId) continue;

    // Overlap condition between [startOffset, endOffset) and [edit.startOffset, edit.endOffset)
    if (Math.max(startOffset, edit.startOffset) < Math.min(endOffset, edit.endOffset)) {
      return true;
    }
  }
  return false;
}
