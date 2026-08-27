import { ParsedBookDraft, SupportedFormat } from '../types';
import { TxtImporter } from './TxtImporter';
import { EpubImporter } from './EpubImporter';
import { DocxImporter } from './DocxImporter';

export class BookImporter {
  /**
   * Determine file format from extension or MIME type
   */
  public static detectFormat(file: File): SupportedFormat {
    const name = file.name.toLowerCase();
    if (name.endsWith('.epub')) return 'EPUB';
    if (name.endsWith('.docx')) return 'DOCX';
    return 'TXT';
  }

  /**
   * Unified dispatcher: parse any supported book file into a Normalized Book Draft
   */
  public static async parse(file: File): Promise<ParsedBookDraft> {
    if (!file || file.size === 0) {
      throw new Error('Tệp rỗng hoặc không hợp lệ. Vui lòng chọn tệp truyện có nội dung.');
    }

    const format = this.detectFormat(file);

    switch (format) {
      case 'EPUB':
        return EpubImporter.parseFile(file);
      case 'DOCX':
        return DocxImporter.parseFile(file);
      case 'TXT':
      default:
        return TxtImporter.parseFile(file);
    }
  }
}
