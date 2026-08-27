import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseAdapter, QueryResult } from './DatabaseAdapter.js';

const { Pool } = pg;

export interface TxContext {
  client: pg.PoolClient;
}

export const txStorage = new AsyncLocalStorage<TxContext>();

export function translatePlaceholders(sql: string): string {
  let idx = 1;
  return sql.replace(/'(?:''|[^'])*'|\?/g, (match) => {
    if (match === '?') {
      return `$${idx++}`;
    }
    return match;
  });
}

export class PostgresAdapter implements DatabaseAdapter {
  public readonly provider = 'postgres' as const;
  public readonly pool: pg.Pool;

  constructor(connectionStringOrConfig?: string | pg.PoolConfig) {
    const defaultUrl = process.env.DATABASE_URL;
    let poolConfig: pg.PoolConfig;

    if (typeof connectionStringOrConfig === 'string') {
      poolConfig = { connectionString: connectionStringOrConfig };
    } else if (connectionStringOrConfig) {
      poolConfig = connectionStringOrConfig;
    } else {
      poolConfig = { connectionString: defaultUrl };
    }

    const connStr = typeof poolConfig.connectionString === 'string' ? poolConfig.connectionString : '';
    const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');

    this.pool = new Pool({
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      ...poolConfig,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err);
    });
  }

  private getRunner(): pg.Pool | pg.PoolClient {
    const tx = txStorage.getStore();
    return tx ? tx.client : this.pool;
  }

  private normalizeParams(params: any[]): any[] {
    return params.map(p => {
      // In JS, undefined causes errors in pg driver; map to null
      if (p === undefined) return null;
      return p;
    });
  }

  public async queryAll<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const translatedSql = translatePlaceholders(sql);
    const normalizedParams = this.normalizeParams(params);
    const runner = this.getRunner();
    const res = await runner.query(translatedSql, normalizedParams);
    return res.rows as T[];
  }

  public async queryOne<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    const rows = await this.queryAll<T>(sql, ...params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async run(sql: string, ...params: any[]): Promise<QueryResult> {
    const translatedSql = translatePlaceholders(sql);
    const normalizedParams = this.normalizeParams(params);
    const runner = this.getRunner();
    const res = await runner.query(translatedSql, normalizedParams);
    return {
      changes: res.rowCount ?? 0,
    };
  }

  public async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T> | T): Promise<T> {
    // If already inside a transaction, reuse current client
    const existingTx = txStorage.getStore();
    if (existingTx) {
      return await fn(this);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await txStorage.run({ client }, async () => {
        return await fn(this);
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[PostgreSQL Rollback Error]', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async isAlive(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 AS alive');
      return res.rows.length > 0 && res.rows[0].alive === 1;
    } catch {
      return false;
    }
  }
}
