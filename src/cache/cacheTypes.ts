export interface CachedChapter {
  userId: string;
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  title: string;
  paragraphs: string[];
  wordCount: number;
  contentVersion: number;
  contentHash?: string;
  updatedAt: string;
  cachedAt: number;
}

export interface CachePruneOptions {
  maxAgeDays?: number;
  maxEntries?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
}
