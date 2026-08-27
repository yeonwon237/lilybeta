import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * LilyBeta Data Access Layer Strategy:
 * - Development & Automated Testing: High-performance self-contained SQLite via Node.js native `DatabaseSync` with WAL mode.
 * - Production Target: Supabase / PostgreSQL (`beta.lilyhub.top`) with Row-Level Security (RLS) configured via `server/migrations/supabase_schema.sql`.
 * 
 * The database interface provides standardized operations (queryAll, queryOne, run, transaction)
 * to decouple business logic controllers from underlying database drivers.
 */

export interface DatabaseAdapter {
  queryAll<T = any>(sql: string, ...params: any[]): T[];
  queryOne<T = any>(sql: string, ...params: any[]): T | null;
  run(sql: string, ...params: any[]): any;
  transaction<T>(fn: () => T): T;
}

const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), 'data', 'lilybeta.db');

// Ensure parent folder exists
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_FILE);

// Enable WAL mode & foreign keys for safety and concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export const queryAll = <T = any>(sql: string, ...params: any[]): T[] => {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
};

export const queryOne = <T = any>(sql: string, ...params: any[]): T | null => {
  const stmt = db.prepare(sql);
  const res = stmt.get(...params);
  return (res as T) ?? null;
};

export const run = (sql: string, ...params: any[]) => {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
};

export const transaction = <T>(fn: () => T): T => {
  db.exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
