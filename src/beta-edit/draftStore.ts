import { ErrorType } from './editTypes';

/**
 * Centralized Draft Store for LilyBeta
 * 
 * Provides robust, scoped local draft recovery for both:
 * 1. New edit drafts (anchored to paragraph and offsets)
 * 2. Existing edit drafts (anchored to editId and baseVersion)
 * 
 * Guarantees:
 * - Scoped strictly to authenticated `userId`.
 * - Isolated per book and per chapter.
 * - Prevents collision between users, books, or chapters.
 * - Detects stale drafts when server edit version has advanced.
 */

export interface BaseDraft {
  userId: string;
  bookId: string;
  chapterIndex: number;
  updatedAt: number;
}

export interface NewEditDraft extends BaseDraft {
  type: 'NEW';
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  originalText: string;
  proposedText: string;
  errorType: ErrorType;
  reason?: string;
}

export interface ExistingEditDraft extends BaseDraft {
  type: 'EXISTING';
  editId: string;
  baseVersion: number;
  proposedText: string;
  errorType: ErrorType;
  reason?: string;
}

export type EditDraft = NewEditDraft | ExistingEditDraft;

// Fallback in-memory storage for test/SSR environments without window.localStorage
class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

const memoryFallback = new MemoryStorage();

const getStorage = (): Storage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return memoryFallback as unknown as Storage;
};

// =========================================================================
// Key Generation Helpers
// =========================================================================

export const buildNewDraftKey = (
  userId: string,
  bookId: string,
  chapterIndex: number,
  paragraphIndex: number,
  startOffset: number,
  endOffset: number
): string => {
  return `lilybeta:draft:new:${userId}:${bookId}:${chapterIndex}:${paragraphIndex}:${startOffset}:${endOffset}`;
};

export const buildExistingDraftKey = (
  userId: string,
  editId: string,
  baseVersion: number
): string => {
  return `lilybeta:draft:edit:${userId}:${editId}:${baseVersion}`;
};

// =========================================================================
// DraftStore Implementation
// =========================================================================

export class DraftStore {
  /**
   * Save draft for a new edit
   */
  static saveNewDraft(draft: Omit<NewEditDraft, 'type' | 'updatedAt'>): void {
    const storage = getStorage();
    const key = buildNewDraftKey(
      draft.userId,
      draft.bookId,
      draft.chapterIndex,
      draft.paragraphIndex,
      draft.startOffset,
      draft.endOffset
    );

    const payload: NewEditDraft = {
      ...draft,
      type: 'NEW',
      updatedAt: Date.now(),
    };

    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn('[DraftStore] Failed to write new draft to storage:', err);
    }
  }

  /**
   * Retrieve draft for a new edit
   */
  static getNewDraft(
    userId: string,
    bookId: string,
    chapterIndex: number,
    paragraphIndex: number,
    startOffset: number,
    endOffset: number
  ): NewEditDraft | null {
    const storage = getStorage();
    const key = buildNewDraftKey(userId, bookId, chapterIndex, paragraphIndex, startOffset, endOffset);
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.type === 'NEW' && parsed.userId === userId) {
        return parsed as NewEditDraft;
      }
    } catch {}
    return null;
  }

  /**
   * Delete draft for a new edit
   */
  static deleteNewDraft(
    userId: string,
    bookId: string,
    chapterIndex: number,
    paragraphIndex: number,
    startOffset: number,
    endOffset: number
  ): void {
    const storage = getStorage();
    const key = buildNewDraftKey(userId, bookId, chapterIndex, paragraphIndex, startOffset, endOffset);
    try {
      storage.removeItem(key);
    } catch {}
  }

  /**
   * Save draft for an existing edit
   */
  static saveExistingDraft(draft: Omit<ExistingEditDraft, 'type' | 'updatedAt'>): void {
    const storage = getStorage();
    const key = buildExistingDraftKey(draft.userId, draft.editId, draft.baseVersion);

    const payload: ExistingEditDraft = {
      ...draft,
      type: 'EXISTING',
      updatedAt: Date.now(),
    };

    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn('[DraftStore] Failed to write existing draft to storage:', err);
    }
  }

  /**
   * Retrieve draft for an existing edit, detecting version staleness/conflicts
   */
  static getExistingDraft(
    userId: string,
    editId: string,
    currentVersion?: number
  ): { draft: ExistingEditDraft; isStale: boolean } | null {
    const storage = getStorage();
    // Scan storage for any draft matching this user and editId
    const prefix = `lilybeta:draft:edit:${userId}:${editId}:`;

    try {
      let latestDraft: ExistingEditDraft | null = null;

      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(prefix)) {
          const raw = storage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as ExistingEditDraft;
            if (parsed.type === 'EXISTING' && parsed.userId === userId && parsed.editId === editId) {
              if (!latestDraft || parsed.updatedAt > latestDraft.updatedAt) {
                latestDraft = parsed;
              }
            }
          }
        }
      }

      if (!latestDraft) return null;

      const isStale = currentVersion !== undefined && latestDraft.baseVersion !== currentVersion;
      return { draft: latestDraft, isStale };
    } catch {}

    return null;
  }

  /**
   * Delete draft for an existing edit
   */
  static deleteExistingDraft(userId: string, editId: string, baseVersion?: number): void {
    const storage = getStorage();
    if (baseVersion !== undefined) {
      const key = buildExistingDraftKey(userId, editId, baseVersion);
      try {
        storage.removeItem(key);
      } catch {}
      return;
    }

    // Delete all versioned drafts for this user and editId
    const prefix = `lilybeta:draft:edit:${userId}:${editId}:`;
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => storage.removeItem(k));
    } catch {}
  }

  /**
   * List all drafts for a specific user, book, and chapter
   */
  static listDraftsForChapter(userId: string, bookId: string, chapterIndex: number): EditDraft[] {
    const storage = getStorage();
    const drafts: EditDraft[] = [];

    const newPrefix = `lilybeta:draft:new:${userId}:${bookId}:${chapterIndex}:`;
    const editPrefix = `lilybeta:draft:edit:${userId}:`;

    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k) continue;

        if (k.startsWith(newPrefix)) {
          const raw = storage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as NewEditDraft;
            if (parsed.userId === userId && parsed.bookId === bookId && parsed.chapterIndex === chapterIndex) {
              drafts.push(parsed);
            }
          }
        } else if (k.startsWith(editPrefix)) {
          const raw = storage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as ExistingEditDraft;
            if (parsed.userId === userId && parsed.bookId === bookId && parsed.chapterIndex === chapterIndex) {
              drafts.push(parsed);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[DraftStore] Failed to list drafts for chapter:', err);
    }

    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Check if any unsaved drafts exist for a chapter
   */
  static hasUnsavedDraftForChapter(userId: string, bookId: string, chapterIndex: number): boolean {
    return this.listDraftsForChapter(userId, bookId, chapterIndex).length > 0;
  }

  /**
   * Discard all drafts for a specific chapter
   */
  static discardAllDraftsForChapter(userId: string, bookId: string, chapterIndex: number): number {
    const storage = getStorage();
    const drafts = this.listDraftsForChapter(userId, bookId, chapterIndex);
    let discardedCount = 0;

    for (const d of drafts) {
      if (d.type === 'NEW') {
        const key = buildNewDraftKey(
          d.userId,
          d.bookId,
          d.chapterIndex,
          d.paragraphIndex,
          d.startOffset,
          d.endOffset
        );
        try {
          storage.removeItem(key);
          discardedCount++;
        } catch {}
      } else if (d.type === 'EXISTING') {
        const key = buildExistingDraftKey(d.userId, d.editId, d.baseVersion);
        try {
          storage.removeItem(key);
          discardedCount++;
        } catch {}
      }
    }

    return discardedCount;
  }

  /**
   * Reset store (useful for automated testing)
   */
  static _clearAll(): void {
    const storage = getStorage();
    storage.clear();
  }
}
