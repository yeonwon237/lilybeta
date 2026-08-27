import React, { useEffect, useRef } from 'react';
import { useReader, ReaderProvider } from '../../context/ReaderContext';
import { ReaderToolbar } from '../../components/reader/ReaderToolbar';
import { AaSettingsSheet } from '../../components/reader/AaSettingsSheet';
import { ThemeSelectorSheet } from '../../components/reader/ThemeSelectorSheet';
import { TocDrawer } from '../../components/reader/TocDrawer';
import { ConfirmCompleteModal } from '../../components/reader/ConfirmCompleteModal';
import { Watermark } from '../../components/reader/Watermark';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Check, 
  Loader2, 
  ShieldAlert 
} from 'lucide-react';

interface BetaReaderViewContentProps {
  bookId: string;
  initialChapterIndex: number;
  onBackToBook: () => void;
}

const BetaReaderViewContent: React.FC<BetaReaderViewContentProps> = ({
  bookId,
  initialChapterIndex,
  onBackToBook,
}) => {
  const { 
    book,
    currentChapterIndex,
    currentChapter,
    totalChapters,
    settings,
    activeTheme,
    isLoadingChapter,
    readerError,
    initReader,
    nextChapter,
    prevChapter,
    toggleToolbar,
    triggerAutosave,
    setIsConfirmCompleteOpen,
    workflowMap,
  } = useReader();

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize on mount or when bookId changes
  useEffect(() => {
    initReader(bookId, initialChapterIndex);
  }, [bookId]);

  // Scroll listener for cloud autosave (debounced 1s inside context)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = Math.min(100, Math.max(0, (scrollY / scrollHeight) * 100));
      triggerAutosave(scrollPercent, scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [triggerAutosave]);

  // Handle click on reading area to toggle toolbar
  const handleContentClick = (e: React.MouseEvent) => {
    // If text was selected, do not toggle toolbar
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    toggleToolbar();
  };

  // If unauthorized / IDOR barrier
  if (readerError && readerError.includes('quyền')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAF8F5]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-ink-900">Truy cập bị từ chối (403)</h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            {readerError}
          </p>
          <button
            onClick={onBackToBook}
            className="px-5 py-2.5 bg-ink-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition"
          >
            Quay lại danh sách truyện
          </button>
        </div>
      </div>
    );
  }

  // Page width styling
  const maxWidthClass = {
    narrow: 'max-w-xl',
    normal: 'max-w-2xl',
    wide: 'max-w-3xl',
    full: 'max-w-4xl',
  }[settings.pageWidth || 'normal'];

  const currentWorkflow = workflowMap[currentChapterIndex];
  const isCompleted = currentWorkflow?.status === 'COMPLETED';

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen transition-colors duration-200 ${activeTheme.className} reader-deterrence`}
      style={{ 
        backgroundColor: 'var(--reader-bg)', 
        color: 'var(--reader-text)',
      }}
      onClick={handleContentClick}
    >
      {/* Floating Toolbars */}
      <ReaderToolbar onBack={onBackToBook} />

      {/* Floating Sheets & Drawers */}
      <AaSettingsSheet />
      <ThemeSelectorSheet />
      <TocDrawer />
      <ConfirmCompleteModal />

      {/* Watermark for Accountability Deterrence */}
      <Watermark />

      {/* Reading Article */}
      <main 
        className={`${maxWidthClass} mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-28 sm:pb-36 transition-all duration-150`}
        style={{
          fontFamily: `"${settings.fontFamily}", serif`,
          paddingLeft: `${Math.max(16, settings.marginHorizontal)}px`,
          paddingRight: `${Math.max(16, settings.marginHorizontal)}px`,
        }}
      >
        {isLoadingChapter ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-700" />
            <p className="text-xs opacity-75 font-sans">Đang tải nội dung bản thảo...</p>
          </div>
        ) : readerError ? (
          <div className="p-8 rounded-3xl bg-rose-50/50 border border-rose-200 text-rose-900 text-center text-xs space-y-3 font-sans">
            <p>{readerError}</p>
            <button
              onClick={onBackToBook}
              className="px-4 py-2 bg-ink-900 text-white rounded-xl text-xs font-semibold"
            >
              Quay lại mục lục
            </button>
          </div>
        ) : currentChapter ? (
          <article className="space-y-8 animate-in fade-in duration-200">
            {/* Chapter Header */}
            <div className="text-center pb-8 border-b border-ink-200/40 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-widest opacity-60 font-sans">
                  Chương {currentChapter.index} / {totalChapters}
                </span>
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Đã beta xong</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                {currentChapter.title}
              </h1>

              <p className="text-[11px] opacity-60 font-mono font-sans">
                {currentChapter.wordCount.toLocaleString('vi-VN')} chữ
              </p>
            </div>

            {/* Paragraphs */}
            <div 
              className="reader-prose space-y-5"
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                textAlign: settings.textAlign,
              }}
            >
              {currentChapter.paragraphs && currentChapter.paragraphs.length > 0 ? (
                currentChapter.paragraphs.map((p, idx) => (
                  <p 
                    key={idx} 
                    className={settings.firstLineIndent ? 'indent-6' : ''}
                    style={{ marginBottom: `${(settings.paragraphSpacing - 1) * 1.5}rem` }}
                  >
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-center opacity-50 italic text-sm py-12">
                  Chương này chưa có nội dung văn bản.
                </p>
              )}
            </div>

            {/* Chapter Completion Section */}
            <div 
              className="pt-12 pb-6 border-t border-ink-200/40 space-y-6 text-center font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {isCompleted ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 inline-flex flex-col items-center gap-1.5 max-w-sm mx-auto">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bạn đã hoàn thành beta chương này</span>
                  </div>
                  {currentWorkflow?.completedAt && (
                    <span className="text-[10px] opacity-75 font-mono">
                      Ghi nhận lúc: {new Date(currentWorkflow.completedAt).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs opacity-75">
                    Đã đọc hết nội dung chương {currentChapterIndex}?
                  </p>
                  <button
                    onClick={() => setIsConfirmCompleteOpen(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-xs font-semibold shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận đã beta xong chương {currentChapterIndex}</span>
                  </button>
                </div>
              )}

              {/* Bottom Nav Stepper */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <button
                  onClick={prevChapter}
                  disabled={currentChapterIndex <= 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-ink-200/60 text-xs font-semibold hover:bg-ink-100/50 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Chương trước</span>
                </button>

                <span className="text-xs font-mono opacity-60">
                  {currentChapterIndex} / {totalChapters}
                </span>

                <button
                  onClick={nextChapter}
                  disabled={currentChapterIndex >= totalChapters}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <span>Chương sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
};

export const BetaReaderView: React.FC<BetaReaderViewContentProps> = (props) => {
  return (
    <ReaderProvider>
      <BetaReaderViewContent {...props} />
    </ReaderProvider>
  );
};
