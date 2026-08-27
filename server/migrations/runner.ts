import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { db, queryAll, queryOne, run, transaction } from '../db/database.js';

export const runMigrations = async (customDb?: DatabaseSync): Promise<void> => {
  const targetDb = customDb || db;

  const localQueryAll = <T = any>(sql: string, ...params: any[]): T[] => {
    const stmt = targetDb.prepare(sql);
    return stmt.all(...params) as T[];
  };

  const localQueryOne = <T = any>(sql: string, ...params: any[]): T | null => {
    const stmt = targetDb.prepare(sql);
    const res = stmt.get(...params);
    return (res as T) ?? null;
  };

  const localRun = (sql: string, ...params: any[]) => {
    const stmt = targetDb.prepare(sql);
    return stmt.run(...params);
  };

  const localTransaction = <T>(fn: () => T): T => {
    targetDb.exec('BEGIN TRANSACTION');
    try {
      const result = fn();
      targetDb.exec('COMMIT');
      return result;
    } catch (error) {
      targetDb.exec('ROLLBACK');
      throw error;
    }
  };

  console.log('[LilyBeta Migration] Initializing versioned migration engine...');

  // 1. Ensure schema_migrations table exists
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // 2. Discover migration files from server/migrations/versions (.sql and .ts/.js)
  const versionsDir = path.join(process.cwd(), 'server', 'migrations', 'versions');
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  const files = fs.readdirSync(versionsDir)
    .filter(f => f.match(/^\d+_.+\.(sql|ts|js)$/))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const appliedRows = localQueryAll<{ version: string }>('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.(sql|ts|js)$/);
    if (!match) continue;

    const version = match[1];

    if (appliedVersions.has(version)) {
      continue;
    }

    const filePath = path.join(versionsDir, file);
    console.log(`[LilyBeta Migration] Applying version ${version}: ${file}...`);

    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(filePath, 'utf8');

      localTransaction(() => {
        targetDb.exec(sql);
        localRun(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          version,
          file,
          new Date().toISOString()
        );
      });
    } else {
      // Dynamic import for TS/JS migrations
      const migrationMod = await import(`file://${filePath}`);
      localTransaction(() => {
        if (typeof migrationMod.up === 'function') {
          migrationMod.up({
            db: targetDb,
            run: localRun,
            queryAll: localQueryAll,
            queryOne: localQueryOne,
          });
        }
        localRun(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          version,
          file,
          new Date().toISOString()
        );
      });
    }

    console.log(`[LilyBeta Migration] ✓ Applied ${file} successfully.`);
    appliedCount++;
  }

  if (appliedCount === 0) {
    console.log('[LilyBeta Migration] Schema is already up to date (no pending migrations).');
  } else {
    console.log(`[LilyBeta Migration] Successfully applied ${appliedCount} migration(s).`);
  }

  // 3. Admin Account Seeding Security (if profiles table exists)
  const hasProfiles = localQueryOne<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'profiles'"
  );
  if (!hasProfiles) return;

  const isProduction = process.env.NODE_ENV === 'production';
  const allowBootstrap = process.env.BOOTSTRAP_ADMIN === 'true';

  const admin = localQueryOne('SELECT id FROM profiles WHERE role = ?', 'ADMIN');
  if (!admin) {
    if (isProduction && !allowBootstrap) {
      console.warn(
        '[LilyBeta Seed] PRODUCTION MODE: Default admin account creation is DISABLED. ' +
        'Set BOOTSTRAP_ADMIN=true to seed initial admin or create via administrative script.'
      );
      return;
    }

    const adminId = 'admin-root-id';
    const username = 'admin';
    const password = 'admin123456';
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();

    localRun(
      `INSERT INTO profiles (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      adminId,
      username,
      passwordHash,
      'LilyBeta Admin',
      'ADMIN',
      now,
      now
    );

    console.log('[LilyBeta Seed] Created development admin account:');
    console.log('   Username: admin');
    console.log('   Password: admin123456');
  }
};

// If run directly via tsx server/migrations/runner.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('[LilyBeta Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[LilyBeta Migration] Error:', err);
      process.exit(1);
    });
}
