-- LilyBeta Migration 003: Inline Edits, Multi-Revision History & Structured Beta Data (Phase 3)

-- 0. Clean up any preliminary prototype tables if existing
DROP TABLE IF EXISTS beta_edit_reviews;
DROP TABLE IF EXISTS beta_edit_revisions;
DROP TABLE IF EXISTS beta_revisions;
DROP TABLE IF EXISTS beta_edits;
DROP TABLE IF EXISTS beta_notes;

-- 1. Beta Edits table (Paragraph-anchored proposed edits by Beta Readers)
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_edits_chapter_para ON beta_edits(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_edits_assignment ON beta_edits(assignment_id, chapter_index, status);
CREATE INDEX IF NOT EXISTS idx_beta_edits_user ON beta_edits(beta_user_id, book_id);

-- 2. Beta Edit Revisions table (Every revision step A -> B -> C is immutably preserved)
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
  created_at TEXT NOT NULL,
  UNIQUE(edit_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_edit ON beta_edit_revisions(edit_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_author ON beta_edit_revisions(changed_by);

-- 3. Beta Edit Reviews table (Foundation for Phase 4 Admin Review & Dataset Pipeline)
CREATE TABLE IF NOT EXISTS beta_edit_reviews (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES profiles(id),
  decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED')),
  comment TEXT,
  reviewed_revision_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_edit ON beta_edit_reviews(edit_id);
CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_reviewer ON beta_edit_reviews(reviewer_id);

-- 4. Beta Notes table (Private reader annotations on paragraphs)
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_notes_chapter_para ON beta_notes(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_notes_assignment ON beta_notes(assignment_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_notes_user ON beta_notes(beta_user_id, book_id);
