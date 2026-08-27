import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { DatabaseAdapter, QueryResult } from './DatabaseAdapter.js';

const require = createRequire(import.meta.url);

export class SqliteAdapter implements DatabaseAdapter {
  public readonly provider = 'sqlite' as const;
  public readonly db: any;

  constructor(dbPath?: string) {
    let DatabaseSyncClass: any;
    try {
      const sqliteModule = require('node:sqlite');
      DatabaseSyncClass = sqliteModule.DatabaseSync;
    } catch {
      throw new Error(
        'node:sqlite is not supported in this Node.js runtime. ' +
        'Node.js 22+ is required for local SQLite mode. ' +
        'In production/cloud deployments, configure DATABASE_PROVIDER=postgres.'
      );
    }

    const targetPath = dbPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'lilybeta.db');
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSyncClass(targetPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  private normalizeParams(params: any[]): any[] {
    return params.map(p => {
      if (typeof p === 'boolean') {
        return p ? 1 : 0;
      }
      return p;
    });
  }

  public queryAll<T = any>(sql: string, ...params: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...this.normalizeParams(params)) as T[];
  }

  public queryOne<T = any>(sql: string, ...params: any[]): T | null {
    const stmt = this.db.prepare(sql);
    const res = stmt.get(...this.normalizeParams(params));
    return (res as T) ?? null;
  }

  public run(sql: string, ...params: any[]): QueryResult {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...this.normalizeParams(params));
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T> | T): Promise<T> | T {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const result = fn(this);
      if (result instanceof Promise || (result && typeof (result as any).then === 'function')) {
        return (result as Promise<T>)
          .then((res) => {
            this.db.exec('COMMIT');
            return res;
          })
          .catch((err) => {
            try {
              this.db.exec('ROLLBACK');
            } catch {}
            throw err;
          });
      }
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw error;
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

  public async isAlive(): Promise<boolean> {
    try {
      const row = this.queryOne<{ alive: number }>('SELECT 1 AS alive');
      return Boolean(row && row.alive === 1);
    } catch {
      return false;
    }
  }
}
