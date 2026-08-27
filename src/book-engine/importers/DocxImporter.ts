import { ParsedBookDraft, NormalizedChapter, ImportDiagnostics } from '../types';
import { ZipReader } from './ZipReader';
import { TextCleaner } from '../cleaner/TextCleaner';
import { ChapterDetector } from '../chapter-detector/ChapterDetector';
import { TxtImporter } from './TxtImporter';
import { EpubImporter } from './EpubImporter';

export class DocxImporter {
  public static async parseFile(file: File): Promise<ParsedBookDraft> {
    const arrayBuffer = await file.arrayBuffer();
    const files = await ZipReader.unzip(arrayBuffer);
    const warnings: string[] = [];

    let title = TxtImporter.cleanFileNameToTitle(file.name);
    let author = 'Chưa rõ tác giả';

    const documentXmlEntry = files['word/document.xml'];
    const paragraphs: string[] = [];

    if (documentXmlEntry) {
      const xmlString = new TextDecoder('utf-8').decode(documentXmlEntry);

      if (typeof DOMParser !== 'undefined') {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xmlString, 'application/xml');
          const pNodes = doc.querySelectorAll('p, w\\:p');

          pNodes.forEach(p => {
            const tNodes = p.querySelectorAll('t, w\\:t');
            let pText = '';
            tNodes.forEach(t => {
              pText += t.textContent || '';
            });

            const cleanedLine = TextCleaner.clean(pText);
            if (cleanedLine.length > 0) {
              paragraphs.push(cleanedLine);
            }
          });
        } catch {
          // Fallback to regex
        }
      }

      if (paragraphs.length === 0) {
        const pMatches = xmlString.match(/<w:p\b[^>]*>(.*?)<\/w:p>/gi) || [];
        for (const pXml of pMatches) {
          const tMatches = pXml.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/gi) || [];
          const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
          const cleaned = TextCleaner.clean(text);
          if (cleaned.length > 0) {
            paragraphs.push(cleaned);
          }
        }
      }
    }

    // Extract cover image from word/media/
    let coverUrl: string | undefined = undefined;
    const mediaKeys = Object.keys(files).filter(k => 
      k.startsWith('word/media/') && /\.(?:jpe?g|png|webp|gif)$/i.test(k)
    );
    if (mediaKeys.length > 0) {
      const coverKey = mediaKeys.find(k => k.includes('image1.')) || mediaKeys[0];
      if (files[coverKey]) {
        coverUrl = EpubImporter.bytesToDataUrl(files[coverKey], coverKey);
      }
    }

    const combinedText = paragraphs.join('\n\n');
    const detection = ChapterDetector.detect(combinedText, 'Chương 1: Toàn văn');

    const chapters: NormalizedChapter[] = detection.chapters.map(c => ({
      id: `chap-${c.index}`,
      bookId: '',
      index: c.index,
      title: c.title,
      paragraphs: TextCleaner.toParagraphs(c.body),
      wordCount: c.wordCount,
      volumeTitle: c.volumeTitle,
      specialType: c.specialType,
    }));

    const diagnostics: ImportDiagnostics = {
      format: 'DOCX',
      fileSize: file.size,
      decodedEncoding: 'Word XML (DOMParser)',
      rawCharacters: combinedText.length,
      cleanedCharacters: combinedText.length,
      detectedHeadingCount: detection.hasDetectedChapters ? detection.totalChapters : 0,
      candidateCount: detection.candidateCount,
      acceptedCount: detection.acceptedCount,
      rejectedCount: detection.rejectedCount,
      chapterCount: chapters.length,
      detectionStrategy: detection.strategy,
      confidence: detection.confidence,
      score: detection.score,
      anomalies: detection.anomalies,
      warnings: [...warnings, ...detection.warnings],
      errors: [],
      firstChaptersPreview: detection.firstChaptersPreview,
      lastChaptersPreview: detection.lastChaptersPreview,
    };

    return {
      title,
      author,
      originalFileName: file.name,
      fileFormat: 'DOCX',
      fileSizeMB: Number((file.size / (1024 * 1024)).toFixed(2)) || 0.1,
      totalChapters: chapters.length,
      wordCount: detection.totalWords,
      chapters,
      hasDetectedChapters: detection.hasDetectedChapters,
      confidence: detection.confidence,
      detectionStrategy: detection.strategy,
      diagnostics,
      rawBlob: arrayBuffer,
      suggestedCoverColor: '#D19A66',
      coverUrl,
    };
  }
}
