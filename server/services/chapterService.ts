import crypto from 'node:crypto';
import { queryOne, run } from '../db/database.js';

export class ChapterService {
  /**
   * Compute deterministic SHA-256 hash of paragraphs.
   */
  public static computeContentHash(paragraphs: string[]): string {
    const serialized = JSON.stringify(paragraphs || []);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Update chapter content atomically, guaranteeing deterministic hash computation
   * and content_version increments to ensure reader cache invalidation.
   */
  public static async updateChapterContent(params: {
    bookId: string;
    chapterIndex: number;
    title?: string;
    paragraphs?: string[];
    wordCount?: number;
  }): Promise<{
    chapterId: string;
    contentVersion: number;
    contentHash: string;
    versionIncremented: boolean;
  }> {
    const { bookId, chapterIndex, title, paragraphs, wordCount } = params;

    const existing = await queryOne<any>(
      'SELECT id, title, paragraphs, word_count, content_version, content_hash FROM beta_chapters WHERE book_id = ? AND chapter_index = ?',
      bookId,
      chapterIndex
    );

    if (!existing) {
      throw new Error(`Chapter ${chapterIndex} does not exist in book ${bookId}`);
    }

    const now = new Date().toISOString();
    let nextVersion = existing.content_version || 1;
    let nextHash = existing.content_hash;
    let versionIncremented = false;
    let paragraphsJson = existing.paragraphs;

    if (paragraphs !== undefined) {
      const newHash = this.computeContentHash(paragraphs);
      paragraphsJson = typeof paragraphs === 'string' ? paragraphs : JSON.stringify(paragraphs);

      // Only increment content_version if the actual textual paragraphs have changed
      if (newHash !== existing.content_hash) {
        nextVersion = (existing.content_version || 1) + 1;
        nextHash = newHash;
        versionIncremented = true;
      }
    }

    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    const nextWordCount = wordCount !== undefined ? wordCount : existing.word_count;

    await run(
      `UPDATE beta_chapters SET
        title = ?,
        paragraphs = ?,
        word_count = ?,
        content_version = ?,
        content_hash = ?,
        updated_at = ?
       WHERE id = ?`,
      nextTitle,
      paragraphsJson,
      nextWordCount,
      nextVersion,
      nextHash,
      now,
      existing.id
    );

    return {
      chapterId: existing.id,
      contentVersion: nextVersion,
      contentHash: nextHash,
      versionIncremented,
    };
  }
}
