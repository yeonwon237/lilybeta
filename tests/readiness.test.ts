import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

// 1. Isolate test database to prevent polluting persistent lilybeta.db
const testDbFile = path.join(process.cwd(), 'data', `test_readiness_${Date.now()}.db`);
process.env.DB_PATH = testDbFile;
process.env.DATABASE_PROVIDER = 'sqlite';

const { createApp } = await import('../server/app.js');
const { runMigrations } = await import('../server/migrations/runner.js');

let passedAssertions = 0;
const assert = (condition: boolean, msg: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedAssertions++;
  console.log(`  ✓ ${msg}`);
};

const runReadinessTests = async () => {
  console.log('====================================================');
  console.log('🚀 STARTING LILYBETA PHASE 5 END-TO-END READINESS & QA TEST');
  console.log('====================================================\n');

  // Run SQLite migrations
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Listening on ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // Step 1: Admin Login
    // -------------------------------------------------------------
    console.log('[Step 1] Admin Authentication');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
    });
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    const { token: adminToken } = await adminLoginRes.json();
    assert(Boolean(adminToken), 'Admin token received');

    // Health endpoints check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.status === 200, 'Root health endpoint returns 200 OK');
    const dbHealthRes = await fetch(`${baseUrl}/health/db`);
    assert(dbHealthRes.status === 200, 'Database health check returns 200 OK');
    const dbHealthData = await dbHealthRes.json();
    assert(dbHealthData.database === 'connected', 'Database reports connected state');

    // -------------------------------------------------------------
    // Step 2: Create Beta Reader A
    // -------------------------------------------------------------
    console.log('\n[Step 2] Admin Creates Beta Reader A');
    const betaUsername = `beta_alice_${Date.now()}`;
    const createBetaRes = await fetch(`${baseUrl}/api/admin/beta-readers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: betaUsername,
        password: 'password123',
        displayName: 'Alice Beta',
      }),
    });
    assert(createBetaRes.status === 201, 'Admin creates Beta A returns 201 Created');
    const { reader: betaReader } = await createBetaRes.json();
    assert(betaReader.username === betaUsername, 'Beta A username matches');

    // -------------------------------------------------------------
    // Step 3: Admin Uploads 3-Chapter Book
    // -------------------------------------------------------------
    console.log('\n[Step 3] Admin Uploads 3-Chapter Book');
    const sampleChapters = [
      {
        index: 1,
        title: 'Chương 1: Khởi đầu',
        paragraphs: [
          'Hôm nay là một ngày nắng đẹp trời.',
          'Gió nhẹ thoang thoảng qua cánh đồng hoa.',
          'Cô bé bước đi chầm chậm trên con đường làng.',
        ],
        wordCount: 30,
      },
      {
        index: 2,
        title: 'Chương 2: Thử thách',
        paragraphs: [
          'Mây đen bắt đầu kéo đến ùn ùn trên bầu trời.',
          'Sấm chớp rền vang báo hiệu một cơn mưa lớn sắp tới.',
          'Cô bé vội vã tìm một mái hiên để trú chân.',
        ],
        wordCount: 35,
      },
      {
        index: 3,
        title: 'Chương 3: Bình yên',
        paragraphs: [
          'Cơn mưa rào nhanh chóng tạnh hẳn sau một tiếng đồng hồ.',
          'Cầu vồng rực rỡ bảy màu hiện ra nơi chân trời phía đông.',
          'Hương thơm cây cỏ dịu mát lan tỏa khắp không gian.',
        ],
        wordCount: 32,
      },
    ];

    const createBookRes = await fetch(`${baseUrl}/api/admin/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Hành Trình Mùa Hạ',
        author: 'Nguyễn Văn A',
        fileFormat: 'TXT',
        chapters: sampleChapters,
      }),
    });
    assert(createBookRes.status === 201, 'Admin uploads 3-chapter book returns 201 Created');
    const { book } = await createBookRes.json();
    assert(book.totalChapters === 3, 'Book total chapters is 3');

    // -------------------------------------------------------------
    // Step 4: Admin Assigns Book to Beta A
    // -------------------------------------------------------------
    console.log('\n[Step 4] Admin Assigns Book to Beta A');
    const assignRes = await fetch(`${baseUrl}/api/admin/books/${book.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ betaUserId: betaReader.id }),
    });
    assert(assignRes.status === 200, 'Assign book to Beta A returns 200 OK');
    const { assignment } = await assignRes.json();
    assert(assignment.status === 'ACTIVE', 'Assignment status is ACTIVE');

    // -------------------------------------------------------------
    // Step 5: Beta A Logins & Verifies Lean Egress Rules
    // -------------------------------------------------------------
    console.log('\n[Step 5] Beta A Login & Lean Egress Hard Rules');
    const betaLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: betaUsername, password: 'password123' }),
    });
    assert(betaLoginRes.status === 200, 'Beta A login returns 200 OK');
    const { token: betaToken } = await betaLoginRes.json();

    // 5.1 Hard rule: GET /api/books excludes paragraphs
    const booksRes = await fetch(`${baseUrl}/api/books`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    assert(booksRes.status === 200, 'Beta A list books returns 200 OK');
    const { books } = await booksRes.json();
    assert(books.length === 1, 'Beta A sees exactly assigned book');
    assert(books[0].paragraphs === undefined, 'Hard rule: GET /api/books strictly excludes paragraphs');

    // 5.2 Hard rule: GET /api/books/:id/chapters excludes paragraphs
    const tocRes = await fetch(`${baseUrl}/api/books/${book.id}/chapters`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    assert(tocRes.status === 200, 'Beta A TOC returns 200 OK');
    const { chapters: tocChapters } = await tocRes.json();
    assert(tocChapters.length === 3, 'TOC contains all 3 chapters');
    assert(tocChapters[0].paragraphs === undefined, 'Hard rule: Chapter 1 TOC excludes paragraphs');
    assert(tocChapters[1].paragraphs === undefined, 'Hard rule: Chapter 2 TOC excludes paragraphs');
    assert(tocChapters[2].paragraphs === undefined, 'Hard rule: Chapter 3 TOC excludes paragraphs');

    // -------------------------------------------------------------
    // Step 6: Initial Readiness Check (Expect NOT_READY with blockers)
    // -------------------------------------------------------------
    console.log('\n[Step 6] Initial Readiness Check');
    const readinessRes1 = await fetch(`${baseUrl}/api/admin/books/${book.id}/readiness`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(readinessRes1.status === 200, 'Readiness check returns 200 OK');
    const rData1 = await readinessRes1.json();
    assert(rData1.ready === false, 'Readiness is false initially');
    assert(rData1.totalChapters === 3, 'Total chapters is 3');
    assert(rData1.betaCompleted === 0, 'Beta completed chapters is 0');
    assert(rData1.approved === 0, 'Approved chapters is 0');
    assert(rData1.blockers.length > 0, 'Blockers list is populated');
    console.log(`  ✓ Detected ${rData1.blockers.length} blockers: ${rData1.blockers[0]}`);

    // -------------------------------------------------------------
    // Step 7: Open Chapter 1, ETag & Cache Verification
    // -------------------------------------------------------------
    console.log('\n[Step 7] Open Chapter 1 & ETag Validation');
    const ch1Res = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    assert(ch1Res.status === 200, 'First open chapter 1 returns 200 OK');
    const etag1 = ch1Res.headers.get('etag');
    assert(Boolean(etag1), 'Server returned ETag header');
    const ch1Data = await ch1Res.json();
    assert(Array.isArray(ch1Data.chapter.paragraphs), 'Chapter 1 returns paragraphs array');
    assert(ch1Data.chapter.paragraphs.length === 3, 'Chapter 1 has 3 paragraphs');

    // Conditional GET test (304 Not Modified)
    const ch1ConditionalRes = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${betaToken}`, 'If-None-Match': etag1! },
    });
    assert(ch1ConditionalRes.status === 304, 'Conditional GET returns 304 Not Modified when ETag matches');

    // -------------------------------------------------------------
    // Step 8: Create Edit (Revision 1) & Update Edit (Revision 2) + Concurrency Test
    // -------------------------------------------------------------
    console.log('\n[Step 8] Create & Update Edit with Optimistic Concurrency Check');
    const createEditRes = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${betaToken}` },
      body: JSON.stringify({
        paragraphIndex: 1,
        startOffset: 0,
        endOffset: 7, // 'Gió nhẹ'
        originalText: 'Gió nhẹ',
        proposedText: 'Làn gió nhẹ',
        errorType: 'VAN_PHONG',
        reason: 'Tăng tính biểu cảm',
      }),
    });
    assert(createEditRes.status === 201, 'Create edit returns 201 Created');
    const { edit: createdEdit } = await createEditRes.json();
    assert(createdEdit.version === 1, 'Edit version is 1');

    // Optimistic Concurrency Test: simultaneous update with wrong/stale expectedVersion
    const staleUpdateRes = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/edits/${createdEdit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${betaToken}` },
      body: JSON.stringify({
        proposedText: 'Cơn gió nhẹ',
        errorType: 'VAN_PHONG',
        expectedVersion: 99, // Stale version
      }),
    });
    assert(staleUpdateRes.status === 409, 'Stale expectedVersion rejected with 409 Conflict');
    const staleData = await staleUpdateRes.json();
    assert(staleData.code === 'EDIT_CONFLICT', 'Error code is EDIT_CONFLICT');

    // Valid update to Revision 2
    const validUpdateRes = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/edits/${createdEdit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${betaToken}` },
      body: JSON.stringify({
        proposedText: 'Ngọn gió mát lành',
        errorType: 'VAN_PHONG',
        expectedVersion: 1,
      }),
    });
    assert(validUpdateRes.status === 200, 'Valid update returns 200 OK');
    const { edit: updatedEdit } = await validUpdateRes.json();
    assert(updatedEdit.version === 2, 'Edit version incremented to 2');

    // -------------------------------------------------------------
    // Step 9: Complete Chapter 1 & Admin Approval Invariant Test
    // -------------------------------------------------------------
    console.log('\n[Step 9] Complete Chapter 1 & Admin Review');
    // Admin tries to approve before completion -> Must FAIL
    const prematureApproveRes = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/1/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(prematureApproveRes.status === 400, 'Premature approval before COMPLETED fails with 400 Bad Request');

    // Beta marks chapter 1 completed
    const completeCh1Res = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    assert(completeCh1Res.status === 200, 'Complete chapter 1 returns 200 OK');

    // Admin tries to approve while edit is still PENDING -> Must FAIL
    const pendingApproveRes = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/1/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(pendingApproveRes.status === 400, 'Approval fails while pending edits remain');

    // Admin reviews edit: ACCEPT revision 2
    const reviewEditRes = await fetch(`${baseUrl}/api/admin/edits/${createdEdit.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        decision: 'ACCEPTED',
        comment: 'Đồng ý sửa đổi',
        expectedRevisionNumber: 2,
        expectedEditVersion: 2,
      }),
    });
    assert(reviewEditRes.status === 201, 'Admin accepts edit revision 2');

    // Now Admin approves Chapter 1 -> Must SUCCEED!
    const approveCh1Res = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/1/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(approveCh1Res.status === 200, 'Admin approves completed chapter 1');

    // Invariant check: post-approval new edit triggers automatic REOPENED!
    const postApprovalEdit = await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${betaToken}` },
      body: JSON.stringify({
        paragraphIndex: 2,
        startOffset: 0,
        endOffset: 5,
        originalText: 'Cô bé',
        proposedText: 'Thiếu nữ',
        errorType: 'VAN_PHONG',
      }),
    });
    assert(postApprovalEdit.status === 201, 'Beta creates post-approval edit');
    const { edit: postEdit } = await postApprovalEdit.json();

    // Check readiness shows conflict/reopened
    const readinessRes2 = await fetch(`${baseUrl}/api/admin/books/${book.id}/readiness`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const rData2 = await readinessRes2.json();
    assert(rData2.conflicts === 1, 'Readiness detects 1 REOPENED chapter conflict');

    // Admin accepts the new edit and re-approves chapter 1
    await fetch(`${baseUrl}/api/admin/edits/${postEdit.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: 'ACCEPTED', comment: 'Duyệt thêm' }),
    });
    await fetch(`${baseUrl}/api/books/${book.id}/chapters/1/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    const reApproveCh1Res = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/1/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(reApproveCh1Res.status === 200, 'Admin re-approves completed chapter 1');

    // -------------------------------------------------------------
    // Step 10: Complete & Approve Chapters 2 and 3
    // -------------------------------------------------------------
    console.log('\n[Step 10] Complete & Approve Chapters 2 and 3');
    // Open & Complete chapter 2
    await fetch(`${baseUrl}/api/books/${book.id}/chapters/2`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    await fetch(`${baseUrl}/api/books/${book.id}/chapters/2/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    // Approve chapter 2
    const approveCh2Res = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/2/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(approveCh2Res.status === 200, 'Admin approves chapter 2');

    // Open & Complete chapter 3
    await fetch(`${baseUrl}/api/books/${book.id}/chapters/3`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    await fetch(`${baseUrl}/api/books/${book.id}/chapters/3/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    // Approve chapter 3
    const approveCh3Res = await fetch(
      `${baseUrl}/api/admin/books/${book.id}/assignments/${assignment.id}/chapters/3/approve`,
      { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(approveCh3Res.status === 200, 'Admin approves chapter 3');

    // -------------------------------------------------------------
    // Step 11: Final Derived Readiness Verification (READY_TO_PUBLISH)
    // -------------------------------------------------------------
    console.log('\n[Step 11] Final Derived Readiness Verification');
    const finalReadinessRes = await fetch(`${baseUrl}/api/admin/books/${book.id}/readiness`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(finalReadinessRes.status === 200, 'Final readiness returns 200 OK');
    const finalReadiness = await finalReadinessRes.json();
    console.log('finalReadiness JSON:', finalReadiness);

    assert(finalReadiness.ready === true, 'Book is derived as READY_TO_PUBLISH (ready: true)');
    assert(finalReadiness.state === 'READY_TO_PUBLISH', 'Book state is READY_TO_PUBLISH');
    assert(finalReadiness.totalChapters === 3, 'Total chapters matches 3');
    assert(finalReadiness.betaCompleted === 3, 'All 3 chapters are Beta COMPLETED');
    assert(finalReadiness.approved === 3, 'All 3 chapters are Admin APPROVED');
    assert(finalReadiness.pendingEdits === 0, 'Zero pending edits remaining');
    assert(finalReadiness.changesRequested === 0, 'Zero changes requested remaining');
    assert(finalReadiness.conflicts === 0, 'Zero conflicts remaining');
    assert(finalReadiness.blockers.length === 0, 'Zero blockers remaining');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedAssertions} READINESS & QA ASSERTIONS PASSED!`);
    console.log('====================================================\n');
  } finally {
    server.close();
    if (fs.existsSync(testDbFile)) {
      try { fs.unlinkSync(testDbFile); } catch {}
    }
  }
};

runReadinessTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
