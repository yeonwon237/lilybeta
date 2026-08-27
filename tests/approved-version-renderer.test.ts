import {
  buildApprovedParagraph,
  buildApprovedChapter,
  checkAcceptedOverlaps,
  ApprovedVersionConflictError,
} from '../src/beta-review/approvedVersion.js';
import { AcceptedRevisionItem } from '../src/beta-review/reviewTypes.js';

let passedAssertions = 0;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
  passedAssertions++;
};

const runApprovedRendererTests = () => {
  console.log('========================================================');
  console.log('🧪 TESTING APPROVED VERSION RENDERER (buildApprovedParagraph)');
  console.log('========================================================\n');

  const baseText = 'Hắn nhìn nàng với ánh mắt trầm ngâm và nói lời từ biệt.';

  // [Test 1] Zero accepted edits
  console.log('[Test 1] Zero accepted edits');
  const res1 = buildApprovedParagraph(0, baseText, []);
  assert(res1.text === baseText, 'Returns original text unaltered when 0 accepted edits');
  assert(res1.segments.length === 1, 'Contains single segment');
  assert(res1.segments[0].isApprovedEdit === false, 'Segment is not an approved edit');

  // [Test 2] Single accepted edit
  console.log('\n[Test 2] Single accepted edit (Hắn -> Chàng)');
  // 'Hắn' is [0, 3)
  const revA: AcceptedRevisionItem = {
    editId: 'edit-1',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 3,
    revisionNumber: 1,
    afterText: 'Chàng',
    errorType: 'XUNG_HO',
  };
  const res2 = buildApprovedParagraph(0, baseText, [revA]);
  assert(res2.text === 'Chàng nhìn nàng với ánh mắt trầm ngâm và nói lời từ biệt.', 'Approved text replaced Hắn with Chàng');
  assert(res2.segments.length === 2, 'Has 2 segments (edit + suffix)');
  assert(res2.segments[0].isApprovedEdit === true, 'First segment is approved edit');
  assert(res2.segments[0].text === 'Chàng', 'First segment text is Chàng');

  // [Test 3] Multiple accepted edits (in mixed order)
  console.log('\n[Test 3] Multiple accepted edits (startOffset auto-sort)');
  // 'nàng' is [9, 13) -> 'nàng ấy'
  const revB: AcceptedRevisionItem = {
    editId: 'edit-2',
    paragraphIndex: 0,
    startOffset: 9,
    endOffset: 13,
    revisionNumber: 1,
    afterText: 'nàng ấy',
    errorType: 'XUNG_HO',
  };
  // Pass in revB first, then revA
  const res3 = buildApprovedParagraph(0, baseText, [revB, revA]);
  assert(
    res3.text === 'Chàng nhìn nàng ấy với ánh mắt trầm ngâm và nói lời từ biệt.',
    'Both edits sorted and applied accurately'
  );
  assert(res3.segments.length === 4, '4 segments: [Chàng], [ nhìn ], [nàng ấy], [ với ánh mắt...]');

  // [Test 4] Exact revision binding invariant: Accepted Revision 1 preserved despite newer Revision 2
  console.log('\n[Test 4] Exact Revision Binding: Accepted Rev 1 preserved');
  // Suppose Beta proposed Revision 2 with 'Thiếu gia', but Admin only accepted Revision 1 ('Chàng')
  const boundRev: AcceptedRevisionItem = {
    editId: 'edit-1',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 3,
    revisionNumber: 1, // Bound to Rev 1!
    afterText: 'Chàng', // Even if current edit on server has 'Thiếu gia'
    errorType: 'XUNG_HO',
  };
  const res4 = buildApprovedParagraph(0, baseText, [boundRev]);
  assert(res4.text.startsWith('Chàng'), 'Approved Version strictly uses accepted revision text');
  assert(!res4.text.startsWith('Thiếu gia'), 'Unreviewed new text is excluded from Approved Version');

  // [Test 5] Adjacent accepted edits without overlap
  console.log('\n[Test 5] Adjacent accepted edits (touching boundaries)');
  const adj1: AcceptedRevisionItem = {
    editId: 'e-1',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 3,
    revisionNumber: 1,
    afterText: 'ABC',
  };
  const adj2: AcceptedRevisionItem = {
    editId: 'e-2',
    paragraphIndex: 0,
    startOffset: 3,
    endOffset: 6,
    revisionNumber: 1,
    afterText: 'DEF',
  };
  const res5 = buildApprovedParagraph(0, '123456789', [adj1, adj2]);
  assert(res5.text === 'ABCDEF789', 'Adjacent edits render seamlessly without gaps');

  // [Test 6] Overlapping accepted edits detection & rejection
  console.log('\n[Test 6] Overlapping accepted edits collision protection');
  const over1: AcceptedRevisionItem = {
    editId: 'e-over-1',
    paragraphIndex: 0,
    startOffset: 5,
    endOffset: 15,
    revisionNumber: 1,
    afterText: 'OVER1',
  };
  const over2: AcceptedRevisionItem = {
    editId: 'e-over-2',
    paragraphIndex: 0,
    startOffset: 10,
    endOffset: 20,
    revisionNumber: 1,
    afterText: 'OVER2',
  };

  let caughtError: any = null;
  try {
    buildApprovedParagraph(0, '012345678901234567890123456789', [over1, over2]);
  } catch (err) {
    caughtError = err;
  }
  assert(caughtError instanceof ApprovedVersionConflictError, 'Throws ApprovedVersionConflictError');
  assert(caughtError?.code === 'APPROVED_EDIT_CONFLICT', 'Error code is APPROVED_EDIT_CONFLICT');

  // [Test 7] Vietnamese Unicode & Diacritics
  console.log('\n[Test 7] Vietnamese Unicode & Diacritics');
  const vnOriginal = 'Cô ấy khẽ mỉm cười rồi khẽ gật đầu.';
  const vnEdit: AcceptedRevisionItem = {
    editId: 'e-vn',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 5, // 'Cô ấy'
    revisionNumber: 1,
    afterText: 'Nàng',
    errorType: 'XUNG_HO',
  };
  const res7 = buildApprovedParagraph(0, vnOriginal, [vnEdit]);
  assert(res7.text === 'Nàng khẽ mỉm cười rồi khẽ gật đầu.', 'Vietnamese Unicode diacritics handled accurately');

  // [Test 8] Whole Chapter Assembly
  console.log('\n[Test 8] Whole Chapter Assembly (buildApprovedChapter)');
  const chapterParas = [
    'Đoạn một không có sửa đổi.',
    'Đoạn hai có sửa hắn thành nàng.',
    'Đoạn ba cũng không đổi.',
  ];
  const chapterEdits: AcceptedRevisionItem[] = [
    {
      editId: 'e-chap',
      paragraphIndex: 1,
      startOffset: 16,
      endOffset: 19, // 'hắn'
      revisionNumber: 1,
      afterText: 'chàng',
    },
  ];
  const chapterRes = buildApprovedChapter(chapterParas, chapterEdits);
  assert(chapterRes.length === 3, 'Chapter has 3 paragraphs');
  assert(chapterRes[0].text === 'Đoạn một không có sửa đổi.', 'Paragraph 0 intact');
  assert(chapterRes[1].text === 'Đoạn hai có sửa chàng thành nàng.', 'Paragraph 1 reconstructed');
  assert(chapterRes[2].text === 'Đoạn ba cũng không đổi.', 'Paragraph 2 intact');

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passedAssertions} APPROVED VERSION RENDERER TESTS PASSED!`);
  console.log('========================================================\n');
};

runApprovedRendererTests();
