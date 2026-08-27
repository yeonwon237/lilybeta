import { createApp } from './app.js';
import { runMigrations } from './migrations/runner.js';
import { validateConfig, config } from './config.js';
import { closeDatabase, getDatabaseProvider } from './db/database.js';

const PORT = config.port;

const startServer = async () => {
  try {
    // 1. Validate startup configuration (fail fast on misconfiguration)
    validateConfig();

    console.log(`[LilyBeta Server] Database Provider: ${getDatabaseProvider().toUpperCase()}`);

    // 2. Run schema migrations
    await runMigrations();

    // 3. Start HTTP server
    const app = createApp();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[LilyBeta Server] Running on http://localhost:${PORT}`);
      console.log(`[LilyBeta Server] API endpoint: http://localhost:${PORT}/api`);
      console.log(`[LilyBeta Server] Health check: http://localhost:${PORT}/health`);
    });

    // 4. Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[LilyBeta Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await closeDatabase();
          console.log('[LilyBeta Server] Database connections closed. Process terminated.');
          process.exit(0);
        } catch (err) {
          console.error('[LilyBeta Server] Error closing database connections:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('[LilyBeta Server] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
