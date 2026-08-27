import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

/**
 * LilyBeta Migration 006: Phase 4.5 Egress & Query Optimization
 * 
 * Objectives:
 * 1. Add `content_version` and `content_hash` to `beta_chapters` for version-based cache validation.
 * 2. Backfill existing chapters with `content_version = 1` and deterministic SHA-256 content hashes.
 * 3. Add performance indexes for activity logs pagination, chapter versioning, and edit status filtering.
 */

interface MigrationContext {
  db: DatabaseSync;
  run: (sql: string, ...params: any[]) => any;
  queryAll: <T = any>(sql: string, ...params: any[]) => T[];
  queryOne: <T = any>(sql: string, ...params: any[]) => T | null;
}

export const up = (ctx: MigrationContext): void => {
  const { db, queryAll, queryOne } = ctx;

  console.log('[Migration 006] Executing Phase 4.5 Egress & Query Optimization Migration...');

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

  // 1. Add content_version and content_hash to beta_chapters if missing
  if (tableExists('beta_chapters')) {
    const chapterCols = new Set(getTableColumns('beta_chapters'));
    if (!chapterCols.has('content_version')) {
      db.exec('ALTER TABLE beta_chapters ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1;');
    }
    if (!chapterCols.has('content_hash')) {
      db.exec('ALTER TABLE beta_chapters ADD COLUMN content_hash TEXT;');
    }

    // Backfill content_hash for any rows where content_hash is NULL
    const chapters = queryAll<{ id: string; paragraphs: string; title: string }>('SELECT id, paragraphs, title FROM beta_chapters WHERE content_hash IS NULL');
    for (const ch of chapters) {
      const hash = crypto.createHash('sha256').update(ch.paragraphs || '').digest('hex');
      const stmt = db.prepare('UPDATE beta_chapters SET content_hash = ?, content_version = 1 WHERE id = ?');
      stmt.run(hash, ch.id);
    }
  }

  // 2. Add performance indexes if tables exist
  if (tableExists('beta_chapters')) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_beta_chapters_book_version ON beta_chapters(book_id, chapter_index, content_version);`);
  }
  if (tableExists('beta_activity_logs')) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_beta_activity_created_at ON beta_activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_beta_activity_user_created ON beta_activity_logs(user_id, created_at DESC);
    `);
  }
  if (tableExists('beta_edits')) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_beta_edits_assign_status ON beta_edits(assignment_id, status, chapter_index);`);
  }

  console.log('[Migration 006] ✓ Phase 4.5 Egress & Query Optimization Migration applied successfully.');
};
