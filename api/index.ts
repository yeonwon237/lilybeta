import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';
import { runMigrations } from '../server/migrations/runner.js';

let appInstance: any = null;
let migrationPromise: Promise<void> | null = null;

async function initServerless() {
  if (!appInstance) {
    appInstance = createApp();
  }
  if (!migrationPromise && (process.env.DATABASE_PROVIDER === 'postgres' || process.env.DATABASE_URL)) {
    migrationPromise = runMigrations().catch((err) => {
      console.error('[Vercel Serverless] Migration startup error:', err);
      migrationPromise = null;
      throw err;
    });
  }
  if (migrationPromise) {
    await migrationPromise;
  }
  return appInstance;
}

export default async function handler(req: Request, res: Response) {
  const app = await initServerless();
  return app(req, res);
}
