import { createApp } from '../server/app.js';
import { runMigrations } from '../server/migrations/runner.js';
import { queryOne } from '../server/db/database.js';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const runTests = async () => {
  console.log('====================================================');
  console.log('🚀 STARTING LILYBETA PHASE 2 SECURITY & WORKFLOW TEST');
  console.log('====================================================');

  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Listening on ${baseUrl}`);

  let passedAssertions = 0;
  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passedAssertions++;
    console.log(`  ✓ ${msg}`);
  };

  try {
    // 1. Admin Login
    console.log('\n[Phase 1] Admin Authentication');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
    });
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    assert(Boolean(adminToken), 'Admin received valid JWT token');
    assert(adminData.user.role === 'ADMIN', 'Admin user role is ADMIN');

    // 2. Admin creates Beta Reader A and Beta Reader B
    console.log('\n[Phase 2] Admin Provisions Beta Reader Accounts');
    const userASuffix = Date.now().toString().slice(-4);
    const userAUsername = `beta_a_${userASuffix}`;
    const userBUsername = `beta_b_${userASuffix}`;

    const createARes = await fetch(`${baseUrl}/api/admin/beta-readers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        username: userAUsername,
        password: 'password123',
        displayName: 'Ngọc Anh (Beta A)',
      }),
    });
    assert(createARes.status === 201, 'Create Beta Reader A returns 201 Created');
    const userA = (await createARes.json()).reader;

    const createBRes = await fetch(`${baseUrl}/api/admin/beta-readers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        username: userBUsername,
        password: 'password123',
        displayName: 'Bảo Bình (Beta B)',
      }),
    });
    assert(createBRes.status === 201, 'Create Beta Reader B returns 201 Created');
    const userB = (await createBRes.json()).reader;

    // 3. Beta Reader Logins
    console.log('\n[Phase 3] Beta Readers Login & Session Establishment');
    const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userAUsername, password: 'password123' }),
    });
    assert(loginARes.status === 200, 'Beta Reader A login returns 200 OK');
    const tokenA = (await loginARes.json()).token;

    const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userBUsername, password: 'password123' }),
    });
    assert(loginBRes.status === 200, 'Beta Reader B login returns 200 OK');
    const tokenB = (await loginBRes.json()).token;

    // 4. Admin Uploads Book A and Book B
    console.log('\n[Phase 4] Admin Uploads Draft Books (No Raw Files Stored)');
    const createBook = async (title: string, author: string, chapterCount: number) => {
      const chapters = Array.from({ length: chapterCount }, (_, i) => ({
        index: i + 1,
        title: `Chương ${i + 1}: Tiêu đề chương ${i + 1}`,
        paragraphs: [
          `Đoạn 1 của chương ${i + 1} trong tác phẩm ${title}.`,
          `Đoạn 2 chứa nội dung bản thảo thử nghiệm được bảo mật nghiêm ngặt.`,
        ],
        wordCount: 1500,
      }));

      const res = await fetch(`${baseUrl}/api/admin/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title,
          author,
          originalFileName: `${title}.txt`,
          fileFormat: 'TXT',
          totalChapters: chapterCount,
          wordCount: chapterCount * 1500,
          chapters,
        }),
      });
      return (await res.json()).book;
    };

    const bookA = await createBook(`Tác Phẩm Bí Mật A (${userASuffix})`, 'Tác Giả A', 2);
    const bookB = await createBook(`Tác Phẩm Bảo Mật B (${userASuffix})`, 'Tác Giả B', 2);
    assert(Boolean(bookA.id), 'Book A created successfully');
    assert(Boolean(bookB.id), 'Book B created successfully');

    // 5. Admin Assigns Book A -> Beta A, Book B -> Beta B
    console.log('\n[Phase 5] Admin Assigns Books to Beta Readers');
    const assignARes = await fetch(`${baseUrl}/api/admin/books/${bookA.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ betaUserId: userA.id }),
    });
    assert(assignARes.status === 200, `Book A assigned to Beta A (${userAUsername})`);

    const assignBRes = await fetch(`${baseUrl}/api/admin/books/${bookB.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ betaUserId: userB.id }),
    });
    assert(assignBRes.status === 200, `Book B assigned to Beta B (${userBUsername})`);

    // 6. Beta Reader A Access Verification
    console.log('\n[Phase 6] Beta Reader A Authorized Book Access');
    const booksARes = await fetch(`${baseUrl}/api/books`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const booksA = (await booksARes.json()).books;
    assert(booksA.length === 1, 'Beta A sees exactly 1 assigned book');
    assert(booksA[0].id === bookA.id, 'Beta A only sees Book A');

    // 7. MANDATORY IDOR TEST: Beta A attempts to access Book B
    console.log('\n[Phase 7] 🛡️ MANDATORY IDOR TEST: Beta A attempts to access unassigned Book B');
    const idorBookRes = await fetch(`${baseUrl}/api/books/${bookB.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(idorBookRes.status === 403, `IDOR Defense: GET /api/books/${bookB.id} as Beta A REJECTED with 403 Forbidden`);

    const idorChaptersRes = await fetch(`${baseUrl}/api/books/${bookB.id}/chapters`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(idorChaptersRes.status === 403, `IDOR Defense: GET /api/books/${bookB.id}/chapters as Beta A REJECTED with 403 Forbidden`);

    const idorChapterContentRes = await fetch(`${baseUrl}/api/books/${bookB.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(idorChapterContentRes.status === 403, `IDOR Defense: GET /api/books/${bookB.id}/chapters/1 as Beta A REJECTED with 403 Forbidden`);

    const idorProgressRes = await fetch(`${baseUrl}/api/books/${bookB.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ chapterIndex: 1, percentage: 50 }),
    });
    assert(idorProgressRes.status === 403, `IDOR Defense: POST /api/books/${bookB.id}/progress as Beta A REJECTED with 403 Forbidden`);

    const idorCompleteRes = await fetch(`${baseUrl}/api/books/${bookB.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(idorCompleteRes.status === 403, `IDOR Defense: POST /api/books/${bookB.id}/chapters/1/complete as Beta A REJECTED with 403 Forbidden`);

    const idorWorkflowRes = await fetch(`${baseUrl}/api/books/${bookB.id}/workflow`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(idorWorkflowRes.status === 403, `IDOR Defense: GET /api/books/${bookB.id}/workflow as Beta A REJECTED with 403 Forbidden`);

    // 8. MANDATORY IDOR TEST: Beta B attempts to access Book A
    console.log('\n[Phase 8] 🛡️ MANDATORY IDOR TEST: Beta B attempts to access unassigned Book A');
    const idorBtoBookARes = await fetch(`${baseUrl}/api/books/${bookA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(idorBtoBookARes.status === 403, `IDOR Defense: GET /api/books/${bookA.id} as Beta B REJECTED with 403 Forbidden`);

    const idorBtoChapterARes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(idorBtoChapterARes.status === 403, `IDOR Defense: GET /api/books/${bookA.id}/chapters/1 as Beta B REJECTED with 403 Forbidden`);

    // 9. Chapter Integrity & Invariant Defense
    console.log('\n[Phase 9] 🛡️ Chapter Integrity Validation');
    const invalidChapterProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ chapterIndex: 999999, percentage: 50 }),
    });
    assert(invalidChapterProgRes.status === 404, 'Save progress on nonexistent chapter 999999 rejected with 404 Not Found');

    const invalidIndexProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ chapterIndex: -5, percentage: 50 }),
    });
    assert(invalidIndexProgRes.status === 400, 'Save progress with negative chapterIndex rejected with 400 Bad Request');

    const invalidChapterCompleteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/999999/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(invalidChapterCompleteRes.status === 404, 'Complete nonexistent chapter 999999 rejected with 404 Not Found');

    // 10. User Spoofing Defense
    console.log('\n[Phase 10] 🛡️ User Identity Spoofing Defense');
    const spoofProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        betaUserId: userB.id, // Client attempts to forge user ID
        assignmentId: 'fake-assignment-id',
        chapterIndex: 1,
        percentage: 25,
        scrollPercent: 30,
      }),
    });
    assert(spoofProgRes.status === 200, 'Save progress with spoofed user body is processed using authenticated token');
    
    // Verify in database that progress was written for userA, NOT userB
    const spoofCheck = queryOne(
      'SELECT beta_user_id FROM beta_assignment_progress WHERE book_id = ? AND beta_user_id = ?',
      bookA.id,
      userB.id
    );
    assert(!spoofCheck, 'Database check: No progress record created for spoofed victim userB on Book A');

    // 11. Chapter Workflow Lifecycle
    console.log('\n[Phase 11] Chapter Workflow Lifecycle (IN_PROGRESS -> COMPLETED)');
    // 11.1 Open Chapter 1
    const openCh1Res = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(openCh1Res.status === 200, 'Open chapter 1 returns 200 OK');
    const ch1Data = (await openCh1Res.json()).chapter;
    assert(ch1Data.status === 'IN_PROGRESS', 'Chapter 1 workflow status transitions to IN_PROGRESS upon opening');
    assert(Boolean(ch1Data.startedAt), 'Chapter 1 startedAt timestamp recorded');

    // 11.2 Complete Chapter 1
    const completeCh1Res = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(completeCh1Res.status === 200, 'Complete chapter 1 returns 200 OK');
    const completeCh1Data = await completeCh1Res.json();
    assert(completeCh1Data.status === 'COMPLETED', 'Chapter 1 status is COMPLETED');
    assert(completeCh1Data.completedChaptersCount === 1, 'Completed chapters count is 1');
    assert(completeCh1Data.overallPercentage === 50, 'Overall progress is 50% (1/2 chapters)');

    // 11.3 Workflow map query
    const wfRes = await fetch(`${baseUrl}/api/books/${bookA.id}/workflow`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(wfRes.status === 200, 'Query workflow returns 200 OK');
    const wfData = (await wfRes.json()).workflow;
    assert(wfData['1'].status === 'COMPLETED', 'Workflow map shows chapter 1 as COMPLETED');

    // 11.4 Reopen Completed Chapter
    const reopenCh1Res = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(reopenCh1Res.status === 200, 'Reopen chapter 1 returns 200 OK');
    const reopenCh1Data = (await reopenCh1Res.json()).chapter;
    assert(reopenCh1Data.status === 'COMPLETED', 'Reopening completed chapter 1 preserves COMPLETED status');

    // 11.5 Open Chapter 2
    const openCh2Res = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/2`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(openCh2Res.status === 200, 'Open chapter 2 returns 200 OK');
    const ch2Data = (await openCh2Res.json()).chapter;
    assert(ch2Data.status === 'IN_PROGRESS', 'Chapter 2 workflow status is IN_PROGRESS');

    // 12. Multi-Assignment Support
    console.log('\n[Phase 12] Multi-Assignment per Book Support');
    const assignAtoBRes = await fetch(`${baseUrl}/api/admin/books/${bookA.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ betaUserId: userB.id }),
    });
    assert(assignAtoBRes.status === 200, 'Book A additionally assigned to Beta B');

    const adminBooksRes = await fetch(`${baseUrl}/api/admin/books`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminBooks = (await adminBooksRes.json()).books;
    const bookARecord = adminBooks.find((b: any) => b.id === bookA.id);
    const bookACount = adminBooks.filter((b: any) => b.id === bookA.id).length;
    assert(bookACount === 1, 'Book A is NOT duplicated in Admin book list despite having 2 active assignments');
    assert(bookARecord.assignments.length === 2, 'Book A contains exactly 2 reader assignments');

    // 13. Assignment Revocation Defense
    console.log('\n[Phase 13] Assignment Revocation Immediate Enforcement');
    const revokeRes = await fetch(`${baseUrl}/api/admin/books/${bookA.id}/assign/${userB.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(revokeRes.status === 200, 'Admin revokes Book A assignment for Beta B');

    const postRevokeBookRes = await fetch(`${baseUrl}/api/books/${bookA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(postRevokeBookRes.status === 403, 'Revoked user GET /api/books/:id immediately blocked with 403 Forbidden');

    const postRevokeProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ chapterIndex: 1, percentage: 10 }),
    });
    assert(postRevokeProgRes.status === 403, 'Revoked user POST /api/books/:id/progress immediately blocked with 403 Forbidden');

    const postRevokeCompRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(postRevokeCompRes.status === 403, 'Revoked user POST /api/books/:id/chapters/1/complete immediately blocked with 403 Forbidden');

    // 14. Disabled Account Blocking
    console.log('\n[Phase 14] Deactivated Account Blocking');
    const disableARes = await fetch(`${baseUrl}/api/admin/beta-readers/${userA.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert(disableARes.status === 200, 'Admin disables Beta Reader A returns 200 OK');

    const blockedTokenARes = await fetch(`${baseUrl}/api/books`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(blockedTokenARes.status === 401, 'Disabled user request immediately blocked with 401 Unauthorized');

    // 15. Versioned Migration Engine & Table-to-View Verification
    console.log('\n[Phase 15] Versioned Migration Engine & Schema Integrity');
    const appliedVersions = queryOne<any>(
      "SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN ('001', '002', '003')"
    );
    assert(appliedVersions && appliedVersions.count === 3, 'schema_migrations tracked all 3 versions (001, 002, 003)');

    const viewCheck = queryOne<any>(
      "SELECT type FROM sqlite_master WHERE name = 'beta_chapter_progress'"
    );
    assert(viewCheck && viewCheck.type === 'view', 'beta_chapter_progress is confirmed to be a SQL VIEW');

    // 16. Supabase Schema Migration Dependency & Edit/Review RLS Verification
    console.log('\n[Phase 16] Supabase Migration Order & Edit/Review RLS Verification');
    const supabaseSql = fs.readFileSync(path.join(process.cwd(), 'server', 'migrations', 'supabase_schema.sql'), 'utf8');
    const tableIndex = supabaseSql.indexOf('CREATE TABLE IF NOT EXISTS public.beta_assignments');
    const bookPolicyIndex = supabaseSql.indexOf('CREATE POLICY "Beta Readers view only actively assigned books"');
    const progressPolicyIndex = supabaseSql.indexOf('CREATE POLICY "Beta Readers manage progress only on actively assigned books"');
    
    assert(tableIndex !== -1, 'public.beta_assignments table defined');
    assert(bookPolicyIndex !== -1, 'Beta books active assignment policy defined');
    assert(tableIndex < bookPolicyIndex, 'beta_assignments table created BEFORE beta_books RLS policy');
    assert(tableIndex < progressPolicyIndex, 'beta_assignments table created BEFORE progress RLS policy');

    // Edits, Notes, Revisions RLS checks
    const editsTableIndex = supabaseSql.indexOf('CREATE TABLE IF NOT EXISTS public.beta_edits');
    const editsPolicyIndex = supabaseSql.indexOf('CREATE POLICY "Beta Readers propose edits on assigned chapters"');
    const notesTableIndex = supabaseSql.indexOf('CREATE TABLE IF NOT EXISTS public.beta_notes');
    const notesPolicyIndex = supabaseSql.indexOf('CREATE POLICY "Beta Readers insert notes on assigned chapters"');
    const revisionsTableIndex = supabaseSql.indexOf('CREATE TABLE IF NOT EXISTS public.beta_edit_revisions');
    const revisionsPolicyIndex = supabaseSql.indexOf('CREATE POLICY "Beta Readers view revisions of own edits"');

    assert(editsTableIndex !== -1 && editsPolicyIndex !== -1, 'beta_edits table and audited RLS policy defined');
    assert(editsTableIndex < editsPolicyIndex, 'beta_edits table created BEFORE its RLS policies');

    assert(notesTableIndex !== -1 && notesPolicyIndex !== -1, 'beta_notes table and audited RLS policy defined');
    assert(notesTableIndex < notesPolicyIndex, 'beta_notes table created BEFORE its RLS policies');

    assert(revisionsTableIndex !== -1 && revisionsPolicyIndex !== -1, 'beta_edit_revisions table and audited RLS policy defined');
    assert(revisionsTableIndex < revisionsPolicyIndex, 'beta_edit_revisions table created BEFORE its RLS policies');

    // 17. Phase 3: Inline Edits & Multi-Revision Security & Anchoring
    console.log('\n[Phase 17] Inline Edits, Anchoring, Overlap & Multi-Revision Lifecycle');
    
    // Re-enable User A
    const enableARes = await fetch(`${baseUrl}/api/admin/beta-readers/${userA.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: true }),
    });
    assert(enableARes.status === 200, 'Re-enabled Beta Reader A');

    // Fetch chapter 1 to get real paragraph texts
    const ch1EditRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const ch1EditData = await ch1EditRes.json();
    const p0 = ch1EditData.chapter.paragraphs[0]; // e.g. "Đoạn 1 của chương 1..."
    const targetSlice = p0.slice(0, 6); // "Đoạn 1"

    // Beta A creates valid edit on Book A Chapter 1 Paragraph 0
    const validEditRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 0,
        endOffset: 6,
        originalText: targetSlice,
        proposedText: 'Phần mở đầu',
        errorType: 'VAN_PHONG',
        reason: 'Dùng từ trang trọng hơn',
      }),
    });
    const resBody = await validEditRes.text();
    if (validEditRes.status !== 201) {
      console.log('validEditRes error body:', validEditRes.status, resBody);
    }
    assert(validEditRes.status === 201, 'Beta Reader A creates edit returns 201 Created');
    const edit1 = JSON.parse(resBody).edit;
    assert(edit1.version === 1, 'Initial edit version is 1');
    assert(edit1.status === 'ACTIVE', 'Initial edit status is ACTIVE');

    // IDOR: Beta A tries to create edit on unassigned Book B
    const crossBookEditRes = await fetch(`${baseUrl}/api/books/${bookB.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 0,
        endOffset: 6,
        originalText: targetSlice,
        proposedText: 'Hacked',
        errorType: 'OTHER',
      }),
    });
    assert(crossBookEditRes.status === 403, 'Cross-book edit creation blocked with 403 Forbidden');

    // Fake paragraph index
    const fakeParaRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 99999,
        startOffset: 0,
        endOffset: 5,
        originalText: 'abc',
        proposedText: 'xyz',
        errorType: 'TYPO',
      }),
    });
    assert(fakeParaRes.status === 400, 'Invalid paragraphIndex 99999 rejected with 400 Bad Request');

    // Fake offsets
    const fakeOffsetRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 10,
        endOffset: 5,
        originalText: 'abc',
        proposedText: 'xyz',
        errorType: 'TYPO',
      }),
    });
    assert(fakeOffsetRes.status === 400, 'Invalid offsets start >= end rejected with 400 Bad Request');

    // Fake original text (Anchor stale mismatch)
    const anchorMismatchRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 0,
        endOffset: 8,
        originalText: 'KHONG_KHOP',
        proposedText: 'Hồi ức',
        errorType: 'VAN_PHONG',
      }),
    });
    assert(anchorMismatchRes.status === 409, 'Anchor slice mismatch rejected with 409 Conflict (EDIT_ANCHOR_STALE)');

    // Overlapping edit rejection
    const overlapRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 2,
        endOffset: 8,
        originalText: p0.slice(2, 8),
        proposedText: 'văn bản cổ',
        errorType: 'TYPO',
      }),
    });
    assert(overlapRes.status === 409, 'Overlapping edit range [2, 8) on [0, 6) rejected with 409 Conflict (EDIT_OVERLAP)');

    // Cross-reader IDOR: Beta B attempts to access/mutate Beta A edit
    const crossReaderGetRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossReaderGetRes.status === 403, 'Beta B querying Book A edits blocked with 403 Forbidden');

    const crossReaderPatchRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        proposedText: 'Hacked',
        errorType: 'OTHER',
      }),
    });
    assert(crossReaderPatchRes.status === 403, 'Beta B updating Beta A edit blocked with 403 Forbidden');

    const crossReaderDeleteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossReaderDeleteRes.status === 403, 'Beta B deleting Beta A edit blocked with 403 Forbidden');

    // Update edit -> Revision 2 creation
    const updateEditRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        proposedText: 'Ký ức',
        errorType: 'VAN_PHONG',
        reason: 'Thay đổi lần 2',
        expectedVersion: 1,
      }),
    });
    assert(updateEditRes.status === 200, 'Beta Reader A updates edit returns 200 OK');
    const updatedEdit = (await updateEditRes.json()).edit;
    assert(updatedEdit.version === 2, 'Edit version incremented to 2');
    assert(updatedEdit.currentText === 'Ký ức', 'Current text updated to Ký ức');

    // Concurrency conflict check
    const staleConflictRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        proposedText: 'Ghi nhớ',
        errorType: 'VAN_PHONG',
        expectedVersion: 1, // Stale!
      }),
    });
    assert(staleConflictRes.status === 409, 'Stale expectedVersion=1 rejected with 409 Conflict (EDIT_CONFLICT)');

    // Query revisions timeline
    const revsRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}/revisions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(revsRes.status === 200, 'Beta Reader A queries edit revisions returns 200 OK');
    const revisions = (await revsRes.json()).revisions;
    assert(revisions.length === 2, 'Revision history contains exactly 2 revisions');
    assert(revisions[0].revisionNumber === 1 && revisions[0].afterText === 'Phần mở đầu', 'Revision 1 preserved');
    assert(revisions[1].revisionNumber === 2 && revisions[1].afterText === 'Ký ức', 'Revision 2 preserved');

    // Soft delete / revert edit
    const deleteEditRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteEditRes.status === 200, 'Soft delete edit returns 200 OK');

    const editsAfterDelRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const activeEdits = (await editsAfterDelRes.json()).edits;
    assert(activeEdits.length === 0, 'Deleted edit excluded from active edits list (reverted to original)');

    // Check revision history still intact after soft delete
    const revsAfterDelRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits/${edit1.id}/revisions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const revsAfterDel = (await revsAfterDelRes.json()).revisions;
    assert(revsAfterDel.length === 3, 'Revision history preserved all 3 steps including reversion');

    // 18. Chapter Completion State Invalidation & Paragraph Notes
    console.log('\n[Phase 18] Chapter Completion State Invalidation & Paragraph Notes');

    // Re-complete chapter 1
    const reCompleteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(reCompleteRes.status === 200, 'Beta Reader A completes Chapter 1');

    const wfCheck1 = await fetch(`${baseUrl}/api/books/${bookA.id}/workflow`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert((await wfCheck1.json()).workflow[1].status === 'COMPLETED', 'Chapter 1 workflow is COMPLETED');

    const p1 = ch1EditData.chapter.paragraphs[1];
    const targetSlice1 = p1.slice(0, 6); // "Đoạn 2"
    const editOnCompletedRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 1,
        startOffset: 0,
        endOffset: 6,
        originalText: targetSlice1,
        proposedText: 'Phần kết',
        errorType: 'TYPO',
      }),
    });
    assert(editOnCompletedRes.status === 201, 'Edit created on completed chapter returns 201 Created');

    const wfCheck2 = await fetch(`${baseUrl}/api/books/${bookA.id}/workflow`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert((await wfCheck2.json()).workflow[1].status === 'IN_PROGRESS', 'Editing completed chapter transitions status back to IN_PROGRESS');

    // Paragraph notes CRUD & IDOR
    const noteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paragraphIndex: 0,
        startOffset: 0,
        endOffset: 10,
        selectedText: 'Đoạn văn 1',
        note: 'Cần kiểm tra lại đại từ nhân vật ở đoạn này',
      }),
    });
    assert(noteRes.status === 201, 'Beta A creates paragraph note returns 201 Created');
    const note1 = (await noteRes.json()).note;

    const listNotesRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/notes`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert((await listNotesRes.json()).notes.length === 1, 'Beta A lists chapter notes returns 1 note');

    const crossReaderNoteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/notes`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossReaderNoteRes.status === 403, 'Beta B accessing Book A notes blocked with 403 Forbidden');

    const deleteNoteRes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1/notes/${note1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteNoteRes.status === 200, 'Beta A deletes note returns 200 OK');

    // Admin Book Edits Inspector
    const adminEditsRes = await fetch(`${baseUrl}/api/admin/books/${bookA.id}/edits`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminEditsRes.status === 200, 'Admin queries book edits inspector returns 200 OK');
    const allBookEdits = (await adminEditsRes.json()).edits;
    assert(allBookEdits.length >= 2, 'Admin book inspector retrieves all edits across chapters');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedAssertions} SECURITY, WORKFLOW, MIGRATION & PHASE 3 EDIT ASSERTIONS PASSED!`);
    console.log('====================================================\n');
  } finally {
    server.close();
  }
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test suite failed with error:\n', err);
    process.exit(1);
  });
