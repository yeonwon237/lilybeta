-- LilyBeta Migration 002: Chapter Workflow & Assignment Progress (Phase 2)

-- 1. Create Beta Assignment Progress table
CREATE TABLE IF NOT EXISTS beta_assignment_progress (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_chapter_index INTEGER NOT NULL DEFAULT 1,
  overall_percentage REAL DEFAULT 0,
  completed_chapters_count INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(book_id, beta_user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_assignment_progress_user ON beta_assignment_progress(beta_user_id, book_id);

-- 2. Create Beta Chapter Status table
CREATE TABLE IF NOT EXISTS beta_chapter_status (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  started_at TEXT,
  ready_at TEXT,
  completed_at TEXT,
  last_scroll_percent REAL DEFAULT 0,
  last_scroll_offset REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(assignment_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapter_status_assign ON beta_chapter_status(assignment_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_chapter_status_book ON beta_chapter_status(book_id, beta_user_id);

-- 3. Data Migration: Copy data from physical table beta_chapter_progress if it exists as a table
INSERT OR IGNORE INTO beta_assignment_progress (
  id, assignment_id, book_id, beta_user_id, current_chapter_index, overall_percentage, completed_chapters_count, last_read_at, updated_at
)
SELECT 
  'mig-ap-' || id,
  assignment_id,
  book_id,
  beta_user_id,
  COALESCE(chapter_index, 1),
  COALESCE(percentage, 0),
  CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END,
  updated_at,
  updated_at
FROM beta_chapter_progress
WHERE (SELECT type FROM sqlite_master WHERE name = 'beta_chapter_progress') = 'table';

INSERT OR IGNORE INTO beta_chapter_status (
  id, assignment_id, book_id, chapter_id, chapter_index, beta_user_id, status, last_scroll_percent, last_scroll_offset, updated_at
)
SELECT 
  'mig-cs-' || id,
  assignment_id,
  book_id,
  chapter_id,
  COALESCE(chapter_index, 1),
  beta_user_id,
  COALESCE(status, 'NOT_STARTED'),
  COALESCE(scroll_percent, 0),
  COALESCE(scroll_offset, 0),
  updated_at
FROM beta_chapter_progress
WHERE (SELECT type FROM sqlite_master WHERE name = 'beta_chapter_progress') = 'table';

-- 4. Safely drop physical table if it exists as a table
DROP TABLE IF EXISTS beta_chapter_progress;

-- 5. Create backward-compatible VIEW
CREATE VIEW IF NOT EXISTS beta_chapter_progress AS
SELECT 
  ap.id,
  ap.assignment_id,
  ap.book_id,
  cs.chapter_id,
  ap.beta_user_id,
  COALESCE(cs.status, 'NOT_STARTED') AS status,
  ap.current_chapter_index AS chapter_index,
  COALESCE(cs.last_scroll_percent, 0) AS scroll_percent,
  COALESCE(cs.last_scroll_offset, 0) AS scroll_offset,
  ap.overall_percentage AS percentage,
  ap.updated_at
FROM beta_assignment_progress ap
LEFT JOIN beta_chapter_status cs ON cs.assignment_id = ap.assignment_id AND cs.chapter_index = ap.current_chapter_index;
