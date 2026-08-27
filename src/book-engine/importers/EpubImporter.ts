import { ParsedBookDraft, NormalizedChapter, ImportDiagnostics } from '../types';
import { ZipReader } from './ZipReader';
import { TextCleaner } from '../cleaner/TextCleaner';
import { ChapterDetector } from '../chapter-detector/ChapterDetector';
import { TxtImporter } from './TxtImporter';

export class EpubImporter {
  private static decodeText(bytes: Uint8Array): string {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return new TextDecoder('latin1').decode(bytes);
    }
  }

  /**
   * Convert Uint8Array image bytes into a base64 Data URL
   */
  public static bytesToDataUrl(bytes: Uint8Array, filename: string): string {
    let mime = 'image/jpeg';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'svg') mime = 'image/svg+xml';

    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
    return `data:${mime};base64,${base64}`;
  }

  /**
   * Extract Cover Image bytes from EPUB and convert to Base64 Data URL
   */
  public static extractCoverDataUrl(
    files: Record<string, Uint8Array>,
    opfDoc: Document | null,
    opfDir: string
  ): string | undefined {
    let coverHref = '';

    if (opfDoc) {
      // 1. Check EPUB 3 manifest property: properties="cover-image"
      const ep3Cover = opfDoc.querySelector('manifest > item[properties*="cover-image"]');
      if (ep3Cover) {
        coverHref = ep3Cover.getAttribute('href') || '';
      }

      // 2. Check EPUB 2 <meta name="cover" content="<item-id>"/>
      if (!coverHref) {
        const metaCover = opfDoc.querySelector('meta[name="cover"], meta[name="Cover"]');
        if (metaCover) {
          const coverId = metaCover.getAttribute('content');
          if (coverId) {
            const itemEl = opfDoc.querySelector(`manifest > item[id="${coverId}"]`);
            if (itemEl) {
              coverHref = itemEl.getAttribute('href') || '';
            }
          }
        }
      }

      // 3. Check manifest items with id containing "cover" or href containing "cover"
      if (!coverHref) {
        const manifestItems = opfDoc.querySelectorAll('manifest > item');
        for (const item of manifestItems) {
          const id = (item.getAttribute('id') || '').toLowerCase();
          const href = item.getAttribute('href') || '';
          const mediaType = (item.getAttribute('media-type') || '').toLowerCase();

          if (mediaType.startsWith('image/')) {
            if (id.includes('cover') || /(?:^|\/)cover[-_.]/i.test(href) || /cover\.(?:jpe?g|png|webp|gif)/i.test(href)) {
              coverHref = href;
              break;
            }
          }
        }
      }
    }

    if (coverHref) {
      const fullPath = (opfDir + coverHref).replace(/^\//, '');
      const matchingKey = Object.keys(files).find(k => 
        k === fullPath || 
        k.endsWith(coverHref) || 
        k.endsWith(coverHref.replace(/^\.\.\//, ''))
      );

      if (matchingKey && files[matchingKey]) {
        return this.bytesToDataUrl(files[matchingKey], matchingKey);
      }
    }

    // 4. Fallback search across all files in zip archive
    const keys = Object.keys(files);
    const coverKey = keys.find(k => /(?:^|\/)cover\.(?:jpe?g|png|webp|gif)$/i.test(k))
      || keys.find(k => /(?:^|\/)images?\/.*cover.*\.(?:jpe?g|png|webp|gif)$/i.test(k))
      || keys.find(k => /cover.*\.(?:jpe?g|png|webp|gif)$/i.test(k))
      || keys.find(k => /(?:^|\/)cover[-_0-9]*\.(?:jpe?g|png|webp|gif)$/i.test(k));

    if (coverKey && files[coverKey]) {
      return this.bytesToDataUrl(files[coverKey], coverKey);
    }

    return undefined;
  }

  /**
   * Check if a title string represents a special introductory, prologue, or extra section
   */
  public static isSpecialTitle(t: string): boolean {
    if (!t) return false;
    const low = t.toLowerCase().trim();
    return /^(?:giới thiệu|văn án|tóm tắt|lời mở đầu|lời tựa|lời bạt|lời tác giả|thông tin tác phẩm|thông tin truyện|ngoại truyện|phiên ngoại|prologue|epilogue|vĩ thanh|tiền truyện|preface|synopsis|tiết tử|mở đầu|kết cục|kết thúc)/i.test(low);
  }

  /**
   * Format Chapter Title cleanly without forcing "Chương N:" onto special sections like "Giới thiệu" or "Văn án"
   */
  public static formatChapterTitle(rawTitle: string, fallbackIndex: number): string {
    const tr = rawTitle.trim();
    if (!tr) return `Chương ${fallbackIndex}`;

    // 1. If it's a special section (Giới thiệu, Văn án, Lời mở đầu, Ngoại truyện...): DO NOT prepend "Chương N:"!
    if (this.isSpecialTitle(tr)) {
      return tr;
    }

    // 2. If it already starts with a chapter keyword (Chương, Chapter, Hồi, Tiết, Quyển, Phần...): Keep as is
    if (
      /^(?:chương|ch\u01b0\u01a1ng|CH\u01af\u01a0NG|chapter|CHAPTER|hồi|h\u1ed3i|tiết|ti\u1ebft|quyển|quy\u1ec3n|phần|ph\u1ea7n|vol|volume|第)/i.test(tr)
    ) {
      return tr;
    }

    // 3. If it starts with numeric format like "1: Cánh cửa", "01. Cánh cửa", "1 - Cánh cửa"
    const numMatch = tr.match(/^(\d{1,4})\s*[:\.\-–—]\s*(.*)$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      const rest = numMatch[2]?.trim();
      return rest ? `Chương ${num}: ${rest}` : `Chương ${num}`;
    }

    // 4. If it's a plain descriptive title (e.g. "Cánh cửa"), keep as is
    return tr;
  }

  /**
   * Parse XML string safely using DOMParser
   */
  private static parseXML(xmlString: string): Document | null {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (!parseError) return doc;
      } catch {
        // Fall through
      }
    }
    return null;
  }

  /**
   * Extract readable text paragraphs and title from HTML/XHTML string
   */
  private static extractParagraphsFromHtml(htmlString: string): { title: string; text: string; paragraphs: string[]; isTocPage: boolean } {
    let title = '';
    let paragraphs: string[] = [];
    let isTocPage = false;

    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        // Extract title from body heading tags first (h1, h2, h3, .chapter-title), fallback to <title>
        const bodyHeading = doc.querySelector('h1, h2, h3, h4, .chapter-title, .chap-title, .title');
        if (bodyHeading && bodyHeading.textContent) {
          title = bodyHeading.textContent.trim();
        } else {
          const docTitleEl = doc.querySelector('title');
          if (docTitleEl && docTitleEl.textContent) {
            title = docTitleEl.textContent.trim();
          }
        }

        // Check if page is an explicit TOC / Nav element
        const navEl = doc.querySelector('nav, [epub\\:type="toc"], [role="doc-toc"], .toc, #toc, .table-of-contents');
        const totalLinks = doc.querySelectorAll('a').length;
        const totalListItems = doc.querySelectorAll('li').length;

        // Remove script and style tags
        doc.querySelectorAll('script, style, noscript, svg').forEach(el => el.remove());

        // Extract paragraphs
        const pElements = doc.querySelectorAll('p, div, blockquote, li');
        if (pElements.length > 0) {
          pElements.forEach(p => {
            const txt = TextCleaner.clean(p.textContent || '');
            if (txt.length > 0 && !TextCleaner.isDecorativeDivider(txt)) {
              paragraphs.push(txt);
            }
          });
        }

        if (paragraphs.length === 0 && doc.body) {
          const bodyText = TextCleaner.clean(doc.body.textContent || '');
          paragraphs = TextCleaner.toParagraphs(bodyText);
        }

        const combinedText = paragraphs.join('\n\n');
        const totalWords = ChapterDetector.countWords(combinedText);
        const avgWordsPerParagraph = paragraphs.length > 0 ? totalWords / paragraphs.length : 0;

        // Heuristic detection: A page is a TOC if:
        // 1. Explicit nav/toc element with many links, OR
        // 2. Contains >= 5 paragraphs/list-items with average word count < 18 words and high link density, OR
        // 3. Contains many "Chương" or numbered items (e.g. "1. Giới thiệu", "2. Chương 1") with tiny total body words
        if (navEl && totalLinks >= 3) {
          isTocPage = true;
        } else if ((totalLinks >= 5 || totalListItems >= 5) && avgWordsPerParagraph < 18) {
          isTocPage = true;
        } else if (paragraphs.length >= 6 && avgWordsPerParagraph < 12) {
          const chapMatches = combinedText.match(/(?:chương|chapter)\s+\d+/gi) || [];
          const listMatches = combinedText.match(/^\s*\d+[\.\-\)]\s+/gm) || [];
          if (chapMatches.length >= 4 || listMatches.length >= 4) {
            isTocPage = true;
          }
        }

        return { title, text: combinedText, paragraphs, isTocPage };
      } catch {
        // Fallback to regex
      }
    }

    // Fallback HTML stripping
    const stripped = htmlString
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const cleaned = TextCleaner.clean(stripped);
    const fallbackParas = TextCleaner.toParagraphs(cleaned);
    const totalWords = ChapterDetector.countWords(cleaned);
    const avgWords = fallbackParas.length > 0 ? totalWords / fallbackParas.length : 0;

    const chapMatches = cleaned.match(/(?:chương|chapter)\s+\d+/gi) || [];
    const listMatches = cleaned.match(/^\s*\d+[\.\-\)]\s+/gm) || [];
    if (fallbackParas.length >= 5 && avgWords < 12 && (chapMatches.length >= 4 || listMatches.length >= 4)) {
      isTocPage = true;
    }

    return {
      title,
      text: cleaned,
      paragraphs: fallbackParas,
      isTocPage,
    };
  }

  public static async parseFile(file: File): Promise<ParsedBookDraft> {
    const arrayBuffer = await file.arrayBuffer();
    const files = await ZipReader.unzip(arrayBuffer);
    const warnings: string[] = [];

    let title = TxtImporter.cleanFileNameToTitle(file.name);
    let author = 'Chưa rõ tác giả';

    // 1. Locate container.xml -> find OPF full-path
    let opfPath = '';
    const containerEntry = files['META-INF/container.xml'];
    if (containerEntry) {
      const containerXml = this.decodeText(containerEntry);
      const doc = this.parseXML(containerXml);
      if (doc) {
        const rootfile = doc.querySelector('rootfile');
        if (rootfile) {
          opfPath = rootfile.getAttribute('full-path') || '';
        }
      } else {
        const match = containerXml.match(/full-path=["']([^"']+\.opf)["']/i);
        if (match) opfPath = match[1];
      }
    }

    if (!opfPath) {
      const opfKey = Object.keys(files).find(k => k.endsWith('.opf'));
      if (opfKey) opfPath = opfKey;
    }

    const htmlChapters: { title: string; paragraphs: string[]; text: string; volumeTitle?: string }[] = [];
    let opfDoc: Document | null = null;
    let opfDir = '';

    if (opfPath && files[opfPath]) {
      opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
      const opfXml = this.decodeText(files[opfPath]);
      opfDoc = this.parseXML(opfXml);

      if (opfDoc) {
        // Metadata title & creator
        const titleEl = opfDoc.querySelector('title, dc\\:title');
        if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        }

        const creatorEl = opfDoc.querySelector('creator, dc\\:creator');
        if (creatorEl && creatorEl.textContent) {
          author = creatorEl.textContent.trim();
        }

        // Manifest items (id -> { href, properties, id })
        const manifestMap = new Map<string, { href: string; properties: string; id: string }>();
        opfDoc.querySelectorAll('manifest > item').forEach(item => {
          const id = item.getAttribute('id') || '';
          const href = item.getAttribute('href') || '';
          const properties = item.getAttribute('properties') || '';
          if (id && href) manifestMap.set(id, { href, properties, id });
        });

        // Spine items in reading order
        const spineHrefList: { href: string; isExplicitToc: boolean }[] = [];
        opfDoc.querySelectorAll('spine > itemref').forEach(itemref => {
          const idref = itemref.getAttribute('idref');
          if (idref && manifestMap.has(idref)) {
            const itemInfo = manifestMap.get(idref)!;
            const isExplicitToc = 
              itemInfo.properties.includes('nav') ||
              itemInfo.id.toLowerCase().includes('toc') ||
              itemInfo.id.toLowerCase().includes('ncx') ||
              itemInfo.id.toLowerCase().includes('nav') ||
              /(?:toc|nav|mulu|table-of-contents|contents|index)\.(?:x?html|htm|xml)$/i.test(itemInfo.href);

            spineHrefList.push({ href: itemInfo.href, isExplicitToc });
          }
        });

        // Read and extract chapters from spine documents
        for (const { href, isExplicitToc } of spineHrefList) {
          // If manifest explicitly declared this item as TOC/nav -> skip it!
          if (isExplicitToc) {
            continue;
          }

          // Resolve path relative to OPF dir
          const fullPath = (opfDir + href).replace(/^\//, '');
          const matchingKey = Object.keys(files).find(k => k === fullPath || k.endsWith(href));

          if (matchingKey && files[matchingKey]) {
            const rawHtml = this.decodeText(files[matchingKey]);
            const { title: docTitle, text, paragraphs, isTocPage } = this.extractParagraphsFromHtml(rawHtml);

            // Skip empty documents or TOC / Index pages
            if (isTocPage || paragraphs.length === 0 || text.trim().length < 20) {
              continue;
            }

            // Check if this single HTML document contains multiple chapters
            const internalDetection = ChapterDetector.detect(text);
            const avgWordsInInternal = internalDetection.totalChapters > 0 
              ? internalDetection.totalWords / internalDetection.totalChapters 
              : 0;

            // If internal detection found multiple chapters with SUBSTANTIAL body (> 40 words each)
            if (internalDetection.hasDetectedChapters && internalDetection.totalChapters > 1 && avgWordsInInternal >= 40) {
              for (const subChap of internalDetection.chapters) {
                htmlChapters.push({
                  title: subChap.title,
                  paragraphs: TextCleaner.toParagraphs(subChap.body),
                  text: subChap.body,
                  volumeTitle: subChap.volumeTitle,
                });
              }
            } else {
              const chapterTitle = docTitle || `Chương ${htmlChapters.length + 1}`;
              htmlChapters.push({
                title: chapterTitle,
                paragraphs,
                text,
              });
            }
          }
        }
      }
    }

    // Extract embedded cover image
    const coverUrl = this.extractCoverDataUrl(files, opfDoc, opfDir);

    // If chapters were successfully partitioned from EPUB structure
    if (htmlChapters.length > 0) {
      let totalWords = 0;
      const chapters: NormalizedChapter[] = htmlChapters.map((c, idx) => {
        const wordCount = ChapterDetector.countWords(c.text) + ChapterDetector.countWords(c.title);
        totalWords += wordCount;

        const formattedTitle = this.formatChapterTitle(c.title, idx + 1);
        const isSpecial = this.isSpecialTitle(formattedTitle);

        return {
          id: `chap-${idx + 1}`,
          bookId: '',
          index: idx + 1,
          title: formattedTitle,
          paragraphs: c.paragraphs,
          wordCount,
          volumeTitle: c.volumeTitle,
          specialType: isSpecial ? 'preface' : undefined,
        };
      });

      const firstChaptersPreview = chapters.slice(0, 3).map(c => `${c.index}. ${c.title}`);
      const lastChaptersPreview = chapters.slice(-3).map(c => `${c.index}. ${c.title}`);

      const diagnostics: ImportDiagnostics = {
        format: 'EPUB',
        fileSize: file.size,
        decodedEncoding: 'UTF-8 XML (DOMParser)',
        rawCharacters: totalWords * 5,
        cleanedCharacters: totalWords * 5,
        detectedHeadingCount: chapters.length,
        candidateCount: chapters.length,
        acceptedCount: chapters.length,
        rejectedCount: 0,
        chapterCount: chapters.length,
        detectionStrategy: 'EPUB Spine & DOMParser Extraction',
        confidence: 'HIGH',
        score: 90,
        anomalies: [],
        warnings,
        errors: [],
        firstChaptersPreview,
        lastChaptersPreview,
      };

      return {
        title,
        author,
        originalFileName: file.name,
        fileFormat: 'EPUB',
        fileSizeMB: Number((file.size / (1024 * 1024)).toFixed(2)) || 0.1,
        totalChapters: chapters.length,
        wordCount: totalWords,
        chapters,
        hasDetectedChapters: true,
        confidence: 'HIGH',
        detectionStrategy: 'EPUB Spine & DOMParser Extraction',
        diagnostics,
        rawBlob: arrayBuffer,
        suggestedCoverColor: '#8C7AB3',
        coverUrl,
      };
    }

    // Fallback: Combine and detect
    const fallbackText = Object.keys(files)
      .filter(k => k.endsWith('.html') || k.endsWith('.xhtml') || k.endsWith('.htm'))
      .map(k => this.extractParagraphsFromHtml(this.decodeText(files[k])).text)
      .join('\n\n');

    const detection = ChapterDetector.detect(fallbackText, 'Chương 1');
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
      format: 'EPUB',
      fileSize: file.size,
      decodedEncoding: 'UTF-8 XML Fallback',
      rawCharacters: fallbackText.length,
      cleanedCharacters: fallbackText.length,
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
      fileFormat: 'EPUB',
      fileSizeMB: Number((file.size / (1024 * 1024)).toFixed(2)) || 0.1,
      totalChapters: chapters.length,
      wordCount: detection.totalWords,
      chapters,
      hasDetectedChapters: detection.hasDetectedChapters,
      confidence: detection.confidence,
      detectionStrategy: detection.strategy,
      diagnostics,
      rawBlob: arrayBuffer,
      suggestedCoverColor: '#8C7AB3',
      coverUrl,
    };
  }
}
