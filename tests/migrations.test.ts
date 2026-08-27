import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from '../server/migrations/runner.js';

let passedAssertions = 0;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
  passedAssertions++;
};

const runMigrationTests = async () => {
  console.log('========================================================');
  console.log('🧪 RUNNING SAFE MIGRATION & DATA PRESERVATION TESTS');
  console.log('========================================================\n');

  // =========================================================================
  // Test A: Fresh DB Migration
  // =========================================================================
  console.log('[Test A] Fresh DB Migration');
  const tempDbA = path.join(process.cwd(), 'data', `test_fresh_${Date.now()}.db`);
  if (fs.existsSync(tempDbA)) fs.unlinkSync(tempDbA);

  const freshDb = new DatabaseSync(tempDbA);
  freshDb.exec('PRAGMA foreign_keys = ON;');

  try {
    await runMigrations(freshDb);

    // Verify all tables exist
    const tables = freshDb
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")
      .all() as { name: string }[];
    const tableNames = new Set(tables.map(t => t.name));

    assert(tableNames.has('schema_migrations'), 'schema_migrations table created');
    assert(tableNames.has('profiles'), 'profiles table created');
    assert(tableNames.has('beta_books'), 'beta_books table created');
    assert(tableNames.has('beta_chapters'), 'beta_chapters table created');
    assert(tableNames.has('beta_assignments'), 'beta_assignments table created');
    assert(tableNames.has('beta_chapter_progress'), 'beta_chapter_progress view created');
    assert(tableNames.has('beta_edits'), 'beta_edits table created');
    assert(tableNames.has('beta_edit_revisions'), 'beta_edit_revisions table created');
    assert(tableNames.has('beta_edit_reviews'), 'beta_edit_reviews table created');
    assert(tableNames.has('beta_chapter_reviews'), 'beta_chapter_reviews table created');
    assert(tableNames.has('beta_notes'), 'beta_notes table created');

    const versions = freshDb.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: string }[];
    assert(versions.length >= 5, 'All migrations (001, 002, 003, 004, 005) tracked in schema_migrations');
  } finally {
    freshDb.close();
    if (fs.existsSync(tempDbA)) fs.unlinkSync(tempDbA);
  }

  // =========================================================================
  // Test B: Upgrade DB & Legacy Data Preservation Test
  // =========================================================================
  console.log('\n[Test B] Upgrade DB & Legacy Data Preservation Test');
  const tempDbB = path.join(process.cwd(), 'data', `test_upgrade_${Date.now()}.db`);
  if (fs.existsSync(tempDbB)) fs.unlinkSync(tempDbB);

  const upgradeDb = new DatabaseSync(tempDbB);
  upgradeDb.exec('PRAGMA foreign_keys = OFF;'); // Allow setting up legacy state

  try {
    // 1. Manually setup pre-Phase 3 database state (simulate an existing production Phase 2 DB)
    const now = new Date().toISOString();
    upgradeDb.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, name, applied_at) VALUES ('001', '001_initial_schema.sql', '${now}');
      INSERT INTO schema_migrations (version, name, applied_at) VALUES ('002', '002_phase2_workflow.sql', '${now}');

      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE beta_books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        file_format TEXT NOT NULL,
        total_chapters INTEGER NOT NULL,
        word_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE beta_chapters (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        paragraphs TEXT NOT NULL,
        word_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE beta_assignments (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        beta_user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE VIEW beta_chapter_progress AS
      SELECT id, id as assignment_id, 1 as current_chapter_index, 0 as scroll_offset, 0 as scroll_percent, 0 as completed_chapters_count, 0 as overall_percentage, '${now}' as last_read_at, '${now}' as updated_at
      FROM beta_assignments;

      -- Legacy prototype tables from earlier iterations
      CREATE TABLE beta_revisions (
        id TEXT PRIMARY KEY,
        edit_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        before_text TEXT NOT NULL,
        after_text TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE _legacy_beta_edits (
        id TEXT PRIMARY KEY,
        assignment_id TEXT,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        chapter_index INTEGER,
        beta_user_id TEXT NOT NULL,
        paragraph_index INTEGER,
        start_offset INTEGER,
        end_offset INTEGER,
        original_text TEXT,
        proposed_text TEXT,
        error_type TEXT,
        reason TEXT,
        status TEXT,
        version INTEGER,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Insert pre-existing business data
    upgradeDb.exec(`
      INSERT INTO profiles (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
      VALUES ('user-preserve-1', 'existing_beta', 'hash', 'Existing Beta User', 'BETA_READER', 1, '${now}', '${now}');

      INSERT INTO beta_books (id, title, author, original_file_name, file_format, total_chapters, word_count, status, created_at, updated_at)
      VALUES ('book-preserve-1', 'Tác Phẩm Giữ Lại', 'Tác Giả Cũ', 'file.txt', 'TXT', 5, 10000, 'IN_BETA', '${now}', '${now}');

      INSERT INTO beta_chapters (id, book_id, chapter_index, title, paragraphs, word_count, created_at)
      VALUES ('chap-preserve-1', 'book-preserve-1', 1, 'Chương 1', '["Đoạn 1 giữ nguyên"]', 500, '${now}');

      INSERT INTO beta_assignments (id, book_id, beta_user_id, status, created_at, updated_at)
      VALUES ('assign-preserve-1', 'book-preserve-1', 'user-preserve-1', 'ACTIVE', '${now}', '${now}');

      INSERT INTO _legacy_beta_edits (
        id, assignment_id, book_id, chapter_id, chapter_index, beta_user_id,
        paragraph_index, start_offset, end_offset, original_text, proposed_text,
        error_type, reason, status, version, created_at, updated_at
      ) VALUES (
        'edit-preserve-1', 'assign-preserve-1', 'book-preserve-1', 'chap-preserve-1', 1, 'user-preserve-1',
        0, 0, 6, 'Đoạn 1', 'Phần 1',
        'TYPO', 'Sửa lỗi chính tả cũ', 'ACTIVE', 1, '${now}', '${now}'
      );

      INSERT INTO beta_revisions (id, edit_id, revision_number, before_text, after_text, changed_by, created_at)
      VALUES ('rev-preserve-1', 'edit-preserve-1', 1, 'Đoạn 1', 'Phần 1', 'user-preserve-1', '${now}');
    `);

    upgradeDb.exec('PRAGMA foreign_keys = ON;');

    console.log('[Test B] Running versioned migrations on existing DB...');
    await runMigrations(upgradeDb);

    // 2. VERIFY DATA PRESERVATION (Zero Data Loss)
    const preservedUser = upgradeDb.prepare('SELECT * FROM profiles WHERE id = ?').get('user-preserve-1') as any;
    assert(Boolean(preservedUser), 'User profile preserved after migration');
    assert(preservedUser.username === 'existing_beta', 'User profile username intact');

    const preservedBook = upgradeDb.prepare('SELECT * FROM beta_books WHERE id = ?').get('book-preserve-1') as any;
    assert(Boolean(preservedBook), 'Book data preserved after migration');
    assert(preservedBook.title === 'Tác Phẩm Giữ Lại', 'Book title intact');

    const preservedChap = upgradeDb.prepare('SELECT * FROM beta_chapters WHERE id = ?').get('chap-preserve-1') as any;
    assert(Boolean(preservedChap), 'Chapter data preserved after migration');

    const preservedAssign = upgradeDb.prepare('SELECT * FROM beta_assignments WHERE id = ?').get('assign-preserve-1') as any;
    assert(Boolean(preservedAssign), 'Assignment preserved after migration');

    // Verify compatible legacy edit was migrated to beta_edits
    const migratedEdit = upgradeDb.prepare('SELECT * FROM beta_edits WHERE id = ?').get('edit-preserve-1') as any;
    assert(Boolean(migratedEdit), 'Legacy edit migrated into beta_edits');
    assert(migratedEdit.current_text === 'Phần 1', 'Edit current_text mapped from proposed_text');
    assert(migratedEdit.status === 'ACTIVE', 'Edit status preserved as ACTIVE');

    // Verify legacy revision was migrated to beta_edit_revisions
    const migratedRev = upgradeDb.prepare('SELECT * FROM beta_edit_revisions WHERE id = ?').get('rev-preserve-1') as any;
    assert(Boolean(migratedRev), 'Legacy revision migrated into beta_edit_revisions');
    assert(migratedRev.after_text === 'Phần 1', 'Revision after_text intact');

    // Verify legacy tables were preserved as _legacy_* without drop
    const tablesAfter = upgradeDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tableNamesAfter = new Set(tablesAfter.map(t => t.name));

    assert(tableNamesAfter.has('_legacy_beta_revisions'), '_legacy_beta_revisions preserved without deletion');
    assert(tableNamesAfter.has('_legacy_beta_edits'), '_legacy_beta_edits preserved without deletion');

  } finally {
    upgradeDb.close();
    if (fs.existsSync(tempDbB)) fs.unlinkSync(tempDbB);
  }

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passedAssertions} MIGRATION & DATA PRESERVATION ASSERTIONS PASSED!`);
  console.log('========================================================\n');
};

runMigrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Migration test suite failed:\n', err);
    process.exit(1);
  });
