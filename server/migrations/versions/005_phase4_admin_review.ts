import type { DatabaseSync } from 'node:sqlite';

/**
 * LilyBeta Migration 005: Phase 4 Admin Review, Exact-Revision Binding & Chapter Approval
 * 
 * Objectives:
 * 1. Ensure `beta_edit_reviews` table contains all fields for revision-bound decision tracking.
 * 2. Create `beta_chapter_reviews` table for storing chapter approval snapshots and state.
 * 3. Add note resolution columns to `beta_notes` (status, resolved_by, resolved_at).
 * 4. Add high-performance indexes for review queries and aggregate calculations.
 */

interface MigrationContext {
  db: DatabaseSync;
  run: (sql: string, ...params: any[]) => any;
  queryAll: <T = any>(sql: string, ...params: any[]) => T[];
  queryOne: <T = any>(sql: string, ...params: any[]) => T | null;
}

export const up = (ctx: MigrationContext): void => {
  const { db, queryAll, queryOne } = ctx;

  console.log('[Migration 005] Executing Phase 4 Admin Review Migration...');

  const tableExists = (tableName: string): boolean => {
    const res = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      tableName
    );
    return Boolean(res);
  };

  const getTableColumns = (tableName: string): string[] => {
    if (!tableExists(tableName)) return [];
    const rows = queryAll<{ name: string }>(`PRAGMA table_info(${tableName})`);
    return rows.map(r => r.name);
  };

  // 1. Ensure beta_chapter_reviews exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_chapter_reviews (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES beta_assignments(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES beta_books(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL REFERENCES beta_chapters(id) ON DELETE CASCADE,
      chapter_index INTEGER NOT NULL,
      reviewer_id TEXT NOT NULL REFERENCES profiles(id),
      status TEXT NOT NULL CHECK(status IN ('IN_REVIEW', 'APPROVED', 'REOPENED')),
      approved_at TEXT,
      review_snapshot_version INTEGER NOT NULL DEFAULT 1,
      approved_edits_snapshot TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(assignment_id, chapter_index)
    );
  `);

  // 2. Ensure beta_edit_reviews has all Phase 4 fields
  if (!tableExists('beta_edit_reviews')) {
    db.exec(`
      CREATE TABLE beta_edit_reviews (
        id TEXT PRIMARY KEY,
        edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
        assignment_id TEXT REFERENCES beta_assignments(id) ON DELETE CASCADE,
        chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE,
        reviewer_id TEXT NOT NULL REFERENCES profiles(id),
        decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED')),
        comment TEXT,
        reviewed_revision_number INTEGER NOT NULL,
        reviewed_edit_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  } else {
    const existingCols = new Set(getTableColumns('beta_edit_reviews'));
    if (!existingCols.has('assignment_id')) {
      db.exec('ALTER TABLE beta_edit_reviews ADD COLUMN assignment_id TEXT REFERENCES beta_assignments(id) ON DELETE CASCADE;');
    }
    if (!existingCols.has('chapter_id')) {
      db.exec('ALTER TABLE beta_edit_reviews ADD COLUMN chapter_id TEXT REFERENCES beta_chapters(id) ON DELETE CASCADE;');
    }
    if (!existingCols.has('reviewed_edit_version')) {
      db.exec('ALTER TABLE beta_edit_reviews ADD COLUMN reviewed_edit_version INTEGER NOT NULL DEFAULT 1;');
    }
    if (!existingCols.has('updated_at')) {
      db.exec('ALTER TABLE beta_edit_reviews ADD COLUMN updated_at TEXT;');
      // Backfill updated_at from created_at
      db.exec('UPDATE beta_edit_reviews SET updated_at = created_at WHERE updated_at IS NULL;');
    }
  }

  // 3. Ensure beta_notes has resolution fields
  if (tableExists('beta_notes')) {
    const noteCols = new Set(getTableColumns('beta_notes'));
    if (!noteCols.has('status')) {
      db.exec("ALTER TABLE beta_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'RESOLVED'));");
    }
    if (!noteCols.has('resolved_by')) {
      db.exec('ALTER TABLE beta_notes ADD COLUMN resolved_by TEXT REFERENCES profiles(id);');
    }
    if (!noteCols.has('resolved_at')) {
      db.exec('ALTER TABLE beta_notes ADD COLUMN resolved_at TEXT;');
    }
  }

  // 4. Create performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_edit_rev ON beta_edit_reviews(edit_id, reviewed_revision_number);
    CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_decision ON beta_edit_reviews(decision);
    CREATE INDEX IF NOT EXISTS idx_beta_chapter_reviews_status ON beta_chapter_reviews(assignment_id, chapter_index, status);
    CREATE INDEX IF NOT EXISTS idx_beta_chapter_reviews_book ON beta_chapter_reviews(book_id, chapter_index);
  `);

  console.log('[Migration 005] ✓ Phase 4 Admin Review Migration applied successfully.');
};
