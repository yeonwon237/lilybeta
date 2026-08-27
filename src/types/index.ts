export type UserRole = 'ADMIN' | 'BETA_READER';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BookStatus = 'DRAFT' | 'ASSIGNED' | 'IN_BETA' | 'BETA_COMPLETE' | 'ARCHIVED';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  coverColor?: string;
  originalFileName?: string;
  fileFormat: 'TXT' | 'EPUB' | 'DOCX' | 'WEBSITE';
  totalChapters: number;
  wordCount: number;
  status: BookStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  
  // Reading metadata
  currentChapter?: number;
  currentChapterTitle?: string;
  progressPercent?: number;
  lastReadAt?: string;

  // Assignment info (if loaded in view)
  assignedTo?: {
    id: string;
    username: string;
    displayName: string;
    assignedAt: string;
    status: string;
  } | null;
}

export interface Chapter {
  id: string;
  bookId: string;
  index: number; // 1-based index
  title: string;
  wordCount: number;
  paragraphs?: string[];
  isRead?: boolean;
  isCurrent?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  bookId: string;
  betaUserId: string;
  assignedBy: string;
  assignedAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'REVOKED';
  
  // Joined fields
  bookTitle?: string;
  betaUserName?: string;
  betaUserDisplayName?: string;
}

export interface ChapterProgress {
  id: string;
  assignmentId: string;
  bookId: string;
  chapterId?: string;
  betaUserId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';
  chapterIndex: number;
  scrollPercent: number;
  scrollOffset?: number;
  percentage: number;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: 'LOGIN' | 'BOOK_CREATED' | 'BOOK_ASSIGNED' | 'BOOK_OPENED' | 'CHAPTER_OPENED';
  bookId?: string;
  chapterId?: string;
  details?: string;
  createdAt: string;
  userName?: string;
  userDisplayName?: string;
  bookTitle?: string;
}
