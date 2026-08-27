import path from 'node:path';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseProvider: 'sqlite' | 'postgres';
  databaseUrl?: string;
  sqlitePath: string;
  jwtSecret: string;
  bootstrapAdmin: boolean;
  bootstrapAdminUsername?: string;
  bootstrapAdminPassword?: string;
  corsOrigin: string | string[];
  dbPoolMax: number;
}

const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
const isProduction = nodeEnv === 'production';

export const config: AppConfig = {
  port: parseInt(process.env.BACKEND_PORT || process.env.PORT || '3006', 10),
  nodeEnv,
  databaseProvider: (process.env.DATABASE_PROVIDER || (isProduction ? 'postgres' : 'sqlite')) as 'sqlite' | 'postgres',
  databaseUrl: process.env.DATABASE_URL,
  sqlitePath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'lilybeta.db'),
  jwtSecret: process.env.JWT_SECRET || 'lilybeta-super-secret-key-change-in-production',
  bootstrapAdmin: process.env.BOOTSTRAP_ADMIN === 'true',
  bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME,
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  corsOrigin: process.env.CORS_ORIGIN || (isProduction ? 'https://beta.lilyhub.top' : '*'),
  dbPoolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
};

export const sanitizeDatabaseUrl = (url?: string): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '******';
    }
    return parsed.toString();
  } catch {
    return '[REDACTED_DATABASE_URL]';
  }
};

export const validateConfig = (): void => {
  if (isProduction) {
    if (config.databaseProvider === 'sqlite') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Local SQLite file persistence is strictly prohibited in production mode. ' +
        'Set DATABASE_PROVIDER=postgres and provide a persistent Supabase/PostgreSQL DATABASE_URL.'
      );
    }

    if (!config.databaseUrl) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: In production mode with DATABASE_PROVIDER=postgres, DATABASE_URL must be configured.'
      );
    }

    if (!config.jwtSecret || config.jwtSecret === 'lilybeta-super-secret-key-change-in-production' || config.jwtSecret.length < 32) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: In production mode, JWT_SECRET must be configured with a cryptographically secure key of at least 32 characters.'
      );
    }

    if (config.bootstrapAdmin && (!config.bootstrapAdminPassword || config.bootstrapAdminPassword === 'admin123456')) {
      throw new Error(
        'FATAL SECURITY ERROR: BOOTSTRAP_ADMIN is enabled in production, but BOOTSTRAP_ADMIN_PASSWORD is using the default insecure password. ' +
        'Provide a strong, unique BOOTSTRAP_ADMIN_PASSWORD.'
      );
    }
  }
};
