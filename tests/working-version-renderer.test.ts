import { applyEditsToParagraph, hasOverlap } from '../src/beta-edit/applyEdits.js';
import { BetaEdit } from '../src/beta-edit/editTypes.js';

const runTests = () => {
  console.log('========================================================');
  console.log('🧪 TESTING WORKING VERSION RENDERER (applyEditsToParagraph)');
  console.log('========================================================');

  let passed = 0;
  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`  ✓ ${msg}`);
  };

  const createDummyEdit = (overrides: Partial<BetaEdit>): BetaEdit => ({
    id: 'edit-1',
    assignmentId: 'assign-1',
    bookId: 'book-1',
    chapterId: 'ch-1',
    chapterIndex: 1,
    betaUserId: 'user-1',
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 5,
    originalText: '',
    currentText: '',
    errorType: 'TYPO',
    status: 'ACTIVE',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  // 1. Zero edits
  console.log('\n[Test 1] Zero edits');
  const para1 = 'Nàng quay đầu nhìn hắn, ánh mắt đượm buồn.';
  const segs1 = applyEditsToParagraph(para1, []);
  assert(segs1.length === 1, 'Returns single unedited segment');
  assert(segs1[0].text === para1, 'Text matches original');
  assert(!segs1[0].isEdited, 'isEdited is false');

  // 2. Single edit in middle
  console.log('\n[Test 2] Single edit in middle');
  // "nhìn hắn" starts at index 14, ends at 23
  const target = 'nhìn hắn';
  const startIdx = para1.indexOf(target);
  const endIdx = startIdx + target.length;
  const editMiddle = createDummyEdit({
    startOffset: startIdx,
    endOffset: endIdx,
    originalText: target,
    currentText: 'nhìn nàng ấy',
    errorType: 'XUNG_HO',
  });
  const segs2 = applyEditsToParagraph(para1, [editMiddle]);
  assert(segs2.length === 3, 'Returns 3 segments (prefix, edit, suffix)');
  assert(segs2[0].text === para1.slice(0, startIdx), 'Prefix text matches');
  assert(segs2[1].text === 'nhìn nàng ấy', 'Edited text replaces target');
  assert(segs2[1].isEdited === true, 'Middle segment isEdited is true');
  assert(segs2[2].text === para1.slice(endIdx), 'Suffix text matches');

  // Working text reconstruction
  const reconstructed = segs2.map(s => s.text).join('');
  assert(
    reconstructed === 'Nàng quay đầu nhìn nàng ấy, ánh mắt đượm buồn.',
    'Full working paragraph correctly reconstructed'
  );

  // 3. Edit at the very beginning (offset 0)
  console.log('\n[Test 3] Edit at the very beginning (offset 0)');
  const editStart = createDummyEdit({
    startOffset: 0,
    endOffset: 4, // "Nàng"
    originalText: 'Nàng',
    currentText: 'Thiếu nữ',
  });
  const segs3 = applyEditsToParagraph(para1, [editStart]);
  assert(segs3.length === 2, 'Returns 2 segments (edit, suffix)');
  assert(segs3[0].text === 'Thiếu nữ', 'First segment is edited text');
  assert(segs3[0].isEdited === true, 'First segment isEdited is true');
  assert(segs3[1].text === para1.slice(4), 'Second segment is unedited suffix');

  // 4. Edit at the very end
  console.log('\n[Test 4] Edit at the very end');
  const targetEnd = 'đượm buồn.';
  const startEnd = para1.indexOf(targetEnd);
  const editEnd = createDummyEdit({
    startOffset: startEnd,
    endOffset: para1.length,
    originalText: targetEnd,
    currentText: 'vương chút ưu tư.',
  });
  const segs4 = applyEditsToParagraph(para1, [editEnd]);
  assert(segs4.length === 2, 'Returns 2 segments (prefix, edit)');
  assert(segs4[0].text === para1.slice(0, startEnd), 'First segment is prefix');
  assert(segs4[1].text === 'vương chút ưu tư.', 'Second segment is edited text');

  // 5. Multiple non-overlapping edits in arbitrary order
  console.log('\n[Test 5] Multiple edits (input in reverse order)');
  const segs5 = applyEditsToParagraph(para1, [editEnd, editStart]);
  assert(segs5.length === 3, 'Renderer automatically sorts by startOffset');
  assert(segs5[0].text === 'Thiếu nữ', 'First segment is editStart');
  assert(segs5[1].text === para1.slice(4, startEnd), 'Middle segment is unedited');
  assert(segs5[2].text === 'vương chút ưu tư.', 'Last segment is editEnd');

  // 6. Adjacent edits (edit1.endOffset === edit2.startOffset)
  console.log('\n[Test 6] Adjacent edits');
  const adj1 = createDummyEdit({
    id: 'adj-1',
    startOffset: 0,
    endOffset: 4,
    originalText: 'Nàng',
    currentText: 'Tiểu thư',
  });
  const adj2 = createDummyEdit({
    id: 'adj-2',
    startOffset: 4,
    endOffset: 14,
    originalText: ' quay đầu ',
    currentText: ' xoay người ',
  });
  const segs6 = applyEditsToParagraph(para1, [adj1, adj2]);
  assert(segs6[0].text === 'Tiểu thư', 'First adjacent edit rendered');
  assert(segs6[1].text === ' xoay người ', 'Second adjacent edit rendered without gap');

  // 7. Inactive / DELETED edits are excluded
  console.log('\n[Test 7] Inactive & DELETED edits excluded');
  const deletedEdit = createDummyEdit({
    id: 'del-1',
    startOffset: 0,
    endOffset: 4,
    status: 'DELETED',
    currentText: 'HACKED',
  });
  const segs7 = applyEditsToParagraph(para1, [deletedEdit]);
  assert(segs7.length === 1, 'Deleted edit is ignored');
  assert(segs7[0].text === para1, 'Paragraph stays pure original');

  // 8. Collision detection: Overlapping edits throw error
  console.log('\n[Test 8] Overlapping edits collision prevention');
  const over1 = createDummyEdit({ id: 'o-1', startOffset: 10, endOffset: 20 });
  const over2 = createDummyEdit({ id: 'o-2', startOffset: 15, endOffset: 25 });
  let threw = false;
  try {
    applyEditsToParagraph(para1, [over1, over2]);
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('Collision detected'), 'Detected collision and threw expected error');
  }
  assert(threw, 'applyEditsToParagraph refused overlapping edits');

  // 9. hasOverlap helper function
  console.log('\n[Test 9] hasOverlap helper function');
  assert(hasOverlap(15, 25, [over1]), 'Detects overlap [15, 25) on [10, 20)');
  assert(!hasOverlap(20, 30, [over1]), 'No overlap for adjacent [20, 30)');
  assert(!hasOverlap(0, 10, [over1]), 'No overlap for preceding [0, 10)');
  assert(!hasOverlap(15, 25, [over1], 'o-1'), 'Excludes self when checking');

  // 10. Vietnamese Unicode / Diacritics safety
  console.log('\n[Test 10] Vietnamese Unicode & Diacritics');
  const vnPara = 'Trường An tháng ba mưa bụi giăng đầy lối, thiếu nữ áo xanh.';
  const vnTarget = 'thiếu nữ áo xanh';
  const vnStart = vnPara.indexOf(vnTarget);
  const vnEnd = vnStart + vnTarget.length;
  const vnEdit = createDummyEdit({
    startOffset: vnStart,
    endOffset: vnEnd,
    originalText: vnTarget,
    currentText: 'nữ hiệp tử y',
  });
  const vnSegs = applyEditsToParagraph(vnPara, [vnEdit]);
  const vnResult = vnSegs.map(s => s.text).join('');
  assert(
    vnResult === 'Trường An tháng ba mưa bụi giăng đầy lối, nữ hiệp tử y.',
    'Accurately replaced Vietnamese diacritic string'
  );

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passed} WORKING VERSION RENDERER TESTS PASSED!`);
  console.log('========================================================\n');
};

runTests();
