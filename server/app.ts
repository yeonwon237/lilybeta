import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { requireAuth, requireAdmin, requireBookAccess } from './middleware/auth.js';
import * as authController from './controllers/authController.js';
import * as adminController from './controllers/adminController.js';
import * as bookController from './controllers/bookController.js';
import * as editController from './controllers/editController.js';
import * as reviewController from './controllers/reviewController.js';
import { isDbAlive, getDatabaseProvider } from './db/database.js';
import { config } from './config.js';

export const createApp = () => {
  const app = express();

  // Strict CORS configuration
  const origin = config.corsOrigin;
  app.use(cors({
    origin: origin === '*' ? '*' : origin,
    credentials: true,
  }));

  // 50mb limit for large parsed book drafts
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoints (root and /api paths)
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'LilyBeta Backend',
      time: new Date().toISOString(),
    });
  };

  const dbHealthHandler = async (_req: Request, res: Response) => {
    try {
      const alive = await isDbAlive();
      res.status(alive ? 200 : 503).json({
        status: alive ? 'ok' : 'degraded',
        database: alive ? 'connected' : 'disconnected',
        provider: getDatabaseProvider(),
        time: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        provider: getDatabaseProvider(),
        time: new Date().toISOString(),
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
  app.get('/health/db', dbHealthHandler);
  app.get('/api/health/db', dbHealthHandler);

  // Auth routes
  app.post('/api/auth/login', authController.login);
  app.get('/api/auth/me', requireAuth, authController.me);
  app.post('/api/auth/logout', authController.logout);

  // Admin routes
  app.get('/api/admin/beta-readers', requireAuth, requireAdmin, adminController.listBetaReaders);
  app.post('/api/admin/beta-readers', requireAuth, requireAdmin, adminController.createBetaReader);
  app.patch('/api/admin/beta-readers/:id/status', requireAuth, requireAdmin, adminController.toggleBetaReaderStatus);
  app.get('/api/admin/books', requireAuth, requireAdmin, adminController.listBooks);
  app.post('/api/admin/books', requireAuth, requireAdmin, adminController.saveParsedBook);
  app.delete('/api/admin/books/:id', requireAuth, requireAdmin, adminController.deleteBook);
  app.post('/api/admin/books/:id/assign', requireAuth, requireAdmin, adminController.assignBook);
  app.delete('/api/admin/books/:id/assign/:userId', requireAuth, requireAdmin, adminController.revokeAssignment);
  app.get('/api/admin/logs', requireAuth, requireAdmin, adminController.getActivityLogs);
  app.get('/api/admin/books/:id/edits', requireAuth, requireAdmin, editController.listAdminBookEdits);

  // Phase 5: Book Derived Readiness Endpoint
  app.get('/api/admin/books/:id/readiness', requireAuth, requireAdmin, adminController.getBookReadiness);

  // Phase 4: Admin Review & Chapter Approval routes
  app.get('/api/admin/books/:id/review', requireAuth, requireAdmin, reviewController.getBookReviewOverview);
  app.get('/api/admin/books/:id/assignments/:assignmentId/chapters/:index/review', requireAuth, requireAdmin, reviewController.getChapterReviewDetail);
  app.post('/api/admin/edits/:editId/reviews', requireAuth, requireAdmin, reviewController.createEditReview);
  app.post('/api/admin/books/:id/assignments/:assignmentId/chapters/:index/approve', requireAuth, requireAdmin, reviewController.approveChapter);
  app.post('/api/admin/books/:id/assignments/:assignmentId/chapters/:index/reopen', requireAuth, requireAdmin, reviewController.reopenChapter);
  app.patch('/api/admin/notes/:noteId/resolve', requireAuth, requireAdmin, reviewController.resolveNote);

  // Books / Reader routes (Secured against IDOR)
  app.get('/api/books', requireAuth, bookController.listBooks);
  app.get('/api/books/:id', requireAuth, requireBookAccess, bookController.getBook);
  app.get('/api/books/:id/workflow', requireAuth, requireBookAccess, bookController.getChapterWorkflow);
  app.get('/api/books/:id/chapters', requireAuth, requireBookAccess, bookController.getChapterList);
  app.get('/api/books/:id/chapters/:index/meta', requireAuth, requireBookAccess, bookController.getChapterMeta);
  app.get('/api/books/:id/chapters/:index', requireAuth, requireBookAccess, bookController.getChapter);
  app.get('/api/books/:id/chapters/:index/approved', requireAuth, requireBookAccess, reviewController.getApprovedChapterVersion);
  app.post('/api/books/:id/chapters/:index/complete', requireAuth, requireBookAccess, bookController.completeChapter);
  app.get('/api/books/:id/progress', requireAuth, requireBookAccess, bookController.getProgress);
  app.post('/api/books/:id/progress', requireAuth, requireBookAccess, bookController.saveProgress);

  // Phase 3: Inline Edits & Multi-Revision routes
  app.get('/api/books/:id/chapters/:index/edits', requireAuth, requireBookAccess, editController.listChapterEdits);
  app.post('/api/books/:id/chapters/:index/edits', requireAuth, requireBookAccess, editController.createEdit);
  app.patch('/api/books/:id/chapters/:index/edits/:editId', requireAuth, requireBookAccess, editController.updateEdit);
  app.delete('/api/books/:id/chapters/:index/edits/:editId', requireAuth, requireBookAccess, editController.deleteEdit);
  app.get('/api/books/:id/chapters/:index/edits/:editId/revisions', requireAuth, requireBookAccess, editController.getEditRevisions);

  // Phase 3: Paragraph Selection Notes routes
  app.get('/api/books/:id/chapters/:index/notes', requireAuth, requireBookAccess, editController.listChapterNotes);
  app.post('/api/books/:id/chapters/:index/notes', requireAuth, requireBookAccess, editController.createNote);
  app.delete('/api/books/:id/chapters/:index/notes/:noteId', requireAuth, requireBookAccess, editController.deleteNote);

  // Centralized error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[LilyBeta Uncaught Error]', err);
    const status = err.status || 500;
    const message = config.nodeEnv === 'production' && status === 500
      ? 'Internal server error'
      : (err.message || 'Lỗi hệ thống');
    res.status(status).json({ error: message, code: err.code });
  });

  return app;
};
