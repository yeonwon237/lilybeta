import { DatabaseAdapter, QueryResult } from './DatabaseAdapter.js';
import { SqliteAdapter } from './sqliteAdapter.js';
import { PostgresAdapter } from './postgresAdapter.js';

export type { DatabaseAdapter, QueryResult };

export const getDatabaseProvider = (): 'sqlite' | 'postgres' => {
  const providerEnv = process.env.DATABASE_PROVIDER?.toLowerCase();
  if (providerEnv === 'postgres' || providerEnv === 'postgresql') {
    return 'postgres';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'postgres';
  }
  return 'sqlite';
};

let currentAdapter: DatabaseAdapter | null = null;

export const getAdapter = (): DatabaseAdapter => {
  if (!currentAdapter) {
    const provider = getDatabaseProvider();
    if (provider === 'postgres') {
      currentAdapter = new PostgresAdapter();
    } else {
      currentAdapter = new SqliteAdapter();
    }
  }
  return currentAdapter;
};

export const setAdapter = (adapter: DatabaseAdapter | null): void => {
  currentAdapter = adapter;
};

// Backward-compatibility export for tests and SQLite-specific scripts
export const db = {
  get exec() {
    const adapter = getAdapter();
    if (adapter.provider === 'sqlite') {
      return (adapter as SqliteAdapter).db.exec.bind((adapter as SqliteAdapter).db);
    }
    return () => {
      throw new Error('Direct db.exec is not supported in PostgreSQL mode. Use adapter methods.');
    };
  },
  get prepare() {
    const adapter = getAdapter();
    if (adapter.provider === 'sqlite') {
      return (adapter as SqliteAdapter).db.prepare.bind((adapter as SqliteAdapter).db);
    }
    return () => {
      throw new Error('Direct db.prepare is not supported in PostgreSQL mode. Use adapter methods.');
    };
  },
  get close() {
    const adapter = getAdapter();
    if (adapter.provider === 'sqlite') {
      return (adapter as SqliteAdapter).db.close.bind((adapter as SqliteAdapter).db);
    }
    return () => {};
  },
};

export const queryAll = <T = any>(sql: string, ...params: any[]): Promise<T[]> | T[] => {
  return getAdapter().queryAll<T>(sql, ...params);
};

export const queryOne = <T = any>(sql: string, ...params: any[]): Promise<T | null> | (T | null) => {
  return getAdapter().queryOne<T>(sql, ...params);
};

export const run = (sql: string, ...params: any[]): Promise<QueryResult> | QueryResult => {
  return getAdapter().run(sql, ...params);
};

export const transaction = <T>(fn: (tx: DatabaseAdapter) => Promise<T> | T): Promise<T> | T => {
  return getAdapter().transaction<T>(fn);
};

export const isDbAlive = async (): Promise<boolean> => {
  return getAdapter().isAlive();
};

export const closeDatabase = async (): Promise<void> => {
  if (currentAdapter) {
    await currentAdapter.close();
    currentAdapter = null;
  }
};
