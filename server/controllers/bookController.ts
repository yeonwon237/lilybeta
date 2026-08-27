import { Request, Response } from 'express';
import { queryAll, queryOne, run } from '../db/database.js';

export const listBooks = (req: Request, res: Response): void => {
  const user = req.user!;

  if (user.role === 'ADMIN') {
    const books = queryAll<any>(`
      SELECT 
        b.id,
        b.title,
        b.author,
        b.cover_url AS coverUrl,
        b.cover_color AS coverColor,
        b.total_chapters AS totalChapters,
        b.word_count AS wordCount,
        b.file_format AS fileFormat,
        b.status,
        b.created_at AS createdAt,
        b.updated_at AS updatedAt
      FROM beta_books b
      ORDER BY b.created_at DESC
    `);
    res.json({ books });
    return;
  }

  // Beta Reader: strictly scoped to active assignments
  const assignedBooks = queryAll<any>(`
    SELECT 
      b.id,
      b.title,
      b.author,
      b.cover_url AS coverUrl,
      b.cover_color AS coverColor,
      b.total_chapters AS totalChapters,
      b.word_count AS wordCount,
      b.file_format AS fileFormat,
      b.status,
      b.created_at AS createdAt,
      ba.assigned_at AS assignedAt,
      COALESCE(prog.chapter_index, 1) AS currentChapter,
      COALESCE(prog.percentage, 0) AS progressPercent,
      prog.updated_at AS lastReadAt
    FROM beta_books b
    INNER JOIN beta_assignments ba ON ba.book_id = b.id AND ba.status = 'ACTIVE'
    LEFT JOIN beta_chapter_progress prog ON prog.book_id = b.id AND prog.beta_user_id = ba.beta_user_id
    WHERE ba.beta_user_id = ?
    ORDER BY ba.assigned_at DESC
  `, user.id);

  res.json({ books: assignedBooks });
};

export const getBook = (req: Request, res: Response): void => {
  const { id } = req.params;
  const user = req.user!;

  const book = queryOne<any>(`
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
      b.created_at AS createdAt,
      b.updated_at AS updatedAt
    FROM beta_books b
    WHERE b.id = ?
  `, id);

  if (!book) {
    res.status(404).json({ error: 'Không tìm thấy tác phẩm' });
    return;
  }

  // Fetch progress for this user
  const progress = queryOne<any>(`
    SELECT 
      chapter_index AS currentChapter,
      scroll_percent AS scrollPercent,
      percentage AS progressPercent,
      updated_at AS lastReadAt
    FROM beta_chapter_progress
    WHERE book_id = ? AND beta_user_id = ?
  `, id, user.id);

  // Log activity
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    run(
      'INSERT INTO beta_activity_logs (id, user_id, action, book_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      logId,
      user.id,
      'BOOK_OPENED',
      id,
      JSON.stringify({ bookTitle: book.title }),
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }

  res.json({
    book: {
      ...book,
      currentChapter: progress?.currentChapter || 1,
      progressPercent: progress?.progressPercent || 0,
      lastReadAt: progress?.lastReadAt,
    },
  });
};

export const getChapterList = (req: Request, res: Response): void => {
  const { id } = req.params;
  const user = req.user!;

  const progress = queryOne<any>(
    'SELECT chapter_index FROM beta_chapter_progress WHERE book_id = ? AND beta_user_id = ?',
    id,
    user.id
  );
  const currentChapterIndex = progress ? progress.chapter_index : 1;

  const chapters = queryAll<any>(`
    SELECT 
      id,
      chapter_index AS "index",
      title,
      word_count AS wordCount
    FROM beta_chapters
    WHERE book_id = ?
    ORDER BY chapter_index ASC
  `, id);

  const formatted = chapters.map(ch => ({
    id: ch.id,
    index: ch.index,
    title: ch.title,
    wordCount: ch.wordCount,
    isRead: ch.index < currentChapterIndex,
    isCurrent: ch.index === currentChapterIndex,
  }));

  res.json({ chapters: formatted });
};

export const getChapter = (req: Request, res: Response): void => {
  const { id, index } = req.params;
  const chapterNum = parseInt(String(index), 10);
  const user = req.user!;

  if (isNaN(chapterNum) || chapterNum < 1) {
    res.status(400).json({ error: 'Chỉ số chương không hợp lệ' });
    return;
  }

  const chapter = queryOne<any>(`
    SELECT 
      id,
      book_id AS bookId,
      chapter_index AS "index",
      title,
      paragraphs,
      word_count AS wordCount,
      created_at AS createdAt
    FROM beta_chapters
    WHERE book_id = ? AND chapter_index = ?
  `, id, chapterNum);

  if (!chapter) {
    res.status(404).json({ error: 'Không tìm thấy chương' });
    return;
  }

  let paragraphs: string[] = [];
  try {
    paragraphs = JSON.parse(chapter.paragraphs);
  } catch {
    paragraphs = [chapter.paragraphs];
  }

  // Log activity
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    run(
      'INSERT INTO beta_activity_logs (id, user_id, action, book_id, chapter_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      logId,
      user.id,
      'CHAPTER_OPENED',
      id,
      chapter.id,
      JSON.stringify({ chapterIndex: chapterNum, chapterTitle: chapter.title }),
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to log chapter open:', err);
  }

  res.json({
    chapter: {
      id: chapter.id,
      bookId: chapter.bookId,
      index: chapter.index,
      title: chapter.title,
      wordCount: chapter.wordCount,
      paragraphs,
      createdAt: chapter.createdAt,
    },
  });
};

export const getProgress = (req: Request, res: Response): void => {
  const { id } = req.params;
  const user = req.user!;

  const progress = queryOne<any>(`
    SELECT 
      p.book_id AS bookId,
      p.chapter_index AS chapterIndex,
      c.title AS chapterTitle,
      p.percentage,
      p.scroll_percent AS scrollPercent,
      p.scroll_offset AS scrollOffset,
      p.updated_at AS updatedAt
    FROM beta_chapter_progress p
    LEFT JOIN beta_chapters c ON c.book_id = p.book_id AND c.chapter_index = p.chapter_index
    WHERE p.book_id = ? AND p.beta_user_id = ?
  `, id, user.id);

  res.json({ progress: progress || null });
};

export const saveProgress = (req: Request, res: Response): void => {
  const { id } = req.params; // bookId
  const { chapterIndex, percentage, scrollPercent, scrollOffset } = req.body;
  const user = req.user!;

  const cleanChapterIndex = parseInt(chapterIndex, 10) || 1;
  const cleanPercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  const cleanScrollPercent = Math.min(100, Math.max(0, Number(scrollPercent) || 0));
  const cleanScrollOffset = Number(scrollOffset) || 0;
  const now = new Date().toISOString();

  // Find assignment
  const assignment = queryOne<any>(
    'SELECT id FROM beta_assignments WHERE book_id = ? AND beta_user_id = ? AND status = ?',
    id,
    user.id,
    'ACTIVE'
  );

  const assignmentId = assignment ? assignment.id : 'no-assign';

  run(`
    INSERT INTO beta_chapter_progress (
      id, assignment_id, book_id, beta_user_id, status, chapter_index, scroll_percent, scroll_offset, percentage, updated_at
    ) VALUES (
      ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?
    )
    ON CONFLICT(book_id, beta_user_id) DO UPDATE SET
      chapter_index = excluded.chapter_index,
      scroll_percent = excluded.scroll_percent,
      scroll_offset = excluded.scroll_offset,
      percentage = excluded.percentage,
      status = 'IN_PROGRESS',
      updated_at = excluded.updated_at
  `,
    `prog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    assignmentId,
    id,
    user.id,
    cleanChapterIndex,
    cleanScrollPercent,
    cleanScrollOffset,
    cleanPercentage,
    now
  );

  res.json({ success: true, updatedAt: now });
};
