import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

const isProduction = process.env.NODE_ENV === 'production';
const envSecret = process.env.JWT_SECRET;

if (isProduction && (!envSecret || envSecret === 'lilybeta-super-secret-key-change-in-production')) {
  throw new Error('FATAL SECURITY ERROR: In production mode, JWT_SECRET must be explicitly configured with a strong secret key.');
}

export const JWT_SECRET = envSecret || 'lilybeta-super-secret-key-change-in-production';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'BETA_READER';
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu mã xác thực' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    
    // Always query database to verify fresh status and check if account has been disabled
    const userRow = queryOne<any>(
      'SELECT id, username, display_name, role, is_active FROM profiles WHERE id = ?',
      payload.id
    );

    if (!userRow) {
      res.status(401).json({ error: 'Tài khoản không tồn tại' });
      return;
    }

    if (userRow.is_active !== 1) {
      res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.' });
      return;
    }

    req.user = {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role,
      isActive: Boolean(userRow.is_active),
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác này' });
    return;
  }
  next();
};

/**
 * IDOR Defense Firewall:
 * Ensures only ADMIN or explicitly assigned BETA_READER with ACTIVE assignment can access book/chapter data.
 */
export const requireBookAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Yêu cầu đăng nhập' });
    return;
  }

  // Admin has universal access
  if (req.user.role === 'ADMIN') {
    next();
    return;
  }

  const bookId = req.params.id || req.params.bookId;
  if (!bookId) {
    res.status(400).json({ error: 'Thiếu mã nhận diện tác phẩm' });
    return;
  }

  // Check assignment strictly in database with status ACTIVE
  const assignment = queryOne(
    'SELECT id FROM beta_assignments WHERE book_id = ? AND beta_user_id = ? AND status = ?',
    bookId,
    req.user.id,
    'ACTIVE'
  );

  if (!assignment) {
    res.status(403).json({ 
      error: 'Truy cập bị từ chối: Bạn không có phân công hoạt động đối với tác phẩm này.',
      code: 'FORBIDDEN_BOOK_ACCESS'
    });
    return;
  }

  next();
};
