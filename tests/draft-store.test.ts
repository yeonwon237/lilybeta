import { DraftStore, buildNewDraftKey, buildExistingDraftKey } from '../src/beta-edit/draftStore.js';

let passedAssertions = 0;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
  passedAssertions++;
};

const runDraftStoreTests = () => {
  console.log('========================================================');
  console.log('🧪 RUNNING CENTRALIZED DRAFT STORE UNIT TESTS');
  console.log('========================================================\n');

  DraftStore._clearAll();

  // 1. New Edit Draft Saving & Key Uniqueness
  console.log('[Test 1] New Edit Draft Saving & Key Uniqueness');
  const key1 = buildNewDraftKey('user1', 'book1', 1, 0, 10, 20);
  const key2 = buildNewDraftKey('user1', 'book1', 1, 0, 10, 25);
  assert(key1 !== key2, 'Keys with different endOffset are distinct');

  DraftStore.saveNewDraft({
    userId: 'user1',
    bookId: 'book1',
    chapterIndex: 1,
    paragraphIndex: 0,
    startOffset: 10,
    endOffset: 20,
    originalText: 'văn bản gốc',
    proposedText: 'văn bản mới',
    errorType: 'VAN_PHONG',
    reason: 'Thay từ hay hơn',
  });

  const retrievedNew = DraftStore.getNewDraft('user1', 'book1', 1, 0, 10, 20);
  assert(Boolean(retrievedNew), 'Saved new draft successfully retrieved');
  assert(retrievedNew?.proposedText === 'văn bản mới', 'Proposed text matches');
  assert(retrievedNew?.errorType === 'VAN_PHONG', 'Error type matches');
  assert(retrievedNew?.reason === 'Thay từ hay hơn', 'Reason matches');

  // 2. Existing Edit Draft Saving & Stale Version Conflict Detection
  console.log('\n[Test 2] Existing Edit Draft Saving & Version Conflict Detection');
  DraftStore.saveExistingDraft({
    userId: 'user1',
    bookId: 'book1',
    chapterIndex: 1,
    editId: 'edit-123',
    baseVersion: 2,
    proposedText: 'Đề xuất sửa phiên bản 3 dở dang',
    errorType: 'TYPO',
    reason: 'Đang gõ tiếp',
  });

  // Current server version is 2 -> matches, not stale
  const matchingDraft = DraftStore.getExistingDraft('user1', 'edit-123', 2);
  assert(Boolean(matchingDraft), 'Existing edit draft retrieved');
  assert(matchingDraft?.isStale === false, 'Draft baseVersion matches currentVersion (isStale = false)');
  assert(matchingDraft?.draft.proposedText === 'Đề xuất sửa phiên bản 3 dở dang', 'Draft text matches');

  // Server version advanced to 3 -> conflict detected!
  const conflictingDraft = DraftStore.getExistingDraft('user1', 'edit-123', 3);
  assert(Boolean(conflictingDraft), 'Stale draft retrieved for inspection');
  assert(conflictingDraft?.isStale === true, 'Version conflict detected (isStale = true)');

  // 3. User Privacy & Isolation Defense
  console.log('\n[Test 3] User Privacy & Data Isolation');
  const userBDraft = DraftStore.getNewDraft('user2', 'book1', 1, 0, 10, 20);
  assert(userBDraft === null, 'User 2 cannot access User 1 new draft');

  const userBExistingDraft = DraftStore.getExistingDraft('user2', 'edit-123', 2);
  assert(userBExistingDraft === null, 'User 2 cannot access User 1 existing draft');

  // 4. Book & Chapter Isolation
  console.log('\n[Test 4] Book & Chapter Isolation');
  const otherBookDraft = DraftStore.getNewDraft('user1', 'book2', 1, 0, 10, 20);
  assert(otherBookDraft === null, 'Draft is scoped strictly to Book 1');

  const otherChapterDraft = DraftStore.getNewDraft('user1', 'book1', 2, 0, 10, 20);
  assert(otherChapterDraft === null, 'Draft is scoped strictly to Chapter 1');

  // 5. Listing Drafts for Chapter
  console.log('\n[Test 5] Listing Drafts for Chapter & Blocking Check');
  assert(DraftStore.hasUnsavedDraftForChapter('user1', 'book1', 1) === true, 'Chapter 1 has unsaved drafts');
  assert(DraftStore.hasUnsavedDraftForChapter('user1', 'book1', 2) === false, 'Chapter 2 has no unsaved drafts');

  const chapter1Drafts = DraftStore.listDraftsForChapter('user1', 'book1', 1);
  assert(chapter1Drafts.length === 2, 'Chapter 1 contains exactly 2 unsaved drafts (1 new + 1 existing)');

  // 6. Deleting & Discarding Drafts
  console.log('\n[Test 6] Deleting & Discarding Drafts');
  // Discard single new draft
  DraftStore.deleteNewDraft('user1', 'book1', 1, 0, 10, 20);
  assert(DraftStore.getNewDraft('user1', 'book1', 1, 0, 10, 20) === null, 'Single new draft successfully deleted');

  // One existing draft remains
  assert(DraftStore.hasUnsavedDraftForChapter('user1', 'book1', 1) === true, 'Remaining existing draft detected');

  // Discard all remaining drafts for chapter
  const discardedCount = DraftStore.discardAllDraftsForChapter('user1', 'book1', 1);
  assert(discardedCount === 1, 'Discarded 1 remaining draft for chapter');
  assert(DraftStore.hasUnsavedDraftForChapter('user1', 'book1', 1) === false, 'Chapter 1 is now completely clean');
  assert(DraftStore.listDraftsForChapter('user1', 'book1', 1).length === 0, 'No drafts remain');

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passedAssertions} DRAFT STORE ASSERTIONS PASSED!`);
  console.log('========================================================\n');
};

runDraftStoreTests();
