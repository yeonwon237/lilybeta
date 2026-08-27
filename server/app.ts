import express from 'express';
import cors from 'cors';
import { requireAuth, requireAdmin, requireBookAccess } from './middleware/auth.js';
import * as authController from './controllers/authController.js';
import * as adminController from './controllers/adminController.js';
import * as bookController from './controllers/bookController.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  // 50mb limit for large parsed book drafts
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'LilyBeta Backend', time: new Date().toISOString() });
  });

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

  // Books / Reader routes (Secured against IDOR)
  app.get('/api/books', requireAuth, bookController.listBooks);
  app.get('/api/books/:id', requireAuth, requireBookAccess, bookController.getBook);
  app.get('/api/books/:id/workflow', requireAuth, requireBookAccess, bookController.getChapterWorkflow);
  app.get('/api/books/:id/chapters', requireAuth, requireBookAccess, bookController.getChapterList);
  app.get('/api/books/:id/chapters/:index', requireAuth, requireBookAccess, bookController.getChapter);
  app.post('/api/books/:id/chapters/:index/complete', requireAuth, requireBookAccess, bookController.completeChapter);
  app.get('/api/books/:id/progress', requireAuth, requireBookAccess, bookController.getProgress);
  app.post('/api/books/:id/progress', requireAuth, requireBookAccess, bookController.saveProgress);

  return app;
};
