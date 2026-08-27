import fs from 'node:fs';
import path from 'node:path';
import { SqliteAdapter } from '../../db/sqliteAdapter.js';

/**
 * SQLite Data Export Script
 * Exports non-test business data from SQLite to a JSON file.
 */
async function exportSqlite() {
  console.log('[LilyBeta Data Export] Starting SQLite data export...');
  const adapter = new SqliteAdapter();

  const tables = [
    'profiles',
    'beta_books',
    'beta_chapters',
    'beta_assignments',
    'beta_assignment_progress',
    'beta_chapter_status',
    'beta_activity_logs',
    'beta_edits',
    'beta_edit_revisions',
    'beta_edit_reviews',
    'beta_notes',
    'beta_chapter_reviews',
  ];

  const exportData: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const rows = adapter.queryAll(`SELECT * FROM ${table}`);
      exportData[table] = rows;
      console.log(`[LilyBeta Data Export] Exported ${rows.length} records from ${table}`);
    } catch (err) {
      console.warn(`[LilyBeta Data Export] Skipped ${table} (not found or empty)`);
    }
  }

  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'sqlite_export.json');
  fs.writeFileSync(outFile, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`[LilyBeta Data Export] Successfully wrote export data to ${outFile}`);
  adapter.close();
}

exportSqlite().catch(console.error);
