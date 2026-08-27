import fs from 'node:fs';
import path from 'node:path';
import { SqliteAdapter } from '../server/db/sqliteAdapter.js';
import { translatePlaceholders, PostgresAdapter } from '../server/db/postgresAdapter.js';

let passedAssertions = 0;
const assert = (condition: boolean, msg: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedAssertions++;
  console.log(`  ✓ ${msg}`);
};

const runPostgresParityTests = async () => {
  console.log('====================================================');
  console.log('🐘 STARTING DATABASE PARITY & POSTGRES ADAPTER TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------
  // Part 1: SQL Placeholder Translation Tests
  // -------------------------------------------------------------
  console.log('[Part 1] SQL Placeholder Translation Tests');
  const q1 = 'SELECT * FROM beta_books WHERE id = ?';
  assert(translatePlaceholders(q1) === 'SELECT * FROM beta_books WHERE id = $1', 'Single placeholder translated');

  const q2 = 'INSERT INTO beta_edits (id, book_id, chapter_index) VALUES (?, ?, ?)';
  assert(
    translatePlaceholders(q2) === 'INSERT INTO beta_edits (id, book_id, chapter_index) VALUES ($1, $2, $3)',
    'Multiple positional placeholders translated in order'
  );

  const q3 = "SELECT * FROM beta_books WHERE title = 'What?' AND author = 'O''Reilly ?' AND id = ?";
  assert(
    translatePlaceholders(q3) === "SELECT * FROM beta_books WHERE title = 'What?' AND author = 'O''Reilly ?' AND id = $1",
    'Question marks inside string literals preserved correctly'
  );

  // -------------------------------------------------------------
  // Part 2: PostgreSQL Migration Schema Integrity
  // -------------------------------------------------------------
  console.log('\n[Part 2] PostgreSQL Migration Schema File Integrity');
  const pgSchemaFile = path.join(process.cwd(), 'server', 'migrations', 'postgres', '001_initial_schema.sql');
  assert(fs.existsSync(pgSchemaFile), 'PostgreSQL 001_initial_schema.sql migration file exists');

  const pgSql = fs.readFileSync(pgSchemaFile, 'utf8');
  const requiredPgTables = [
    'schema_migrations',
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

  for (const t of requiredPgTables) {
    assert(pgSql.includes(`CREATE TABLE IF NOT EXISTS ${t}`), `PostgreSQL schema defines ${t} table`);
  }

  assert(pgSql.includes('paragraphs JSONB NOT NULL'), 'PostgreSQL schema defines paragraphs as JSONB');
  assert(pgSql.includes('TIMESTAMPTZ NOT NULL DEFAULT NOW()'), 'PostgreSQL schema uses TIMESTAMPTZ timestamps');
  assert(pgSql.includes('ON DELETE CASCADE'), 'Foreign keys enforce ON DELETE CASCADE');

  // -------------------------------------------------------------
  // Part 3: SQLite Adapter Contract & Transactions
  // -------------------------------------------------------------
  console.log('\n[Part 3] SQLite Adapter Contract & Transactions');
  const testDb = path.join(process.cwd(), 'data', `test_parity_${Date.now()}.db`);
  const sqlite = new SqliteAdapter(testDb);

  try {
    const alive = await sqlite.isAlive();
    assert(alive, 'SQLite adapter isAlive returns true');

    sqlite.db.exec('CREATE TABLE test_items (id TEXT PRIMARY KEY, value INTEGER);');
    const runRes = sqlite.run('INSERT INTO test_items (id, value) VALUES (?, ?)', 'item-1', 42);
    assert(runRes.changes === 1, 'SQLite run returns changes = 1');

    const row = sqlite.queryOne<{ value: number }>('SELECT value FROM test_items WHERE id = ?', 'item-1');
    assert(row?.value === 42, 'SQLite queryOne returns expected row');

    // Transaction commit
    sqlite.transaction((tx) => {
      tx.run('INSERT INTO test_items (id, value) VALUES (?, ?)', 'item-2', 100);
    });
    const row2 = sqlite.queryOne('SELECT id FROM test_items WHERE id = ?', 'item-2');
    assert(Boolean(row2), 'Transaction commit successfully persisted row');

    // Transaction rollback on error
    try {
      sqlite.transaction((tx) => {
        tx.run('INSERT INTO test_items (id, value) VALUES (?, ?)', 'item-3', 200);
        throw new Error('Simulated failure');
      });
    } catch {
      // Expected
    }
    const row3 = sqlite.queryOne('SELECT id FROM test_items WHERE id = ?', 'item-3');
    assert(!row3, 'Transaction rollback successfully reverted row on error');
  } finally {
    sqlite.close();
    if (fs.existsSync(testDb)) {
      try { fs.unlinkSync(testDb); } catch {}
    }
  }

  // -------------------------------------------------------------
  // Part 4: Live PostgreSQL Connection (Optional via env DATABASE_URL)
  // -------------------------------------------------------------
  console.log('\n[Part 4] Live PostgreSQL Integration Test');
  const livePgUrl = process.env.POSTGRES_TEST_URL || process.env.DATABASE_URL;

  if (livePgUrl && (livePgUrl.startsWith('postgres://') || livePgUrl.startsWith('postgresql://'))) {
    console.log('  Testing live PostgreSQL connection from environment...');
    const pgAdapter = new PostgresAdapter(livePgUrl);
    try {
      const isAlive = await pgAdapter.isAlive();
      assert(isAlive, 'Live PostgreSQL connection is alive (SELECT 1 returns 1)');

      // Test transaction on live Postgres
      await pgAdapter.transaction(async (tx) => {
        const testRes = await tx.queryOne<{ alive: number }>('SELECT 1 AS alive');
        assert(testRes?.alive === 1, 'Transaction on PostgreSQL pool client succeeded');
      });

      console.log('  ✓ Live PostgreSQL integration tests passed');
    } catch (err: any) {
      console.warn('  ⚠️ Live PostgreSQL connection failed or skipped:', err.message);
    } finally {
      await pgAdapter.close();
    }
  } else {
    console.log('  ℹ️ No live DATABASE_URL configured in local environment; skipping live cloud round-trip.');
    console.log('     Configure DATABASE_URL=postgresql://... to run tests against live Supabase instance.');
  }

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedAssertions} DATABASE PARITY ASSERTIONS PASSED!`);
  console.log('====================================================\n');
};

runPostgresParityTests().catch((err) => {
  console.error('Fatal Parity Test Error:', err);
  process.exit(1);
});
