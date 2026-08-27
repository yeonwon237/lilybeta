import { createApp } from '../server/app.js';
import { runMigrations } from '../server/migrations/runner.js';
import http from 'node:http';

const runTests = async () => {
  console.log('====================================================');
  console.log('🚀 STARTING LILYBETA IDOR & ASSIGNMENT SECURITY TEST');
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

    // 4. Admin uploads Book A and Book B
    console.log('\n[Phase 4] Admin Uploads & Parses Books');
    const createBookARes = await fetch(`${baseUrl}/api/admin/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Chuyện Xứ Hoa (Book A)',
        author: 'Tác Giả A',
        originalFileName: 'chuyen_xu_hoa.txt',
        fileFormat: 'TXT',
        totalChapters: 2,
        wordCount: 1500,
        chapters: [
          { index: 1, title: 'Chương 1: Mùa xuân xứ hoa', wordCount: 800, paragraphs: ['Đoạn 1 sách A', 'Đoạn 2 sách A'] },
          { index: 2, title: 'Chương 2: Cánh đồng tuyết', wordCount: 700, paragraphs: ['Đoạn 3 sách A', 'Đoạn 4 sách A'] },
        ],
      }),
    });
    assert(createBookARes.status === 201, 'Admin upload Book A returns 201 Created');
    const bookA = (await createBookARes.json()).book;

    const createBookBRes = await fetch(`${baseUrl}/api/admin/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Bí Mật Đêm Trăng (Book B)',
        author: 'Tác Giả B',
        originalFileName: 'bi_mat_dem_trang.epub',
        fileFormat: 'EPUB',
        totalChapters: 2,
        wordCount: 2000,
        chapters: [
          { index: 1, title: 'Chương 1: Ánh trăng tà', wordCount: 1000, paragraphs: ['Bí mật B - Đoạn 1', 'Bí mật B - Đoạn 2'] },
          { index: 2, title: 'Chương 2: Tiếng đàn trong đêm', wordCount: 1000, paragraphs: ['Bí mật B - Đoạn 3', 'Bí mật B - Đoạn 4'] },
        ],
      }),
    });
    assert(createBookBRes.status === 201, 'Admin upload Book B returns 201 Created');
    const bookB = (await createBookBRes.json()).book;

    // 5. Admin assigns Book A -> Beta A, Book B -> Beta B
    console.log('\n[Phase 5] Admin Assigns Books');
    const assignARes = await fetch(`${baseUrl}/api/admin/books/${bookA.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ betaUserId: userA.id }),
    });
    assert(assignARes.status === 200, 'Assign Book A -> Beta A returns 200 OK');

    const assignBRes = await fetch(`${baseUrl}/api/admin/books/${bookB.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ betaUserId: userB.id }),
    });
    assert(assignBRes.status === 200, 'Assign Book B -> Beta B returns 200 OK');

    // 6. Verification: Beta A accesses Book A
    console.log('\n[Phase 6] Beta Reader A Authorized Access to Book A');
    const listBooksARes = await fetch(`${baseUrl}/api/books`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(listBooksARes.status === 200, 'Beta A listing books returns 200 OK');
    const booksForA = (await listBooksARes.json()).books;
    assert(booksForA.length === 1, 'Beta A sees exactly 1 assigned book');
    assert(booksForA[0].id === bookA.id, 'Beta A assigned book is Book A');

    const getBookARes = await fetch(`${baseUrl}/api/books/${bookA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getBookARes.status === 200, 'Beta A get Book A details returns 200 OK');

    const getChapterARes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getChapterARes.status === 200, 'Beta A get Chapter 1 of Book A returns 200 OK');
    const chAData = await getChapterARes.json();
    assert(chAData.chapter.paragraphs[0] === 'Đoạn 1 sách A', 'Beta A receives authentic chapter paragraphs');

    // 7. CRITICAL IDOR DEFENSE TEST: Beta A attempts to access Book B
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

    // 8. CRITICAL IDOR DEFENSE TEST: Beta B attempts to access Book A
    console.log('\n[Phase 8] 🛡️ MANDATORY IDOR TEST: Beta B attempts to access unassigned Book A');
    const idorBtoBookARes = await fetch(`${baseUrl}/api/books/${bookA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(idorBtoBookARes.status === 403, `IDOR Defense: GET /api/books/${bookA.id} as Beta B REJECTED with 403 Forbidden`);

    const idorBtoChapterARes = await fetch(`${baseUrl}/api/books/${bookA.id}/chapters/1`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(idorBtoChapterARes.status === 403, `IDOR Defense: GET /api/books/${bookA.id}/chapters/1 as Beta B REJECTED with 403 Forbidden`);

    // 9. Privilege Escalation Prevention
    console.log('\n[Phase 9] Privilege Escalation Defense');
    const privBetaListRes = await fetch(`${baseUrl}/api/admin/beta-readers`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(privBetaListRes.status === 403, 'Beta Reader forbidden from accessing admin routes (403)');

    const privAssignRes = await fetch(`${baseUrl}/api/admin/books/${bookB.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ betaUserId: userA.id }),
    });
    assert(privAssignRes.status === 403, 'Beta Reader forbidden from modifying assignments (403)');

    // 10. Disabled Account Blocking
    console.log('\n[Phase 10] Deactivated Account Blocking');
    const disableBRes = await fetch(`${baseUrl}/api/admin/beta-readers/${userB.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert(disableBRes.status === 200, 'Admin disables Beta Reader B returns 200 OK');

    const blockedTokenBRes = await fetch(`${baseUrl}/api/books`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(blockedTokenBRes.status === 401, 'Disabled user request immediately blocked with 401 Unauthorized');

    const blockedLoginBRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userBUsername, password: 'password123' }),
    });
    assert(blockedLoginBRes.status === 403, 'Disabled user login rejected with 403 Forbidden');

    // 11. Reading Progress Saving & Restore
    console.log('\n[Phase 11] Reading Progress Sync');
    const saveProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        chapterIndex: 2,
        percentage: 50,
        scrollPercent: 65.5,
      }),
    });
    assert(saveProgRes.status === 200, 'Save progress returns 200 OK');

    const getProgRes = await fetch(`${baseUrl}/api/books/${bookA.id}/progress`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getProgRes.status === 200, 'Get progress returns 200 OK');
    const progData = await getProgRes.json();
    assert(progData.progress.chapterIndex === 2, 'Restored chapterIndex is 2');
    assert(progData.progress.scrollPercent === 65.5, 'Restored scrollPercent is 65.5');

    // 12. Activity Logs Verification
    console.log('\n[Phase 12] Activity Audit Logs');
    const logsRes = await fetch(`${baseUrl}/api/admin/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(logsRes.status === 200, 'Admin query activity logs returns 200 OK');
    const logsData = await logsRes.json();
    assert(logsData.logs.length >= 4, 'Activity logs recorded (LOGIN, BOOK_CREATED, BOOK_ASSIGNED, CHAPTER_OPENED)');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedAssertions} SECURITY & IDOR ASSERTIONS PASSED!`);
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
