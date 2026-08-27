import { Book, Chapter } from '../../types';
import { 
  NormalizedBook, 
  NormalizedChapter, 
  ReadingProgress, 
  ParsedBookDraft, 
  StorageEstimateInfo 
} from '../types';

export interface BookSource {
  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | null>;
  getChapter(bookId: string, chapterIndex: number): Promise<Chapter | null>;
  getChapterList(bookId: string): Promise<Array<{ index: number; title: string; wordCount: number; isRead: boolean; isCurrent: boolean }>>;
  saveBook(draft: ParsedBookDraft, customMeta?: Partial<NormalizedBook>): Promise<Book>;
  deleteBook(id: string): Promise<void>;
  saveProgress(bookId: string, chapterIndex: number, percentage: number, chapterTitle: string, scrollPercent?: number, scrollOffset?: number): Promise<void>;
  getProgress(bookId: string): Promise<ReadingProgress | null>;
  countBooks(): Promise<number>;
  getStorageEstimate(): Promise<StorageEstimateInfo>;
}
