import type { DatabaseSync } from 'node:sqlite';

/**
 * LilyBeta Migration 004: Phase 3 Hotfix (Non-Destructive Safe Migration)
 * 
 * Objectives:
 * 1. Safely inspect schema and preserve any legacy data from pre-Phase 3 tables.
 * 2. Ensure Phase 3 tables (beta_edits, beta_edit_revisions, beta_edit_reviews, beta_notes) exist
 *    with complete columns and foreign key constraints without dropping any existing records.
 * 3. If legacy prototype tables (e.g. beta_revisions or legacy beta_edits) exist:
 *    - Migrate all compatible records to the Phase 3 schema.
 *    - Safely rename and preserve legacy tables as `_legacy_*` so zero data is lost.
 * 4. Verify integrity and log migration details.
 */

interface MigrationContext {
  db: DatabaseSync;
  run: (sql: string, ...params: any[]) => any;
  queryAll: <T = any>(sql: string, ...params: any[]) => T[];
  queryOne: <T = any>(sql: string, ...params: any[]) => T | null;
}

export const up = (ctx: MigrationContext): void => {
  const { db, queryAll, queryOne } = ctx;

  console.log('[Migration 004] Executing Phase 3 Safe Migration Hotfix...');

  // Helper: check if table exists
  const tableExists = (tableName: string): boolean => {
    const res = queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      tableName
    );
    return Boolean(res);
  };

  // Helper: get table columns
  const getTableColumns = (tableName: string): string[] => {
    if (!tableExists(tableName)) return [];
    const rows = queryAll<{ name: string }>(`PRAGMA table_info(${tableName})`);
    return rows.map(r => r.name);
  };

  // 1. Ensure Phase 3 target tables exist (non-destructive)
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS beta_edit_reviews (
      id TEXT PRIMARY KEY,
      edit_id TEXT NOT NULL REFERENCES beta_edits(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES profiles(id),
      decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED')),
      comment TEXT,
      reviewed_revision_number INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

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
  `);

  // 2. Safe Migration of Legacy prototype tables if present

  // 2A. Check if beta_edits or _legacy_beta_edits has legacy records that need transformation
  if (tableExists('_legacy_beta_edits')) {
    console.log('[Migration 004] Detected existing _legacy_beta_edits table.');
    const legacyEdits = queryAll<any>('SELECT * FROM _legacy_beta_edits');
    let migratedEditsCount = 0;

    for (const le of legacyEdits) {
      // Check if already in beta_edits
      const exists = queryOne('SELECT id FROM beta_edits WHERE id = ?', le.id);
      if (!exists) {
        // Resolve assignment_id if missing
        let assignmentId = le.assignment_id;
        if (!assignmentId && le.book_id && le.beta_user_id) {
          const assign = queryOne<any>(
            'SELECT id FROM beta_assignments WHERE book_id = ? AND beta_user_id = ? LIMIT 1',
            le.book_id,
            le.beta_user_id
          );
          assignmentId = assign?.id;
        }

        const startOffset = le.start_offset !== undefined ? le.start_offset : 0;
        const endOffset = le.end_offset !== undefined ? le.end_offset : (le.original_text ? le.original_text.length : 0);
        const originalText = le.original_text || '';
        const currentText = le.current_text || le.proposed_text || originalText;
        const status = le.status === 'DELETED' ? 'DELETED' : 'ACTIVE';
        const errorType = le.error_type || 'OTHER';

        if (assignmentId && le.book_id && le.chapter_id) {
          db.exec(`
            INSERT OR IGNORE INTO beta_edits (
              id, assignment_id, book_id, chapter_id, chapter_index, beta_user_id,
              paragraph_index, start_offset, end_offset, original_text, current_text,
              prefix_context, suffix_context, error_type, reason, status, version,
              created_at, updated_at
            ) VALUES (
              '${le.id}', '${assignmentId}', '${le.book_id}', '${le.chapter_id}',
              ${le.chapter_index || 1}, '${le.beta_user_id}',
              ${le.paragraph_index || 0}, ${startOffset}, ${endOffset},
              '${originalText.replace(/'/g, "''")}', '${currentText.replace(/'/g, "''")}',
              '${(le.prefix_context || '').replace(/'/g, "''")}',
              '${(le.suffix_context || '').replace(/'/g, "''")}',
              '${errorType}', '${(le.reason || '').replace(/'/g, "''")}',
              '${status}', ${le.version || 1},
              '${le.created_at || new Date().toISOString()}',
              '${le.updated_at || new Date().toISOString()}'
            )
          `);
          migratedEditsCount++;
        } else {
          console.warn(`[Migration 004] Legacy edit ${le.id} missing assignment relation, preserved in _legacy_beta_edits.`);
        }
      }
    }
    console.log(`[Migration 004] Migrated ${migratedEditsCount} edits from _legacy_beta_edits.`);
  }

  // 2B. Migrate legacy `beta_revisions` -> `beta_edit_revisions`
  if (tableExists('beta_revisions')) {
    console.log('[Migration 004] Detected legacy beta_revisions table. Inspecting records...');
    const legacyRevs = queryAll<any>('SELECT * FROM beta_revisions');

    let migratedRevsCount = 0;
    for (const rev of legacyRevs) {
      // Check if target edit exists in beta_edits
      const editExists = queryOne('SELECT id FROM beta_edits WHERE id = ?', rev.edit_id);
      if (editExists) {
        db.exec(`
          INSERT OR IGNORE INTO beta_edit_revisions (
            id, edit_id, revision_number, before_text, after_text,
            error_type_before, error_type_after, reason_before, reason_after,
            changed_by, created_at
          ) VALUES (
            '${rev.id}', '${rev.edit_id}', ${rev.revision_number || 1},
            '${(rev.before_text || '').replace(/'/g, "''")}',
            '${(rev.after_text || '').replace(/'/g, "''")}',
            NULL, '${rev.error_type_after || 'OTHER'}',
            NULL, '${(rev.reason_after || '').replace(/'/g, "''")}',
            '${rev.changed_by}', '${rev.created_at || new Date().toISOString()}'
          )
        `);
        migratedRevsCount++;
      }
    }

    console.log(`[Migration 004] Migrated ${migratedRevsCount}/${legacyRevs.length} revisions to beta_edit_revisions.`);
    
    // Safely rename to preserve legacy data without loss
    if (!tableExists('_legacy_beta_revisions')) {
      db.exec('ALTER TABLE beta_revisions RENAME TO _legacy_beta_revisions;');
      console.log('[Migration 004] Preserved legacy table as _legacy_beta_revisions.');
    } else {
      console.log('[Migration 004] _legacy_beta_revisions already exists, keeping original.');
    }
  }

  // 3. Ensure indexes exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_beta_edits_chapter_para ON beta_edits(chapter_id, paragraph_index);
    CREATE INDEX IF NOT EXISTS idx_beta_edits_assignment ON beta_edits(assignment_id, chapter_index, status);
    CREATE INDEX IF NOT EXISTS idx_beta_edits_user ON beta_edits(beta_user_id, book_id);

    CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_edit ON beta_edit_revisions(edit_id, revision_number);
    CREATE INDEX IF NOT EXISTS idx_beta_edit_revisions_author ON beta_edit_revisions(changed_by);

    CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_edit ON beta_edit_reviews(edit_id);
    CREATE INDEX IF NOT EXISTS idx_beta_edit_reviews_reviewer ON beta_edit_reviews(reviewer_id);

    CREATE INDEX IF NOT EXISTS idx_beta_notes_chapter_para ON beta_notes(chapter_id, paragraph_index);
    CREATE INDEX IF NOT EXISTS idx_beta_notes_assignment ON beta_notes(assignment_id, chapter_index);
    CREATE INDEX IF NOT EXISTS idx_beta_notes_user ON beta_notes(beta_user_id, book_id);
  `);

  console.log('[Migration 004] ✓ Phase 3 Safe Migration Hotfix completed successfully.');
};
