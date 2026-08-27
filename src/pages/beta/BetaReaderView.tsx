import React, { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../../services/api';
import { Chapter } from '../../types';
import { BetaCloudBookSource } from '../../book-engine/source/BetaCloudBookSource';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  ShieldAlert, 
  Type, 
  Minus, 
  Plus,
  BookOpen
} from 'lucide-react';

interface BetaReaderViewProps {
  bookId: string;
  initialChapterIndex: number;
  onBackToBook: () => void;
}

export const BetaReaderView: React.FC<BetaReaderViewProps> = ({
  bookId,
  initialChapterIndex,
  onBackToBook,
}) => {
  const [chapterIndex, setChapterIndex] = useState(initialChapterIndex);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [totalChapters, setTotalChapters] = useState<number>(1);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Typography settings
  const [fontSize, setFontSize] = useState<number>(18);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load chapter content
  const loadChapter = async (targetIndex: number) => {
    setIsLoading(true);
    setForbiddenError(false);
    setErrorMessage(null);

    try {
      // 1. Fetch chapter
      const res = await api.get<{ chapter: Chapter }>(`/books/${bookId}/chapters/${targetIndex}`);
      setChapter(res.chapter);
      setChapterIndex(targetIndex);

      // 2. Fetch book metadata if not loaded yet
      if (!bookTitle) {
        const bookRes = await api.get<any>(`/books/${bookId}`);
        setBookTitle(bookRes.book?.title || '');
        setTotalChapters(bookRes.book?.totalChapters || 1);
      }

      // 3. Save progress
      const source = BetaCloudBookSource.getInstance();
      const percent = Math.round((targetIndex / (totalChapters || 1)) * 100);
      await source.saveProgress(bookId, targetIndex, percent, res.chapter.title, 0, 0);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setForbiddenError(true);
      } else {
        setErrorMessage(err?.message || 'Không thể tải nội dung chương.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChapter(chapterIndex);
  }, [bookId, chapterIndex]);

  // IDOR Defense screen
  if (forbiddenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAF8F5]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-ink-900">Truy cập bị từ chối (403)</h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            Bạn không có quyền đọc chương này vì tác phẩm chưa được phân công cho tài khoản của bạn.
          </p>
          <button
            onClick={onBackToBook}
            className="px-5 py-2.5 bg-ink-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-ink-900 flex flex-col selection:bg-purple-100 selection:text-purple-900">
      {/* Reader Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-ink-100/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={onBackToBook}
            className="flex items-center gap-1 text-ink-600 hover:text-ink-900 text-xs font-semibold py-1.5 px-2.5 rounded-lg hover:bg-ink-200/50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Mục lục</span>
          </button>

          <div className="text-center min-w-0 px-2">
            <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider line-clamp-1">
              {bookTitle || 'LilyBeta Reader'}
            </p>
            <p className="text-xs font-serif font-bold text-ink-800 line-clamp-1">
              {chapter?.title || `Chương ${chapterIndex}`}
            </p>
          </div>

          {/* Font Controls */}
          <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg p-0.5">
            <button
              onClick={() => setFontSize((s) => Math.max(14, s - 2))}
              className="p-1 text-ink-600 hover:text-ink-900 rounded hover:bg-ink-50"
              title="Giảm cỡ chữ"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-semibold px-1 text-ink-700">{fontSize}</span>
            <button
              onClick={() => setFontSize((s) => Math.min(26, s + 2))}
              className="p-1 text-ink-600 hover:text-ink-900 rounded hover:bg-ink-50"
              title="Tăng cỡ chữ"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Reader Body */}
      <main className="max-w-2xl mx-auto px-5 sm:px-6 py-10 flex-1 w-full space-y-8">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-ink-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-xs">Đang tải nội dung chương {chapterIndex}...</p>
          </div>
        ) : errorMessage ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-rose-100 text-rose-800 text-xs">
            {errorMessage}
          </div>
        ) : chapter ? (
          <article className="space-y-6">
            {/* Chapter Header */}
            <div className="text-center pb-6 border-b border-ink-200/50 space-y-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-widest text-purple-700">
                Chương {chapter.index} / {totalChapters}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink-900 tracking-tight leading-snug">
                {chapter.title}
              </h2>
              <p className="text-xs text-ink-400 font-mono">
                {chapter.wordCount.toLocaleString('vi-VN')} chữ
              </p>
            </div>

            {/* Chapter Paragraphs */}
            <div
              ref={contentRef}
              className="font-serif leading-relaxed text-ink-900 space-y-5"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.85 }}
            >
              {chapter.paragraphs && chapter.paragraphs.length > 0 ? (
                chapter.paragraphs.map((p, idx) => (
                  <p key={idx} className="indent-6 tracking-normal">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-center text-ink-400 italic text-sm">Chương này chưa có nội dung văn bản.</p>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className="pt-10 pb-6 border-t border-ink-200/60 flex items-center justify-between gap-4">
              <button
                onClick={() => setChapterIndex((i) => Math.max(1, i - 1))}
                disabled={chapterIndex <= 1}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-200 text-xs font-semibold text-ink-700 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Chương trước</span>
              </button>

              <span className="text-xs font-mono text-ink-400">
                {chapterIndex} / {totalChapters}
              </span>

              <button
                onClick={() => setChapterIndex((i) => Math.min(totalChapters, i + 1))}
                disabled={chapterIndex >= totalChapters}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <span>Chương sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
};
