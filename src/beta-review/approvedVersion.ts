import { AcceptedRevisionItem, ApprovedParagraphResult, ApprovedParagraphSegment } from './reviewTypes';

/**
 * Approved Version Engine
 * 
 * Reconstructs the canonical "Approved Version" of a manuscript by applying
 * explicitly accepted beta revisions onto the original text.
 * 
 * Invariants:
 * 1. Original text is never modified in-place.
 * 2. Deterministic reconstruction based exclusively on ACCEPTED revisions.
 * 3. Exact revision binding: Uses the specific `afterText` of the accepted revision,
 *    not whatever `currentText` is currently sitting in `beta_edits`.
 * 4. Overlap Protection: If two accepted revisions conflict/overlap on the same
 *    paragraph, throws `APPROVED_EDIT_CONFLICT` error with conflict details.
 */

export class ApprovedVersionConflictError extends Error {
  code = 'APPROVED_EDIT_CONFLICT';
  editA: AcceptedRevisionItem;
  editB: AcceptedRevisionItem;

  constructor(editA: AcceptedRevisionItem, editB: AcceptedRevisionItem) {
    super(`APPROVED_EDIT_CONFLICT: Chỉnh sửa ${editB.editId} [${editB.startOffset}, ${editB.endOffset}) chồng lấn với chỉnh sửa ${editA.editId} [${editA.startOffset}, ${editA.endOffset})`);
    this.name = 'ApprovedVersionConflictError';
    this.editA = editA;
    this.editB = editB;
  }
}

/**
 * Validates whether any accepted revisions overlap with each other
 */
export const checkAcceptedOverlaps = (revisions: AcceptedRevisionItem[]): void => {
  const sorted = [...revisions].sort((a, b) => a.startOffset - b.startOffset);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next.startOffset < current.endOffset) {
      throw new ApprovedVersionConflictError(current, next);
    }
  }
};

/**
 * Reconstructs a single paragraph into its Approved Version
 */
export const buildApprovedParagraph = (
  paragraphIndex: number,
  originalParagraph: string,
  acceptedRevisions: AcceptedRevisionItem[]
): ApprovedParagraphResult => {
  if (!acceptedRevisions || acceptedRevisions.length === 0) {
    return {
      paragraphIndex,
      text: originalParagraph,
      segments: [
        {
          text: originalParagraph,
          isApprovedEdit: false,
        },
      ],
    };
  }

  // 1. Sort by start offset
  const sorted = [...acceptedRevisions].sort((a, b) => a.startOffset - b.startOffset);

  // 2. Validate no overlapping accepted edits
  checkAcceptedOverlaps(sorted);

  // 3. Build reconstructed segments
  const segments: ApprovedParagraphSegment[] = [];
  let cursor = 0;

  for (const item of sorted) {
    // Clamping boundaries to paragraph bounds for safety
    const start = Math.max(0, Math.min(item.startOffset, originalParagraph.length));
    const end = Math.max(start, Math.min(item.endOffset, originalParagraph.length));

    // Prefix slice (original text prior to this edit)
    if (start > cursor) {
      segments.push({
        text: originalParagraph.slice(cursor, start),
        isApprovedEdit: false,
      });
    }

    // Approved Edit slice
    segments.push({
      text: item.afterText,
      isApprovedEdit: true,
      editId: item.editId,
      revisionNumber: item.revisionNumber,
      errorType: item.errorType,
    });

    cursor = end;
  }

  // Suffix slice (remaining text)
  if (cursor < originalParagraph.length) {
    segments.push({
      text: originalParagraph.slice(cursor),
      isApprovedEdit: false,
    });
  }

  const fullText = segments.map(s => s.text).join('');

  return {
    paragraphIndex,
    text: fullText,
    segments,
  };
};

/**
 * Reconstructs an entire chapter into its Approved Version
 */
export const buildApprovedChapter = (
  originalParagraphs: string[],
  allAcceptedRevisions: AcceptedRevisionItem[]
): ApprovedParagraphResult[] => {
  // Group accepted revisions by paragraphIndex
  const byPara = new Map<number, AcceptedRevisionItem[]>();
  for (const rev of allAcceptedRevisions) {
    const list = byPara.get(rev.paragraphIndex) || [];
    list.push(rev);
    byPara.set(rev.paragraphIndex, list);
  }

  return originalParagraphs.map((paraText, pIdx) => {
    const paraRevs = byPara.get(pIdx) || [];
    return buildApprovedParagraph(pIdx, paraText, paraRevs);
  });
};
