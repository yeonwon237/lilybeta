import { ParsedBookDraft, NormalizedChapter, ImportDiagnostics } from '../types';
import { TextCleaner } from '../cleaner/TextCleaner';
import { ChapterDetector } from '../chapter-detector/ChapterDetector';

export class TxtImporter {
  /**
   * Derive a clean human-readable title from a raw filename
   */
  public static cleanFileNameToTitle(fileName: string): string {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const cleanWords = withoutExt
      .replace(/[_\-+]+/g, ' ')
      .replace(/\s*(?:full|hoan|convert|dich|edit|raw)\s*$/i, '')
      .trim();

    if (!cleanWords) return 'Tác phẩm mới';

    return cleanWords
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Smartly decode ArrayBuffer supporting UTF-8 (with/without BOM), UTF-16LE, UTF-16BE
   */
  public static decodeBuffer(buffer: ArrayBuffer): { text: string; encoding: string; warnings: string[] } {
    const bytes = new Uint8Array(buffer);
    const warnings: string[] = [];

    // 1. Check UTF-8 BOM (0xEF, 0xBB, 0xBF)
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      try {
        const text = new TextDecoder('utf-8').decode(bytes.subarray(3));
        return { text, encoding: 'UTF-8 with BOM', warnings };
      } catch (err: any) {
        warnings.push(`Lỗi giải mã UTF-8 BOM: ${err?.message}`);
      }
    }

    // 2. Check UTF-16 LE BOM (0xFF, 0xFE)
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      try {
        const text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
        return { text, encoding: 'UTF-16 LE with BOM', warnings };
      } catch (err: any) {
        warnings.push(`Lỗi giải mã UTF-16 LE: ${err?.message}`);
      }
    }

    // 3. Check UTF-16 BE BOM (0xFE, 0xFF)
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      try {
        const text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        return { text, encoding: 'UTF-16 BE with BOM', warnings };
      } catch (err: any) {
        warnings.push(`Lỗi giải mã UTF-16 BE: ${err?.message}`);
      }
    }

    // 4. Default: Standard UTF-8
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(bytes);

      // Check if replacement character density is abnormally high
      const replacementCount = (text.match(/\uFFFD/g) || []).length;
      if (replacementCount > 10 && replacementCount > text.length * 0.01) {
        warnings.push('Phát hiện nhiều ký tự không tương thích với UTF-8 tiêu chuẩn.');
      }

      return { text, encoding: 'UTF-8', warnings };
    } catch {
      // Fallback
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      warnings.push('Đã giải mã theo cơ chế Binary Fallback.');
      return { text: binary, encoding: 'Binary Fallback', warnings };
    }
  }

  /**
   * Suggest an aesthetic cover color based on title hash
   */
  private static pickCoverColor(title: string): string {
    const colors = [
      '#D9829B', // Rose Lily
      '#7AA387', // Matcha Jade
      '#8C7AB3', // Lavender Moon
      '#D19A66', // Amber Vintage
      '#5C8E9E', // Azure Ocean
      '#9C6B82', // Plum Silk
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Inspect first lines for title/author metadata
   */
  private static extractMetadataFromHeader(rawLines: string[], fallbackTitle: string): { title: string; author: string } {
    let extractedTitle = fallbackTitle;
    let extractedAuthor = 'Chưa rõ tác giả';

    const headerSnippet = rawLines.slice(0, 20);
    for (const line of headerSnippet) {
      const trimmed = line.trim();

      const authorMatch = trimmed.match(/^(?:Tác giả|Tac gia|Author)\s*[:：\-—]\s*(.+)$/i);
      if (authorMatch && authorMatch[1]) {
        extractedAuthor = authorMatch[1].trim();
        continue;
      }

      const titleMatch = trimmed.match(/^(?:Tên truyện|Ten truyen|Tựa đề|Tác phẩm|Title)\s*[:：\-—]\s*(.+)$/i);
      if (titleMatch && titleMatch[1]) {
        extractedTitle = titleMatch[1].trim();
        continue;
      }
    }

    return { title: extractedTitle, author: extractedAuthor };
  }

  /**
   * Parse a raw TXT File into a ParsedBookDraft
   */
  public static async parseFile(file: File): Promise<ParsedBookDraft> {
    const arrayBuffer = await file.arrayBuffer();
    const { text: rawText, encoding, warnings: decodeWarnings } = this.decodeBuffer(arrayBuffer);
    const cleanedText = TextCleaner.clean(rawText);

    const fallbackTitle = this.cleanFileNameToTitle(file.name);
    const { title, author } = this.extractMetadataFromHeader(cleanedText.split('\n'), fallbackTitle);

    const detection = ChapterDetector.detect(cleanedText, 'Chương 1: Khởi đầu');
    const fileSizeMB = Number((file.size / (1024 * 1024)).toFixed(2)) || 0.05;

    // Convert to normalized chapters
    const chapters: NormalizedChapter[] = detection.chapters.map((c) => ({
      id: `chap-${c.index}`,
      bookId: '', // Will be assigned on save
      index: c.index,
      title: c.title,
      paragraphs: TextCleaner.toParagraphs(c.body),
      wordCount: c.wordCount,
      volumeTitle: c.volumeTitle,
      specialType: c.specialType,
    }));

    const allWarnings = [...decodeWarnings, ...detection.warnings];

    const diagnostics: ImportDiagnostics = {
      format: 'TXT',
      fileSize: file.size,
      decodedEncoding: encoding,
      rawCharacters: rawText.length,
      cleanedCharacters: cleanedText.length,
      detectedHeadingCount: detection.hasDetectedChapters ? detection.totalChapters : 0,
      candidateCount: detection.candidateCount,
      acceptedCount: detection.acceptedCount,
      rejectedCount: detection.rejectedCount,
      chapterCount: chapters.length,
      detectionStrategy: detection.strategy,
      confidence: detection.confidence,
      score: detection.score,
      anomalies: detection.anomalies,
      warnings: allWarnings,
      errors: [],
      firstChaptersPreview: detection.firstChaptersPreview,
      lastChaptersPreview: detection.lastChaptersPreview,
    };

    return {
      title,
      author,
      originalFileName: file.name,
      fileFormat: 'TXT',
      fileSizeMB,
      totalChapters: chapters.length,
      wordCount: detection.totalWords,
      chapters,
      hasDetectedChapters: detection.hasDetectedChapters,
      confidence: detection.confidence,
      detectionStrategy: detection.strategy,
      diagnostics,
      rawBlob: arrayBuffer,
      suggestedCoverColor: this.pickCoverColor(title),
    };
  }
}
