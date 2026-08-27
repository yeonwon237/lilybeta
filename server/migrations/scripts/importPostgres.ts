import fs from 'node:fs';
import path from 'node:path';
import { PostgresAdapter } from '../../db/postgresAdapter.js';
import { config, sanitizeDatabaseUrl } from '../../config.js';

/**
 * PostgreSQL Data Import Script
 * Imports JSON data exported from SQLite into PostgreSQL with transactional safety.
 */
async function importPostgres() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'sqlite_export.json');
  if (!fs.existsSync(filePath)) {
    console.error(`[LilyBeta Import] Export file not found at ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const data: Record<string, any[]> = JSON.parse(raw);

  console.log(`[LilyBeta Import] Connecting to PostgreSQL at ${sanitizeDatabaseUrl(config.databaseUrl)}...`);
  const adapter = new PostgresAdapter();

  const tablesInOrder = [
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

  await adapter.transaction(async (tx) => {
    for (const table of tablesInOrder) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;

      console.log(`[LilyBeta Import] Importing ${rows.length} rows into ${table}...`);
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((col) => {
          let val = row[col];
          // Handle boolean conversion
          if (col === 'is_active') {
            return Boolean(val);
          }
          // Handle JSON fields
          if (col === 'paragraphs' || col === 'details' || col === 'approved_edits_snapshot') {
            if (typeof val === 'string') {
              try {
                return JSON.parse(val);
              } catch {
                return val;
              }
            }
          }
          return val;
        });

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await tx.run(sql, ...values);
      }
    }
  });

  console.log('[LilyBeta Import] Data import completed successfully.');
  await adapter.close();
}

importPostgres().catch((err) => {
  console.error('[LilyBeta Import Error]', err);
  process.exit(1);
});
