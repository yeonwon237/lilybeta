-- LilyBeta Migration 003: Inline Edits, Notes & Revisions (Phase 3 Foundation)

-- 1. Beta Edits table (Proposed changes by Beta Readers)
CREATE TABLE IF NOT EXISTS beta_edits (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  error_type TEXT DEFAULT 'OTHER' CHECK(error_type IN ('TYPO', 'GRAMMAR', 'TRANSLATION', 'TERMINOLOGY', 'FORMATTING', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_edits_chapter ON beta_edits(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_edits_book_user ON beta_edits(book_id, beta_user_id, status);

-- 2. Beta Revisions table (Admin/Reviewer reviews on proposed edits)
CREATE TABLE IF NOT EXISTS beta_revisions (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES profiles(id),
  comment TEXT,
  status TEXT NOT NULL CHECK(status IN ('ACCEPTED', 'REJECTED')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_revisions_edit ON beta_revisions(edit_id);
CREATE INDEX IF NOT EXISTS idx_beta_revisions_reviewer ON beta_revisions(reviewer_id);

-- 3. Beta Notes table (Private reader annotations on paragraphs)
CREATE TABLE IF NOT EXISTS beta_notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
  beta_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_notes_chapter ON beta_notes(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_notes_user ON beta_notes(beta_user_id, book_id);
