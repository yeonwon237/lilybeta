import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, queryOne, run } from '../db/database.js';

export const runMigrations = async () => {
  console.log('[LilyBeta Migration] Running migrations...');
  const migrationPath = path.join(process.cwd(), 'server', 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  db.exec(sql);
  console.log('[LilyBeta Migration] Schema initialized successfully.');

  // Check Admin Seed Security
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
