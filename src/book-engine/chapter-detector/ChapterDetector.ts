import { DetectionConfidence, ImportDiagnostics } from '../types';
import { TextCleaner } from '../cleaner/TextCleaner';

export type HeadingType =
  | 'chapter'
  | 'chapter_word'
  | 'numeric'
  | 'chinese_chapter'
  | 'english_chapter'
  | 'volume'
  | 'part'
  | 'section'
  | 'special'
  | 'unknown';

export interface HeadingCandidate {
  rawLine: string;
  trimmedLine: string;
  lineIndex: number;
  type: HeadingType;
  number: number | null;
  volumeNumber?: number | null;
  titleSuffix: string;
  charOffset: number;
}

export interface DetectedChapterRaw {
  index: number;
  title: string;
  body: string;
  wordCount: number;
  volumeTitle?: string;
  specialType?: 'prologue' | 'epilogue' | 'side_story' | 'preface' | 'special';
}

export interface ChapterDetectionResult {
  chapters: DetectedChapterRaw[];
  hasDetectedChapters: boolean;
  totalChapters: number;
  totalWords: number;
  confidence: DetectionConfidence;
  strategy: string;
  score: number;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  anomalies: string[];
  warnings: string[];
  firstChaptersPreview: string[];
  lastChaptersPreview: string[];
}

export class ChapterDetector {
  /**
   * Parse Vietnamese words into integer (e.g., "Một" -> 1, "Mười lăm" -> 15, "Hai mươi mốt" -> 21)
   */
  public static parseVietnameseWordNumber(text: string): number | null {
    if (!text) return null;
    let clean = text.toLowerCase().trim();
    clean = clean.replace(/^(?:thứ|thu)\s+/, '');

    const units: Record<string, number> = {
      'không': 0, 'nhất': 1, 'một': 1, 'mốt': 1,
      'nhị': 2, 'hai': 2,
      'tam': 3, 'ba': 3,
      'tứ': 4, 'bốn': 4, 'tư': 4,
      'ngũ': 5, 'năm': 5, 'lăm': 5,
      'lục': 6, 'sáu': 6,
      'thất': 7, 'bảy': 7, 'bẩy': 7,
      'bát': 8, 'tám': 8,
      'cửu': 9, 'chín': 9,
      'mười': 10, 'chục': 10,
      'trăm': 100,
      'nghìn': 1000, 'ngàn': 1000,
    };

    // Roman numeral check
    const romanMatch = clean.match(/^(?:m{0,4}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3}))$/i);
    if (romanMatch && romanMatch[0].length > 0) {
      const romanVal = this.parseRomanNumeral(romanMatch[0].toUpperCase());
      if (romanVal > 0) return romanVal;
    }

    if (units[clean] !== undefined) {
      return units[clean];
    }

    // Compound numbers: "hai mươi mốt", "mười lăm", "một trăm hai mươi"
    const words = clean.split(/\s+/);
    let total = 0;
    let current = 0;

    for (const w of words) {
      if (w === 'mươi' || w === 'chục') {
        current = (current === 0 ? 1 : current) * 10;
      } else if (w === 'trăm') {
        current = (current === 0 ? 1 : current) * 100;
      } else if (w === 'mười') {
        if (current === 0) current = 10;
        else current += 10;
      } else if (units[w] !== undefined) {
        current += units[w];
      }
    }
    total += current;

    return total > 0 ? total : null;
  }

  /**
   * Parse Roman Numerals to integer
   */
  public static parseRomanNumeral(roman: string): number {
    const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let num = 0;
    for (let i = 0; i < roman.length; i++) {
      const curr = map[roman[i]] || 0;
      const next = map[roman[i + 1]] || 0;
      if (curr < next) {
        num -= curr;
      } else {
        num += curr;
      }
    }
    return num;
  }

  /**
   * Count words in a string (Vietnamese, Unicode & CJK compatible)
   */
  public static countWords(text: string): number {
    if (!text) return 0;
    const latinWords = text.trim().match(/[\w\u00C0-\u024F\u1EA0-\u1EF9]+/g) || [];
    const cjkChars = text.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || [];
    return latinWords.length + cjkChars.length;
  }

  /**
   * Check if a single line is a recognized heading candidate
   */
  public static isChapterHeading(line: string): boolean {
    return this.classifyCandidate(line, 0, 0) !== null;
  }

  /**
   * Stage 1: Classify a candidate line into a structural HeadingCandidate
   */
  public static classifyCandidate(line: string, lineIndex: number, charOffset: number): HeadingCandidate | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) return null;

    // Reject footer notes / chapter ending notes like "Hết chương 1", "Kết thúc chương", "--- Hết ---"
    if (/^(?:hết|kết thúc|đã hết|hết quyển|toàn văn hoàn|hoàn)\s+(?:chương|hồi|tiết|phần|quyển)/i.test(trimmed)) {
      return null;
    }
    if (/^[\[\(【]?[-–—\s]*(?:hết|kết thúc|hoàn|toàn văn hoàn)[-–—\s]*[\]\)】]?$/i.test(trimmed)) {
      return null;
    }

    // Filter out obvious prose sentences falsely starting with a heading keyword
    if (/^(?:trong|vào|ở|khi|tại|theo|như|với|từ)\s+(?:chương|hồi|tiết|phần|quyển)/i.test(trimmed)) {
      return null;
    }

    // Must not end with continuation punctuation like comma or semicolon
    if (/[,;]$/.test(trimmed)) {
      return null;
    }

    // 1. Special Chapter Marker (Giới thiệu, Văn án, Tóm tắt, Lời mở đầu, Lời tựa, Prologue, Epilogue, Ngoại truyện, Phiên ngoại...)
    const specialMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(giới thiệu|văn án|tóm tắt|lời mở đầu|lời bạt|lời tựa|lời tác giả|thông tin tác phẩm|thông tin truyện|ngoại truyện|phiên ngoại|prologue|epilogue|vĩ thanh|tiền truyện|preface|synopsis)(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (specialMatch) {
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'special',
        number: null,
        titleSuffix: specialMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 2. Volume / Quyển Marker (e.g., "Quyển 1: Tên", "Volume 1", "QUYỂN THỨ NHẤT")
    const volumeMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:quyển|quy\u1ec3n|QUY\u1ec2N|Quyển|volume|vol|卷)[ \t]+(?:thứ[ \t]+)?(\d+|[IVXLCDM]+|[mnhbtscv\u0111\u00e0-\u1ef9\s]{1,20})(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (volumeMatch && !/chương/i.test(trimmed)) {
      const rawNum = volumeMatch[1].trim();
      const num = /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : this.parseVietnameseWordNumber(rawNum);
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'volume',
        number: num,
        titleSuffix: volumeMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 3. Quyển X Chương Y combined (e.g. "Quyển 1 Chương 2: Tiếng đàn")
    const volChapMatch = trimmed.match(/^[ \t]*(?:quyển|quy\u1ec3n|Quyển)[ \t]+(\d+|[IVXLCDM]+)[ \t]+(?:chương|ch\u01b0\u01a1ng|Chương)[ \t]+(\d+)(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (volChapMatch) {
      const volNum = /^\d+$/.test(volChapMatch[1]) ? parseInt(volChapMatch[1], 10) : this.parseRomanNumeral(volChapMatch[1]);
      const chapNum = parseInt(volChapMatch[2], 10);
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'chapter',
        number: chapNum,
        volumeNumber: volNum,
        titleSuffix: volChapMatch[3]?.trim() || '',
        charOffset,
      };
    }

    // 4. Standard Vietnamese Chapter with Digits: "Chương 1", "Chương 001: Trở về", "[Chương 1]", "CHƯƠNG 1 - ..."
    const stdChapMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:chương|ch\u01b0\u01a1ng|CH\u01af\u01a0NG|Chương)[ \t]+(?:số[ \t]+)?(?:thứ[ \t]+)?(\d+)(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (stdChapMatch) {
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'chapter',
        number: parseInt(stdChapMatch[1], 10),
        titleSuffix: stdChapMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 5. Vietnamese Word Numbers: "Chương Một", "Chương Thứ Nhất", "Chương Mười Lăm"
    const wordChapMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:chương|ch\u01b0\u01a1ng|CH\u01af\u01a0NG|Chương)[ \t]+(?:thứ[ \t]+)?([mnhbtscv\u0111\u00e0-\u1ef9\s]{1,30})(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (wordChapMatch) {
      const wordPart = wordChapMatch[1].trim();
      const parsedNum = this.parseVietnameseWordNumber(wordPart);
      if (parsedNum !== null) {
        return {
          rawLine: line,
          trimmedLine: trimmed,
          lineIndex,
          type: 'chapter_word',
          number: parsedNum,
          titleSuffix: wordChapMatch[2]?.trim() || '',
          charOffset,
        };
      }
    }

    // 6. Chinese Webnovel Chapter: "第1章", "第001章", "第1回", "第1节"
    const cnChapMatch = trimmed.match(/^[ \t]*第[ \t]*(\d+)[ \t]*[章回节](?:[ \t]*(.*))?$/i);
    if (cnChapMatch) {
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'chinese_chapter',
        number: parseInt(cnChapMatch[1], 10),
        titleSuffix: cnChapMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 7. English Chapter: "Chapter 1", "CHAPTER 001: Title", "Chapter 1 - Title"
    const enChapMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:chapter|CHAPTER|Chapter)[ \t]+(\d+)(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (enChapMatch) {
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'english_chapter',
        number: parseInt(enChapMatch[1], 10),
        titleSuffix: enChapMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 8. Section Markers: "Hồi 1", "Hồi thứ nhất", "Tiết 1"
    const secMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:hồi|h\u1ed3i|H\u1ed2I|Hồi|tiết|ti\u1ebft|TI\u1ebeT|Tiết)[ \t]+(?:thứ[ \t]+)?(\d+|[mnhbtscv\u0111\u00e0-\u1ef9]{1,20})(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (secMatch) {
      const raw = secMatch[1].trim();
      const num = /^\d+$/.test(raw) ? parseInt(raw, 10) : this.parseVietnameseWordNumber(raw);
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'section',
        number: num,
        titleSuffix: secMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 9. Part Markers: "Phần 1", "Phần thứ nhất", "Part 1"
    const partMatch = trimmed.match(/^[ \t]*(?:[\[【\(\《])?(?:phần|ph\u1ea7n|PH\u1ea6N|Phần|part|PART)[ \t]+(?:thứ[ \t]+)?(\d+|[IVXLCDM]+|[mnhbtscv\u0111\u00e0-\u1ef9]{1,20})(?:[\]】\)\》])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/i);
    if (partMatch) {
      const raw = partMatch[1].trim();
      const num = /^\d+$/.test(raw) ? parseInt(raw, 10) : this.parseVietnameseWordNumber(raw);
      return {
        rawLine: line,
        trimmedLine: trimmed,
        lineIndex,
        type: 'part',
        number: num,
        titleSuffix: partMatch[2]?.trim() || '',
        charOffset,
      };
    }

    // 10. Numeric-only candidate: "001", "001. Tên", "001 - Tên", "1. Tên"
    const numMatch = trimmed.match(/^[ \t]*(?:[\[【\(])?(\d{1,4})(?:[\]】\)])?(?:[ \t]*[:\.\-–—\s][ \t]*(.*))?$/);
    if (numMatch) {
      const numVal = parseInt(numMatch[1], 10);
      const isZeroPadded = numMatch[1].length >= 3 && numMatch[1].startsWith('0');
      const titleSuffix = numMatch[2]?.trim() || '';
      const hasTitle = Boolean(titleSuffix);

      // REJECT if title is actually a nested chapter marker in a TOC list (e.g. "2. Chương 1: Cánh cửa", "3. Chương 2")
      if (/^(?:chương|ch\u01b0\u01a1ng|CH\u01af\u01a0NG|chapter|hồi|tiết|phần|quyển)\s+(?:\d+|[IVXLCDM]+|[mnhbtscv\u0111\u00e0-\u1ef9]{1,20})/i.test(titleSuffix)) {
        return null;
      }

      if (isZeroPadded || hasTitle || numMatch[1].length >= 3) {
        return {
          rawLine: line,
          trimmedLine: trimmed,
          lineIndex,
          type: 'numeric',
          number: numVal,
          titleSuffix,
          charOffset,
        };
      }
    }

    return null;
  }

  /**
   * Filter Table of Contents (TOC) blocks and Merge Double-line Headings
   */
  public static filterTOCAndDoubleHeadings(candidates: HeadingCandidate[], lines: string[]): HeadingCandidate[] {
    if (candidates.length <= 1) return candidates;

    // PASS 1: Merge consecutive duplicate headings
    const merged: HeadingCandidate[] = [];
    let i = 0;
    while (i < candidates.length) {
      const curr = candidates[i];
      const next = i < candidates.length - 1 ? candidates[i + 1] : null;

      if (next && curr.number !== null && next.number === curr.number && next.lineIndex - curr.lineIndex <= 4) {
        const chosen = next.titleSuffix.length >= curr.titleSuffix.length ? next : curr;
        merged.push({
          ...chosen,
          lineIndex: next.lineIndex,
        });
        i += 2;
      } else {
        merged.push(curr);
        i += 1;
      }
    }

    if (merged.length <= 3) return merged;

    // PASS 2: Explicit TOC Header detection
    let explicitTocLine = -1;
    for (let l = 0; l < Math.min(lines.length, 120); l++) {
      const tr = lines[l].trim();
      if (/^(?:\[|\(|【|\*)?\s*(?:mục\s+lục|muc\s+luc|table\s+of\s+contents|contents|danh\s+sách\s+chương|phân\s+chương|phân\s+quyển|index)\s*(?:\]|\)|】|\*|:)?$/i.test(tr)) {
        explicitTocLine = l;
        break;
      }
    }

    // Calculate word counts between consecutive candidates
    const candidateSpacings: { index: number; wordCount: number; lineDiff: number }[] = [];
    for (let j = 0; j < merged.length; j++) {
      const start = merged[j].lineIndex + 1;
      const end = j < merged.length - 1 ? merged[j + 1].lineIndex : lines.length;
      const words = this.countWords(lines.slice(start, end).join('\n'));
      const lineDiff = j < merged.length - 1 ? merged[j + 1].lineIndex - merged[j].lineIndex : 100;
      candidateSpacings.push({ index: j, wordCount: words, lineDiff });
    }

    let tocCutoffIndex = -1;

    // Approach A: If explicit TOC header was found
    if (explicitTocLine >= 0) {
      const firstCandAfterToc = merged.findIndex(c => c.lineIndex > explicitTocLine);
      if (firstCandAfterToc >= 0) {
        for (let k = firstCandAfterToc; k < merged.length - 1; k++) {
          const isNextReset = merged[k + 1].number !== null && merged[k + 1].number === 1 && merged[k].number !== null && merged[k].number! > 1;
          const isCurrentDense = candidateSpacings[k].wordCount < 45;
          const isNextSubstantial = candidateSpacings[k + 1].wordCount > 100;

          if (isNextReset || (!isCurrentDense && isNextSubstantial)) {
            tocCutoffIndex = k + 1;
            break;
          }
        }
      }
    }

    // Approach B: Implicit TOC block
    if (tocCutoffIndex < 0) {
      for (let k = 2; k < Math.min(merged.length - 1, 500); k++) {
        const current = merged[k];
        const next = merged[k + 1];

        if (current.number !== null && next.number !== null) {
          if (current.number >= 3 && next.number <= 2) {
            let denseCount = 0;
            for (let j = 0; j <= k; j++) {
              if (candidateSpacings[j].wordCount < 40 || candidateSpacings[j].lineDiff <= 5) {
                denseCount++;
              }
            }

            if (denseCount / (k + 1) >= 0.65) {
              tocCutoffIndex = k + 1;
              break;
            }
          }
        }
      }
    }

    // Approach C: Sequence Duplication Check
    if (tocCutoffIndex < 0) {
      const chapter1Indices = merged
        .map((c, idx) => ({ c, idx }))
        .filter(item => item.c.number === 1);

      if (chapter1Indices.length >= 2) {
        const firstIdx = chapter1Indices[0].idx;
        const secondIdx = chapter1Indices[1].idx;

        if (firstIdx === 0 && secondIdx > 2) {
          let totalWordsInFirstBlock = 0;
          for (let j = 0; j < secondIdx; j++) {
            totalWordsInFirstBlock += candidateSpacings[j].wordCount;
          }
          const avgWords = totalWordsInFirstBlock / secondIdx;

          if (avgWords < 35 && candidateSpacings[secondIdx].wordCount >= 50) {
            tocCutoffIndex = secondIdx;
          }
        }
      }
    }

    if (tocCutoffIndex > 0) {
      return merged.slice(tocCutoffIndex);
    }

    return merged;
  }

  /**
   * Stage 2 & 3: Multi-Pass Sequence Analysis and Strategy Scoring
   */
  private static evaluateStrategy(
    strategyName: string,
    rawCandidates: HeadingCandidate[],
    lines: string[],
    totalWords: number
  ): {
    score: number;
    accepted: HeadingCandidate[];
    rejected: HeadingCandidate[];
    monotonicRatio: number;
    strictSequenceRatio: number;
    avgWordsPerChapter: number;
    missingNumbers: number[];
    anomalies: string[];
  } {
    const anomalies: string[] = [];
    if (rawCandidates.length === 0) {
      return {
        score: 0,
        accepted: [],
        rejected: [],
        monotonicRatio: 0,
        strictSequenceRatio: 0,
        avgWordsPerChapter: 0,
        missingNumbers: [],
        anomalies: ['Không có candidate nào trong chiến lược.'],
      };
    }

    // Run TOC and double-line heading filter
    const candidates = this.filterTOCAndDoubleHeadings(rawCandidates, lines);

    // Sort by line index
    candidates.sort((a, b) => a.lineIndex - b.lineIndex);

    // Sequence continuity check
    let monotonicCount = 0;
    let strictCount = 0;
    let duplicates = 0;
    let reversals = 0;
    let prevNum: number | null = null;
    const missingNumbers: number[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (cand.number !== null) {
        if (prevNum !== null) {
          if (cand.number > prevNum) {
            monotonicCount++;
            if (cand.number === prevNum + 1) {
              strictCount++;
            } else if (cand.number > prevNum + 1 && cand.number <= prevNum + 10) {
              for (let missing = prevNum + 1; missing < cand.number; missing++) {
                if (missingNumbers.length < 10) missingNumbers.push(missing);
              }
            }
          } else if (cand.number === prevNum) {
            duplicates++;
          } else {
            reversals++;
          }
        }
        prevNum = cand.number;
      }
    }

    const pairCount = Math.max(1, candidates.filter(c => c.number !== null).length - 1);
    const monotonicRatio = monotonicCount / pairCount;
    const strictSequenceRatio = strictCount / pairCount;

    // Word spacing between candidates
    let totalSpacingWords = 0;
    for (let i = 0; i < candidates.length; i++) {
      const startLine = candidates[i].lineIndex + 1;
      const endLine = i < candidates.length - 1 ? candidates[i + 1].lineIndex : lines.length;
      const sliceText = lines.slice(startLine, endLine).join('\n');
      const words = this.countWords(sliceText);
      totalSpacingWords += words;
    }
    const avgWordsPerChapter = Math.round(totalSpacingWords / Math.max(1, candidates.length));

    // Calculate score
    let score = 0;

    if (strategyName === 'EXPLICIT_CHAPTER') {
      score += 45; // High base for explicit chapter headings
      score += Math.min(30, candidates.length * 1.5);
      score += monotonicRatio * 30;
      score += strictSequenceRatio * 20;
      if (avgWordsPerChapter < 10) score -= 40;
      if (duplicates > 5) score -= 15;
      if (reversals > 5) score -= 25;
    } else if (strategyName === 'NUMERIC_SEQUENCE') {
      if (candidates.length >= 3 && avgWordsPerChapter >= 15 && monotonicRatio >= 0.7) {
        score += 35;
        score += Math.min(25, candidates.length * 1.5);
        score += monotonicRatio * 30;
        score += strictSequenceRatio * 20;
      } else {
        score = 5;
      }
    } else if (strategyName === 'SECTION_BASED') {
      score += 25;
      score += Math.min(25, candidates.length);
      score += monotonicRatio * 25;
      if (avgWordsPerChapter < 10) score -= 30;
    }

    if (missingNumbers.length > 0) {
      anomalies.push(`Thiếu số chương trong chuỗi: ${missingNumbers.join(', ')}${missingNumbers.length >= 10 ? '...' : ''}`);
    }
    if (duplicates > 2) {
      anomalies.push(`Phát hiện ${duplicates} số chương bị trùng lặp.`);
    }

    return {
      score: Math.max(0, Math.round(score)),
      accepted: candidates,
      rejected: [],
      monotonicRatio,
      strictSequenceRatio,
      avgWordsPerChapter,
      missingNumbers,
      anomalies,
    };
  }

  /**
   * Main Structure Analyzer Entrypoint
   */
  public static detect(cleanedText: string, fallbackTitle: string = 'Chương 1'): ChapterDetectionResult {
    const warnings: string[] = [];
    const anomalies: string[] = [];

    if (!cleanedText || cleanedText.trim().length === 0) {
      return {
        chapters: [{
          index: 1,
          title: fallbackTitle,
          body: '',
          wordCount: 0,
        }],
        hasDetectedChapters: false,
        totalChapters: 1,
        totalWords: 0,
        confidence: 'LOW',
        strategy: 'Empty Text Fallback',
        score: 0,
        candidateCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        anomalies: ['Tệp rỗng không có nội dung.'],
        warnings: ['Tệp rỗng không có nội dung văn bản.'],
        firstChaptersPreview: [fallbackTitle],
        lastChaptersPreview: [fallbackTitle],
      };
    }

    const lines = cleanedText.split('\n');
    const totalWords = this.countWords(cleanedText);

    // STAGE 1: Extract all structural candidates
    const allCandidates: HeadingCandidate[] = [];
    let charOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cand = this.classifyCandidate(line, i, charOffset);
      if (cand) {
        allCandidates.push(cand);
      }
      charOffset += line.length + 1;
    }

    // Partition candidates into strategy pools
    const explicitChapters = allCandidates.filter(c => 
      c.type === 'chapter' || c.type === 'chapter_word' || c.type === 'chinese_chapter' || c.type === 'english_chapter'
    );
    const numericCandidates = allCandidates.filter(c => c.type === 'numeric');
    const sectionCandidates = allCandidates.filter(c => c.type === 'section' || c.type === 'part');
    const specialCandidates = allCandidates.filter(c => c.type === 'special');
    const volumeCandidates = allCandidates.filter(c => c.type === 'volume');

    // STAGE 2: Multi-Pass Sequence Evaluation
    const evalA = this.evaluateStrategy('EXPLICIT_CHAPTER', explicitChapters, lines, totalWords);
    const evalB = this.evaluateStrategy('NUMERIC_SEQUENCE', numericCandidates, lines, totalWords);
    const evalC = this.evaluateStrategy('SECTION_BASED', sectionCandidates, lines, totalWords);

    // STAGE 3: Select Dominant Strategy
    let dominantStrategy = 'NONE';
    let chosenCandidates: HeadingCandidate[] = [];
    let bestScore = 0;

    if (evalA.score >= 35 && evalA.score >= evalB.score && evalA.score >= evalC.score) {
      dominantStrategy = `Explicit Chapter Structure (${evalA.accepted.length} chương)`;
      bestScore = evalA.score;
      anomalies.push(...evalA.anomalies);

      const chapterLineIndices = new Set(evalA.accepted.map(c => c.lineIndex));
      const combined = [...evalA.accepted];

      // Attach special chapters (Giới thiệu, Văn án, Lời mở đầu, Ngoại truyện, Phiên ngoại, Prologue)
      for (const spec of specialCandidates) {
        if (!chapterLineIndices.has(spec.lineIndex)) {
          combined.push(spec);
        }
      }
      combined.sort((a, b) => a.lineIndex - b.lineIndex);
      chosenCandidates = combined;
    } else if (evalB.score >= 35 && evalB.score >= evalC.score) {
      dominantStrategy = `Numeric Sequence Structure (${evalB.accepted.length} mục)`;
      bestScore = evalB.score;
      chosenCandidates = evalB.accepted;
      anomalies.push(...evalB.anomalies);
    } else if (evalC.score >= 35) {
      dominantStrategy = `Section / Part Structure (${evalC.accepted.length} phần)`;
      bestScore = evalC.score;
      chosenCandidates = evalC.accepted;
      anomalies.push(...evalC.anomalies);
    }

    // FALLBACK: If no strategy was strong enough
    if (dominantStrategy === 'NONE' || chosenCandidates.length === 0) {
      warnings.push('Không nhận diện được cấu trúc chương chuẩn. Đã tạo 1 chương chứa toàn văn tác phẩm.');
      const allText = cleanedText.trim();
      const wCount = this.countWords(allText);

      return {
        chapters: [{
          index: 1,
          title: 'Chương 1: Toàn văn tác phẩm',
          body: allText,
          wordCount: wCount,
        }],
        hasDetectedChapters: false,
        totalChapters: 1,
        totalWords: wCount,
        confidence: 'LOW',
        strategy: 'Single Chapter Fallback',
        score: 10,
        candidateCount: allCandidates.length,
        acceptedCount: 1,
        rejectedCount: allCandidates.length,
        anomalies: ['Toàn bộ nội dung gom thành 1 chương'],
        warnings,
        firstChaptersPreview: ['Chương 1: Toàn văn tác phẩm'],
        lastChaptersPreview: ['Chương 1: Toàn văn tác phẩm'],
      };
    }

    // STAGE 4: Split chapters with volume hierarchy awareness
    const volumeMap = new Map<number, string>();
    let currentVol = '';
    for (const vol of volumeCandidates) {
      currentVol = vol.trimmedLine;
      volumeMap.set(vol.lineIndex, currentVol);
    }

    let activeVolume = '';
    const rawChapters: DetectedChapterRaw[] = [];

    for (let i = 0; i < chosenCandidates.length; i++) {
      const cand = chosenCandidates[i];
      const nextCand = i < chosenCandidates.length - 1 ? chosenCandidates[i + 1] : null;

      // Check if a volume header appeared before this chapter
      for (const [volLine, volTitle] of volumeMap.entries()) {
        if (volLine < cand.lineIndex && (i === 0 || volLine > chosenCandidates[i - 1].lineIndex)) {
          activeVolume = volTitle;
        }
      }

      // Format Chapter Title nicely:
      // Special chapters (Giới thiệu, Văn án, Prologue) KEEP their own title and NEVER get "Chương N" prepended!
      let formattedTitle = cand.trimmedLine;
      if (cand.type === 'numeric') {
        formattedTitle = cand.titleSuffix 
          ? `Chương ${cand.number}: ${cand.titleSuffix}` 
          : `Chương ${cand.number}`;
      }

      // Slice body lines
      const bodyStart = cand.lineIndex + 1;
      const bodyEnd = nextCand ? nextCand.lineIndex : lines.length;
      
      // Filter out volume header lines from body text
      const bodyLines = lines.slice(bodyStart, bodyEnd).filter(line => {
        const tr = line.trim();
        return !volumeCandidates.some(v => v.trimmedLine === tr);
      });

      const body = bodyLines.join('\n').trim();
      const wCount = this.countWords(body) + this.countWords(formattedTitle);

      let specialType: DetectedChapterRaw['specialType'];
      if (cand.type === 'special') {
        const low = cand.trimmedLine.toLowerCase();
        if (low.includes('giới thiệu') || low.includes('văn án') || low.includes('tóm tắt') || low.includes('thông tin') || low.includes('preface') || low.includes('synopsis')) {
          specialType = 'preface';
        } else if (low.includes('prologue') || low.includes('mở đầu') || low.includes('tựa')) {
          specialType = 'prologue';
        } else if (low.includes('epilogue') || low.includes('bạt') || low.includes('vĩ thanh')) {
          specialType = 'epilogue';
        } else {
          specialType = 'side_story';
        }
      }

      rawChapters.push({
        index: i + 1,
        title: formattedTitle,
        body,
        wordCount: wCount,
        volumeTitle: activeVolume || undefined,
        specialType,
      });
    }

    // STAGE 4B: Handle Preface/Intro text before the first candidate (e.g. Văn án/Giới thiệu not matching an explicit candidate line)
    if (chosenCandidates[0].lineIndex > 0) {
      const prefaceLines = lines.slice(0, chosenCandidates[0].lineIndex).filter(line => {
        const tr = line.trim();
        return tr.length > 0 && !volumeCandidates.some(v => v.trimmedLine === tr);
      });

      // Check if this leading block was actually a pruned Table of Contents (TOC)
      const chapLineCount = prefaceLines.filter(l => /(?:chương|chapter|hồi|tiết|phần)\s+\d+|^\s*\d+[\.\-\)]\s+/i.test(l.trim())).length;
      const isTocBlock = prefaceLines.length > 0 && (chapLineCount / prefaceLines.length) >= 0.3;

      if (!isTocBlock) {
        const prefaceText = prefaceLines.join('\n').trim();
        const prefaceWordCount = this.countWords(prefaceText);

        if (prefaceWordCount >= 10) {
          let introTitle = 'Giới thiệu tác phẩm';
          const firstLine = prefaceLines[0]?.trim();
          if (firstLine && firstLine.length <= 60 && !firstLine.includes('.') && /^(?:giới thiệu|văn án|tóm tắt|lời tựa|lời mở đầu|thông tin|lời tác giả)/i.test(firstLine)) {
            introTitle = firstLine;
          }

          rawChapters.unshift({
            index: 1,
            title: introTitle,
            body: prefaceText,
            wordCount: prefaceWordCount + this.countWords(introTitle),
            specialType: 'preface',
          });

          rawChapters.forEach((c, idx) => {
            c.index = idx + 1;
          });
        }
      }
    }

    // STAGE 5: Post-Split Validation & Confidence Determination
    let finalConfidence: DetectionConfidence = 'HIGH';
    if (bestScore >= 70 && rawChapters.length >= 3 && anomalies.length === 0) {
      finalConfidence = 'HIGH';
    } else if (bestScore >= 35 && rawChapters.length >= 2) {
      finalConfidence = 'MEDIUM';
    } else {
      finalConfidence = 'LOW';
      warnings.push('Cấu trúc chương có một số điểm chưa tối ưu. Bạn có thể kiểm tra trước khi lưu.');
    }

    // Generate previews for UI
    const firstChaptersPreview = rawChapters.slice(0, 3).map(c => `${c.index}. ${c.title}`);
    const lastChaptersPreview = rawChapters.slice(-3).map(c => `${c.index}. ${c.title}`);

    let totalWordsResult = 0;
    rawChapters.forEach(c => { totalWordsResult += c.wordCount; });

    return {
      chapters: rawChapters,
      hasDetectedChapters: true,
      totalChapters: rawChapters.length,
      totalWords: totalWordsResult,
      confidence: finalConfidence,
      strategy: dominantStrategy,
      score: bestScore,
      candidateCount: allCandidates.length,
      acceptedCount: chosenCandidates.length,
      rejectedCount: allCandidates.length - chosenCandidates.length,
      anomalies,
      warnings,
      firstChaptersPreview,
      lastChaptersPreview,
    };
  }
}
