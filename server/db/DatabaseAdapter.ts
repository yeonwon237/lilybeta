/**
 * Database Adapter Interface
 * 
 * Provides an abstracted data access contract for LilyBeta so controllers and business
 * logic remain decoupled from the underlying engine (SQLite vs PostgreSQL / Supabase).
 */

export interface QueryResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

export interface DatabaseAdapter {
  readonly provider: 'sqlite' | 'postgres';
  queryAll<T = any>(sql: string, ...params: any[]): Promise<T[]> | T[];
  queryOne<T = any>(sql: string, ...params: any[]): Promise<T | null> | (T | null);
  run(sql: string, ...params: any[]): Promise<QueryResult> | QueryResult;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T> | T): Promise<T> | T;
  close(): Promise<void> | void;
  isAlive(): Promise<boolean>;
}
