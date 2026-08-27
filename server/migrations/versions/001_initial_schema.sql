-- LilyBeta Migration 001: Initial Schema (Phase 1 Baseline)

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'BETA_READER')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Beta Books
CREATE TABLE IF NOT EXISTS beta_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  cover_color TEXT DEFAULT '#D9829B',
  original_file_name TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK(file_format IN ('TXT', 'EPUB', 'DOCX')),
  total_chapters INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ASSIGNED', 'IN_BETA', 'BETA_COMPLETE', 'ARCHIVED')),
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_books_status ON beta_books(status);
CREATE INDEX IF NOT EXISTS idx_beta_books_created_by ON beta_books(created_by);

-- 3. Beta Chapters
CREATE TABLE IF NOT EXISTS beta_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  paragraphs TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(book_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapters_book ON beta_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_beta_chapters_index ON beta_chapters(book_id, chapter_index);

-- 4. Beta Assignments
CREATE TABLE IF NOT EXISTS beta_assignments (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES profiles(id),
  assigned_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'REVOKED')),
  UNIQUE(book_id, beta_user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_assignments_user ON beta_assignments(beta_user_id, status);
CREATE INDEX IF NOT EXISTS idx_beta_assignments_book ON beta_assignments(book_id, status);

-- 5. Legacy Beta Chapter Progress (Table in Phase 1)
CREATE TABLE IF NOT EXISTS beta_chapter_progress (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  chapter_index INTEGER NOT NULL DEFAULT 1,
  scroll_percent REAL DEFAULT 0,
  scroll_offset REAL DEFAULT 0,
  percentage REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(book_id, beta_user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapter_progress_user ON beta_chapter_progress(beta_user_id, book_id);

-- 6. Beta Activity Logs
CREATE TABLE IF NOT EXISTS beta_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  book_id TEXT,
  chapter_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_activity_user ON beta_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_activity_action ON beta_activity_logs(action);
