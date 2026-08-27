import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { queryAll, queryOne, run, transaction } from '../db/database.js';

export const listBetaReaders = async (_req: Request, res: Response): Promise<void> => {
  const readers = await queryAll<any>(`
    SELECT 
      p.id, 
      p.username, 
      p.display_name AS displayName, 
      p.role, 
      p.is_active AS isActive, 
      p.created_at AS createdAt,
      COUNT(ba.id) AS assignedBooksCount
    FROM profiles p
    LEFT JOIN beta_assignments ba ON ba.beta_user_id = p.id AND ba.status = 'ACTIVE'
    WHERE p.role = 'BETA_READER'
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);

  res.json({
    readers: readers.map(r => ({
      ...r,
      isActive: Boolean(r.isActive),
    })),
  });
};

export const createBetaReader = async (req: Request, res: Response): Promise<void> => {
  const { username, password, displayName } = req.body;

  if (!username || !password || !displayName) {
    res.status(400).json({ error: 'Vui lòng điền đầy đủ tên đăng nhập, mật khẩu và tên hiển thị' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanDisplayName = String(displayName).trim();

  if (cleanUsername.length < 3) {
    res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    return;
  }

  const existing = await queryOne('SELECT id FROM profiles WHERE lower(username) = ?', cleanUsername);
  if (existing) {
    res.status(409).json({ error: 'Tên đăng nhập này đã được sử dụng' });
    return;
  }

  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  await run(
    `INSERT INTO profiles (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'BETA_READER', TRUE, ?, ?)`,
    id,
    cleanUsername,
    passwordHash,
    cleanDisplayName,
    now,
    now
  );

  res.status(201).json({
    reader: {
      id,
      username: cleanUsername,
      displayName: cleanDisplayName,
      role: 'BETA_READER',
      isActive: true,
      createdAt: now,
    },
  });
};

export const toggleBetaReaderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isActive } = req.body;

  const target = await queryOne<any>('SELECT id, role FROM profiles WHERE id = ?', id);
  if (!target) {
    res.status(404).json({ error: 'Không tìm thấy người dùng' });
    return;
  }

  if (target.role === 'ADMIN') {
    res.status(400).json({ error: 'Không thể vô hiệu hóa tài khoản Quản trị viên' });
    return;
  }

  const activeBool = Boolean(isActive);
  const now = new Date().toISOString();

  await run('UPDATE profiles SET is_active = ?, updated_at = ? WHERE id = ?', activeBool, now, id);

  res.json({
    success: true,
    id,
    isActive: activeBool,
  });
};

export const listBooks = async (_req: Request, res: Response): Promise<void> => {
  // Query books without duplicating rows
  const books = await queryAll<any>(`
    SELECT 
      b.id,
      b.title,
      b.author,
      b.cover_url AS coverUrl,
      b.cover_color AS coverColor,
      b.original_file_name AS originalFileName,
      b.file_format AS fileFormat,
      b.total_chapters AS totalChapters,
      b.word_count AS wordCount,
      b.status,
      b.created_by AS createdBy,
      b.created_at AS createdAt,
      b.updated_at AS updatedAt
    FROM beta_books b
    ORDER BY b.created_at DESC
  `);

  // Query all active assignments with reader profile and progress
  const assignments = await queryAll<any>(`
    SELECT 
      ba.id,
      ba.book_id AS bookId,
      ba.beta_user_id AS betaUserId,
      ba.assigned_at AS assignedAt,
      ba.status AS assignmentStatus,
      p.username,
      p.display_name AS displayName,
      COALESCE(ap.current_chapter_index, 1) AS currentChapterIndex,
      COALESCE(ap.overall_percentage, 0) AS overallPercentage,
      COALESCE(ap.completed_chapters_count, 0) AS completedChaptersCount,
      ap.last_read_at AS lastReadAt
    FROM beta_assignments ba
    JOIN profiles p ON p.id = ba.beta_user_id
    LEFT JOIN beta_assignment_progress ap ON ap.assignment_id = ba.id
    WHERE ba.status = 'ACTIVE'
  `);

  // Group assignments by bookId
  const assignmentMap: Record<string, any[]> = {};
  for (const a of assignments) {
    if (!assignmentMap[a.bookId]) {
      assignmentMap[a.bookId] = [];
    }
    assignmentMap[a.bookId].push({
      id: a.id,
      betaUserId: a.betaUserId,
      username: a.username,
      displayName: a.displayName,
      assignedAt: a.assignedAt,
      status: a.assignmentStatus,
      currentChapterIndex: a.currentChapterIndex,
      overallPercentage: a.overallPercentage,
      completedChaptersCount: a.completedChaptersCount,
      lastReadAt: a.lastReadAt,
    });
  }

  const formatted = books.map(b => {
    const bookAssignments = assignmentMap[b.id] || [];
    const firstAssignment = bookAssignments[0] || null;

    return {
      id: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      coverColor: b.coverColor,
      originalFileName: b.originalFileName,
      fileFormat: b.fileFormat,
      totalChapters: b.totalChapters,
      wordCount: b.wordCount,
      status: b.status,
      createdBy: b.createdBy,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      assignments: bookAssignments,
      assignedTo: firstAssignment ? {
        id: firstAssignment.betaUserId,
        username: firstAssignment.username,
        displayName: firstAssignment.displayName,
        assignedAt: firstAssignment.assignedAt,
        status: firstAssignment.status,
        completedChaptersCount: firstAssignment.completedChaptersCount,
        currentChapterIndex: firstAssignment.currentChapterIndex,
        overallPercentage: firstAssignment.overallPercentage,
        lastReadAt: firstAssignment.lastReadAt,
      } : null,
    };
  });

  res.json({ books: formatted });
};

export const saveParsedBook = async (req: Request, res: Response): Promise<void> => {
  const {
    title,
    author,
    coverUrl,
    coverColor,
    originalFileName,
    fileFormat,
    totalChapters,
    wordCount,
    chapters,
  } = req.body;

  if (!title || !chapters || !Array.isArray(chapters) || chapters.length === 0) {
    res.status(400).json({ error: 'Dữ liệu truyện không hợp lệ hoặc thiếu chương' });
    return;
  }

  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const creatorId = req.user?.id || 'admin-root-id';

  await transaction(async () => {
    // 1. Insert book
    await run(
      `INSERT INTO beta_books (
        id, title, author, cover_url, cover_color, original_file_name,
        file_format, total_chapters, word_count, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      bookId,
      String(title).trim(),
      String(author || 'Chưa rõ tác giả').trim(),
      coverUrl || null,
      coverColor || '#D9829B',
      originalFileName || 'tailen.txt',
      fileFormat || 'TXT',
      totalChapters || chapters.length,
      wordCount || 0,
      creatorId,
      now,
      now
    );

    // 2. Insert chapters
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const chapterId = `ch-${bookId}-${i + 1}`;
      const paragraphsJson = JSON.stringify(ch.paragraphs || []);
      const hash = crypto.createHash('sha256').update(paragraphsJson).digest('hex');

      await run(
        `INSERT INTO beta_chapters (
          id, book_id, chapter_index, title, paragraphs, word_count, content_version, content_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        chapterId,
        bookId,
        ch.index || (i + 1),
        ch.title || `Chương ${i + 1}`,
        paragraphsJson,
        ch.wordCount || 0,
        hash,
        now,
        now
      );
    }

    // 3. Log activity
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await run(
      'INSERT INTO beta_activity_logs (id, user_id, action, book_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      logId,
      creatorId,
      'BOOK_CREATED',
      bookId,
      JSON.stringify({ title, totalChapters: chapters.length }),
      now
    );
  });

  res.status(201).json({
    book: {
      id: bookId,
      title,
      author,
      coverUrl,
      coverColor: coverColor || '#D9829B',
      fileFormat,
      totalChapters: chapters.length,
      wordCount,
      status: 'DRAFT',
      createdAt: now,
    },
  });
};

export const deleteBook = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const book = await queryOne('SELECT id, title FROM beta_books WHERE id = ?', id);
  if (!book) {
    res.status(404).json({ error: 'Không tìm thấy tác phẩm' });
    return;
  }

  await run('DELETE FROM beta_books WHERE id = ?', id);
  res.json({ success: true, message: 'Đã xóa truyện thành công' });
};

export const assignBook = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // bookId
  const { betaUserId } = req.body;

  if (!betaUserId) {
    res.status(400).json({ error: 'Thiếu thông tin người dùng được giao' });
    return;
  }

  const book = await queryOne<any>('SELECT id, title FROM beta_books WHERE id = ?', id);
  if (!book) {
    res.status(404).json({ error: 'Không tìm thấy tác phẩm' });
    return;
  }

  const reader = await queryOne<any>('SELECT id, username, display_name, role, is_active FROM profiles WHERE id = ?', betaUserId);
  if (!reader || reader.role !== 'BETA_READER' || !reader.is_active) {
    res.status(400).json({ error: 'Người dùng không tồn tại hoặc không phải là Beta Reader đang hoạt động' });
    return;
  }

  const now = new Date().toISOString();
  const assignmentId = `assign-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const adminId = req.user?.id || 'admin-root-id';

  await transaction(async () => {
    // 1. Upsert assignment
    await run(
      `INSERT INTO beta_assignments (id, book_id, beta_user_id, assigned_by, assigned_at, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')
       ON CONFLICT(book_id, beta_user_id) DO UPDATE SET
         assigned_by = excluded.assigned_by,
         assigned_at = excluded.assigned_at,
         status = 'ACTIVE'`,
      assignmentId,
      id,
      betaUserId,
      adminId,
      now
    );

    // 2. Update book status to ASSIGNED if currently DRAFT
    await run(
      `UPDATE beta_books SET status = 'ASSIGNED', updated_at = ? WHERE id = ? AND status = 'DRAFT'`,
      now,
      id
    );

    // 3. Initialize assignment progress row if not existing
    const existingProgress = await queryOne(
      'SELECT id FROM beta_assignment_progress WHERE book_id = ? AND beta_user_id = ?',
      id,
      betaUserId
    );

    if (!existingProgress) {
      const progressId = `prog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await run(
        `INSERT INTO beta_assignment_progress (
          id, assignment_id, book_id, beta_user_id, current_chapter_index, overall_percentage, completed_chapters_count, last_read_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, 0, 0, ?, ?)`,
        progressId,
        assignmentId,
        id,
        betaUserId,
        now,
        now
      );
    }

    // 4. Log activity
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await run(
      'INSERT INTO beta_activity_logs (id, user_id, action, book_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      logId,
      adminId,
      'BOOK_ASSIGNED',
      id,
      JSON.stringify({ bookTitle: book.title, assignedTo: reader.display_name, betaUserId }),
      now
    );
  });

  res.json({
    success: true,
    assignment: {
      id: assignmentId,
      bookId: id,
      betaUserId,
      assignedBy: adminId,
      assignedAt: now,
      status: 'ACTIVE',
      assignedTo: {
        id: reader.id,
        username: reader.username,
        displayName: reader.display_name,
      },
    },
  });
};

export const revokeAssignment = async (req: Request, res: Response): Promise<void> => {
  const { id, userId } = req.params;

  await run(
    `UPDATE beta_assignments SET status = 'REVOKED' WHERE book_id = ? AND beta_user_id = ?`,
    id,
    userId
  );

  // Check if any other active assignment exists for this book
  const otherAssignments = await queryOne<any>(
    `SELECT COUNT(id) AS count FROM beta_assignments WHERE book_id = ? AND status = 'ACTIVE'`,
    id
  );

  if (!otherAssignments || Number(otherAssignments.count) === 0) {
    await run(`UPDATE beta_books SET status = 'DRAFT', updated_at = ? WHERE id = ?`, new Date().toISOString(), id);
  }

  res.json({ success: true, message: 'Đã hủy phân công' });
};

export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10)));
  const rawCursor = req.query.cursor ? String(req.query.cursor) : null;

  let sql = `
    SELECT 
      l.id,
      l.user_id AS userId,
      l.action,
      l.book_id AS bookId,
      l.chapter_id AS chapterId,
      l.details,
      l.created_at AS createdAt,
      p.username AS userName,
      p.display_name AS userDisplayName,
      b.title AS bookTitle
    FROM beta_activity_logs l
    LEFT JOIN profiles p ON p.id = l.user_id
    LEFT JOIN beta_books b ON b.id = l.book_id
  `;
  const params: any[] = [];

  if (rawCursor) {
    // Support compound cursor format createdAt#id or standard ISO timestamp
    if (rawCursor.includes('#')) {
      const [cursorTime, cursorId] = rawCursor.split('#');
      sql += ` WHERE (l.created_at < ? OR (l.created_at = ? AND l.id < ?))`;
      params.push(cursorTime, cursorTime, cursorId);
    } else {
      sql += ` WHERE l.created_at < ?`;
      params.push(rawCursor);
    }
  }

  sql += ` ORDER BY l.created_at DESC, l.id DESC LIMIT ?`;
  params.push(limit + 1);

  const rows = await queryAll<any>(sql, ...params);
  const hasMore = rows.length > limit;
  const logs = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor = hasMore && logs.length > 0
    ? `${logs[logs.length - 1].createdAt}#${logs[logs.length - 1].id}`
    : null;

  res.json({ logs, nextCursor, hasMore, limit });
};

/**
 * Phase 5: Derived Book Readiness Check
 * Endpoint: GET /api/admin/books/:id/readiness
 * Returns derived publish readiness status based strictly on database invariants.
 * Zero N+1 queries. Cannot be manually faked.
 */
export const getBookReadiness = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const book = await queryOne<any>(
    'SELECT id, title, total_chapters, status FROM beta_books WHERE id = ?',
    id
  );

  if (!book) {
    res.status(404).json({ error: 'Không tìm thấy tác phẩm' });
    return;
  }

  const totalChapters = Number(book.total_chapters) || 0;

  // 1. Beta completed chapters count
  const completedRes = await queryOne<any>(
    `SELECT COUNT(DISTINCT chapter_index) AS count 
     FROM beta_chapter_status 
     WHERE book_id = ? AND status = 'COMPLETED'`,
    id
  );
  const betaCompleted = Number(completedRes?.count) || 0;

  // 2. Admin approved chapters count
  const approvedRes = await queryOne<any>(
    `SELECT COUNT(DISTINCT chapter_index) AS count 
     FROM beta_chapter_reviews 
     WHERE book_id = ? AND status = 'APPROVED'`,
    id
  );
  const approved = Number(approvedRes?.count) || 0;

  // 3. Pending edits and Changes Requested counts via single aggregate query
  const editsSummary = await queryOne<any>(`
    SELECT 
      COALESCE(SUM(CASE WHEN latest_decision IS NULL THEN 1 ELSE 0 END), 0) AS pending_edits,
      COALESCE(SUM(CASE WHEN latest_decision = 'CHANGES_REQUESTED' THEN 1 ELSE 0 END), 0) AS changes_requested
    FROM (
      SELECT 
        e.id,
        (
          SELECT r.decision 
          FROM beta_edit_reviews r 
          WHERE r.edit_id = e.id 
          ORDER BY r.created_at DESC 
          LIMIT 1
        ) AS latest_decision
      FROM beta_edits e
      WHERE e.book_id = ? AND e.status = 'ACTIVE'
    ) sub
  `, id);

  const pendingEdits = Number(editsSummary?.pending_edits) || 0;
  const changesRequested = Number(editsSummary?.changes_requested) || 0;

  // 4. Conflicts count
  const conflictsRes = await queryOne<any>(
    `SELECT COUNT(id) AS count 
     FROM beta_chapter_reviews 
     WHERE book_id = ? AND status = 'REOPENED'`,
    id
  );
  const conflicts = Number(conflictsRes?.count) || 0;

  // 5. Compile blockers
  const blockers: string[] = [];

  if (totalChapters === 0) {
    blockers.push('Tác phẩm chưa có chương nào được phân tích.');
  }

  if (betaCompleted < totalChapters) {
    blockers.push(`Còn ${totalChapters - betaCompleted} chương chưa hoàn thành đọc Beta (COMPLETED).`);
  }

  if (approved < totalChapters) {
    blockers.push(`Còn ${totalChapters - approved} chương chưa được Quản trị viên duyệt (APPROVED).`);
  }

  if (pendingEdits > 0) {
    blockers.push(`Còn ${pendingEdits} đề xuất sửa đổi đang chờ Quản trị viên duyệt (PENDING).`);
  }

  if (changesRequested > 0) {
    blockers.push(`Còn ${changesRequested} đề xuất sửa đổi đang yêu cầu chỉnh sửa lại (CHANGES_REQUESTED).`);
  }

  if (conflicts > 0) {
    blockers.push(`Có ${conflicts} chương đang ở trạng thái bị mở lại do có sửa đổi mới sau khi duyệt (REOPENED).`);
  }

  const ready = blockers.length === 0 && totalChapters > 0;

  let state: 'READY_TO_PUBLISH' | 'IN_REVIEW' | 'IN_BETA' | 'NOT_READY' = 'NOT_READY';
  if (ready) {
    state = 'READY_TO_PUBLISH';
  } else if (approved > 0) {
    state = 'IN_REVIEW';
  } else if (betaCompleted > 0 || book.status === 'IN_BETA' || book.status === 'ASSIGNED') {
    state = 'IN_BETA';
  }

  res.json({
    ready,
    state,
    totalChapters,
    betaCompleted,
    approved,
    pendingEdits,
    changesRequested,
    conflicts,
    blockers,
  });
};
