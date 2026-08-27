import { createApp } from './app.js';
import { runMigrations } from './migrations/runner.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const startServer = async () => {
  try {
    await runMigrations();

    const app = createApp();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[LilyBeta Server] Running on http://localhost:${PORT}`);
      console.log(`[LilyBeta Server] API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('[LilyBeta Server] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
