import { Book, Chapter } from '../../types';
import { 
  NormalizedBook, 
  ReadingProgress, 
  ParsedBookDraft, 
  StorageEstimateInfo 
} from '../types';
import { BookSource } from './BookSource';
import { api } from '../../services/api';

export class BetaCloudBookSource implements BookSource {
  private static instance: BetaCloudBookSource | null = null;

  public static getInstance(): BetaCloudBookSource {
    if (!this.instance) {
      this.instance = new BetaCloudBookSource();
    }
    return this.instance;
  }

  /**
   * Get all books accessible to the current user.
   * For Beta Readers: returns only assigned books.
   * For Admins: returns all books.
   */
  public async getBooks(): Promise<Book[]> {
    const res = await api.get<{ books: Book[] }>('/books');
    return res.books || [];
  }

  /**
   * Get single book metadata. Enforces server authorization.
   */
  public async getBook(id: string): Promise<Book | null> {
    try {
      const res = await api.get<{ book: Book }>(`/books/${id}`);
      return res.book || null;
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get specific chapter content and paragraphs. Enforces server authorization.
   */
  public async getChapter(bookId: string, chapterIndex: number): Promise<Chapter | null> {
    try {
      const res = await api.get<{ chapter: Chapter }>(`/books/${bookId}/chapters/${chapterIndex}`);
      return res.chapter || null;
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get Table of Contents for a book.
   */
  public async getChapterList(bookId: string): Promise<Array<{ index: number; title: string; wordCount: number; isRead: boolean; isCurrent: boolean }>> {
    const res = await api.get<{ chapters: Array<{ index: number; title: string; wordCount: number; isRead: boolean; isCurrent: boolean }> }>(`/books/${bookId}/chapters`);
    return res.chapters || [];
  }

  /**
   * Admin save parsed book draft to cloud database.
   */
  public async saveBook(draft: ParsedBookDraft, customMeta?: Partial<NormalizedBook>): Promise<Book> {
    const payload = {
      title: customMeta?.title?.trim() || draft.title,
      author: customMeta?.author?.trim() || draft.author,
      coverUrl: customMeta?.coverUrl || draft.coverUrl,
      coverColor: customMeta?.coverColor || draft.suggestedCoverColor,
      originalFileName: draft.originalFileName,
      fileFormat: draft.fileFormat,
      totalChapters: draft.totalChapters,
      wordCount: draft.wordCount,
      chapters: draft.chapters.map(c => ({
        index: c.index,
        title: c.title,
        paragraphs: c.paragraphs,
        wordCount: c.wordCount,
      })),
    };

    const res = await api.post<{ book: Book }>('/admin/books', payload);
    return res.book;
  }

  /**
   * Admin delete book.
   */
  public async deleteBook(id: string): Promise<void> {
    await api.delete(`/admin/books/${id}`);
  }

  /**
   * Save user reading progress to backend database.
   */
  public async saveProgress(
    bookId: string, 
    chapterIndex: number, 
    percentage: number, 
    chapterTitle: string, 
    scrollPercent?: number, 
    scrollOffset?: number
  ): Promise<void> {
    await api.post(`/books/${bookId}/progress`, {
      chapterIndex,
      percentage,
      chapterTitle,
      scrollPercent: scrollPercent ?? 0,
      scrollOffset: scrollOffset ?? 0,
    });
  }

  /**
   * Get user reading progress from backend database.
   */
  public async getProgress(bookId: string): Promise<ReadingProgress | null> {
    try {
      const res = await api.get<{ progress: ReadingProgress | null }>(`/books/${bookId}/progress`);
      return res.progress;
    } catch {
      return null;
    }
  }

  /**
   * Count accessible books.
   */
  public async countBooks(): Promise<number> {
    const books = await this.getBooks();
    return books.length;
  }

  /**
   * Cloud storage info placeholder.
   */
  public async getStorageEstimate(): Promise<StorageEstimateInfo> {
    return {
      usageMB: 0,
      quotaMB: 1000,
      percentUsed: 0,
      isPersistent: true,
    };
  }
}
