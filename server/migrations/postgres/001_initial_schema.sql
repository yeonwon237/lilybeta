-- =============================================================================
-- LilyBeta Phase 5: Complete Baseline PostgreSQL / Supabase Production Schema
-- Domain target: beta.lilyhub.top
--
-- Features:
-- 1. Full schema parity with Phase 1, 2, 3, 4, 4.5
-- 2. Native PostgreSQL data types: JSONB, TIMESTAMPTZ, BOOLEAN, TEXT PRIMARY KEY
-- 3. High-performance composite indexes
-- 4. Foreign keys with ON DELETE CASCADE to guarantee zero orphaned records
-- 5. Security Authority: Express Backend with Server-Side Authorization Middleware
--    (Direct database access from frontend is strictly forbidden; credentials kept server-side)
-- =============================================================================

-- 1. Schema Migrations Table (Version tracking)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles Table (Admin & Beta Readers)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'BETA_READER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3. Beta Books Table
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_books_status ON beta_books(status);
CREATE INDEX IF NOT EXISTS idx_beta_books_created_by ON beta_books(created_by);

-- 4. Beta Chapters Table (Original immutable chapter content with versioned cache validation)
CREATE TABLE IF NOT EXISTS beta_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  paragraphs JSONB NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapters_book ON beta_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_beta_chapters_book_idx ON beta_chapters(book_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_chapters_book_version ON beta_chapters(book_id, chapter_index, content_version);

-- 5. Beta Assignments Table (Multi-assignment per book)
CREATE TABLE IF NOT EXISTS beta_assignments (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'REVOKED')),
  UNIQUE(book_id, beta_user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_assignments_user_status ON beta_assignments(beta_user_id, status);
CREATE INDEX IF NOT EXISTS idx_beta_assignments_book_status ON beta_assignments(book_id, status);

-- 6. Beta Assignment Progress Table (Book-level overall progress)
CREATE TABLE IF NOT EXISTS beta_assignment_progress (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_chapter_index INTEGER NOT NULL DEFAULT 1,
  overall_percentage REAL NOT NULL DEFAULT 0,
  completed_chapters_count INTEGER NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, beta_user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_assignment_progress_user ON beta_assignment_progress(beta_user_id, book_id);

-- 7. Beta Chapter Status Table (Individual chapter workflow lifecycle)
CREATE TABLE IF NOT EXISTS beta_chapter_status (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_scroll_percent REAL NOT NULL DEFAULT 0,
  last_scroll_offset REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapter_status_assign ON beta_chapter_status(assignment_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_chapter_status_book ON beta_chapter_status(book_id, beta_user_id);

-- Backward-compatibility view for beta_chapter_progress
CREATE OR REPLACE VIEW beta_chapter_progress AS
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

-- 8. Beta Activity Logs Table
CREATE TABLE IF NOT EXISTS beta_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  book_id TEXT,
  chapter_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_activity_user ON beta_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_activity_created_at ON beta_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_activity_compound ON beta_activity_logs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_beta_activity_user_created ON beta_activity_logs(user_id, created_at DESC);

-- 9. Beta Edits Table (Paragraph-anchored proposed edits)
CREATE TABLE IF NOT EXISTS beta_edits (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  current_text TEXT NOT NULL,
  prefix_context TEXT,
  suffix_context TEXT,
  error_type TEXT NOT NULL CHECK(error_type IN (
    'XUNG_HO', 'DICH_SAI', 'CAU_TOI_NGHIA', 'NGU_PHAP', 'TYPO',
    'DAU_CAU', 'TEN_RIENG', 'VAN_PHONG', 'CONSISTENCY', 'FORMATTING', 'OTHER'
  )),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DELETED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_edits_chapter_para ON beta_edits(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_edits_assignment ON beta_edits(assignment_id, chapter_index, status);
CREATE INDEX IF NOT EXISTS idx_beta_edits_user ON beta_edits(beta_user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_beta_edits_book_status ON beta_edits(book_id, status);

-- 10. Beta Edit Revisions Table (Every revision step A -> B -> C is immutably preserved)
CREATE TABLE IF NOT EXISTS beta_edit_revisions (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  error_type_before TEXT,
  error_type_after TEXT NOT NULL,
  reason_before TEXT,
  reason_after TEXT,
  changed_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(edit_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_edit ON beta_edit_revisions(edit_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_author ON beta_edit_revisions(changed_by);

-- 11. Beta Edit Reviews Table (Admin review decisions bound to exact revisions)
CREATE TABLE IF NOT EXISTS beta_edit_reviews (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES beta_assignments(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES profiles(id),
  decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED')),
  comment TEXT,
  reviewed_revision_number INTEGER NOT NULL,
  reviewed_edit_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_edit ON beta_edit_reviews(edit_id);
CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_edit_rev ON beta_edit_reviews(edit_id, reviewed_revision_number);
CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_decision ON beta_edit_reviews(decision);
CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_reviewer ON beta_edit_reviews(reviewer_id);

-- 12. Beta Notes Table (Private reader paragraph annotations)
CREATE TABLE IF NOT EXISTS beta_notes (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  start_offset INTEGER DEFAULT 0,
  end_offset INTEGER DEFAULT 0,
  selected_text TEXT,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'RESOLVED')),
  resolved_by TEXT REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_notes_chapter_para ON beta_notes(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_notes_assignment ON beta_notes(assignment_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_notes_user ON beta_notes(beta_user_id, book_id);

-- 13. Beta Chapter Reviews Table (Chapter approval snapshots)
CREATE TABLE IF NOT EXISTS beta_chapter_reviews (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  reviewer_id TEXT NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL CHECK(status IN ('IN_REVIEW', 'APPROVED', 'REOPENED')),
  approved_at TIMESTAMPTZ,
  review_snapshot_version INTEGER NOT NULL DEFAULT 1,
  approved_edits_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_beta_chapter_reviews_status ON beta_chapter_reviews(assignment_id, chapter_index, status);
CREATE INDEX IF NOT EXISTS idx_beta_chapter_reviews_book ON beta_chapter_reviews(book_id, chapter_index);
