import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, queryAll, queryOne, run, transaction } from '../db/database.js';

export const runMigrations = async (): Promise<void> => {
  console.log('[LilyBeta Migration] Initializing versioned migration engine...');

  // 1. Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // 2. Discover migration files from server/migrations/versions
  const versionsDir = path.join(process.cwd(), 'server', 'migrations', 'versions');
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  const files = fs.readdirSync(versionsDir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const appliedRows = queryAll<{ version: string }>('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = match[1];
    const name = match[2];

    if (appliedVersions.has(version)) {
      continue;
    }

    const filePath = path.join(versionsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`[LilyBeta Migration] Applying version ${version}: ${file}...`);

    transaction(() => {
      // Execute the migration script
      db.exec(sql);

      // Record in schema_migrations
      const now = new Date().toISOString();
      run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        version,
        file,
        now
      );
    });

    console.log(`[LilyBeta Migration] ✓ Applied ${file} successfully.`);
    appliedCount++;
  }

  if (appliedCount === 0) {
    console.log('[LilyBeta Migration] Schema is already up to date (no pending migrations).');
  } else {
    console.log(`[LilyBeta Migration] Successfully applied ${appliedCount} migration(s).`);
  }

  // 3. Admin Account Seeding Security
  const isProduction = process.env.NODE_ENV === 'production';
  const allowBootstrap = process.env.BOOTSTRAP_ADMIN === 'true';

  const admin = queryOne('SELECT id FROM profiles WHERE role = ?', 'ADMIN');
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

    run(
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
