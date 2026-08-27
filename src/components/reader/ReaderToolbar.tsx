import React from 'react';
import { 
  ArrowLeft, 
  Menu, 
  Type, 
  Palette, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles,
  Check
} from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

interface ReaderToolbarProps {
  onBack: () => void;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({ onBack }) => {
  const { 
    book,
    currentChapterIndex, 
    currentChapter,
    totalChapters, 
    nextChapter, 
    prevChapter,
    isToolbarVisible,
    setIsAaPanelOpen,
    setIsThemePanelOpen,
    setIsTocOpen,
    setIsConfirmCompleteOpen,
    workflowMap,
    isAutosaving,
    lastSavedText
  } = useReader();

  if (!isToolbarVisible) return null;

  const currentWorkflow = workflowMap[currentChapterIndex];
  const isCompleted = currentWorkflow?.status === 'COMPLETED';

  return (
    <>
      {/* TOP FLOATING TOOLBAR */}
      <div 
        className="reader-toolbar-top fixed top-2 sm:top-3 left-3 right-3 z-40 px-3 sm:px-4 py-2 rounded-[20px] transition-all animate-in slide-in-from-top duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-ink-100/60 text-xs font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Mục lục</span>
          </button>

          {/* Book & Chapter title */}
          <div className="text-center min-w-0 flex-1 px-2">
            <h2 className="font-serif font-semibold text-xs truncate">
              {book?.title}
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-[11px] opacity-75">
              <span>Chương {currentChapterIndex} / {totalChapters}</span>
              {lastSavedText && (
                <span className="text-[10px] text-emerald-600 font-mono hidden sm:inline">
                  · {lastSavedText}
                </span>
              )}
            </div>
          </div>

          {/* Beta Completion CTA Button */}
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã beta xong</span>
              </span>
            ) : (
              <button
                onClick={() => setIsConfirmCompleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white shadow-xs transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đã beta xong chương</span>
                <span className="sm:hidden">Beta xong</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM FLOATING TOOLBAR */}
      <div 
        className="reader-toolbar-bottom fixed bottom-2 sm:bottom-3 left-3 right-3 z-40 px-3 py-2 rounded-[22px] transition-all animate-in slide-in-from-bottom duration-200 safe-area-pb"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-xl mx-auto flex flex-col gap-1.5">
          {/* Chapter Quick Stepper */}
          <div className="flex items-center justify-between gap-3 text-xs px-2 opacity-85">
            <button
              onClick={prevChapter}
              disabled={currentChapterIndex <= 1}
              className="p-1 rounded-lg hover:bg-ink-100/50 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Chương trước</span>
            </button>

            <span className="font-mono font-medium text-xs">
              {currentChapterIndex} / {totalChapters}
            </span>

            <button
              onClick={nextChapter}
              disabled={currentChapterIndex >= totalChapters}
              className="p-1 rounded-lg hover:bg-ink-100/50 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 font-medium"
            >
              <span className="hidden sm:inline text-[11px]">Chương sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center justify-around pt-1 border-t border-ink-100/50">
            {/* TOC */}
            <button
              onClick={() => setIsTocOpen(true)}
              className="flex flex-col items-center p-1.5 rounded-xl hover:bg-ink-100/50 transition"
            >
              <Menu className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium">Mục lục</span>
            </button>

            {/* Typography Aa */}
            <button
              onClick={() => setIsAaPanelOpen(true)}
              className="flex flex-col items-center p-1.5 rounded-xl hover:bg-ink-100/50 transition"
            >
              <Type className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium">Cỡ chữ (Aa)</span>
            </button>

            {/* Themes */}
            <button
              onClick={() => setIsThemePanelOpen(true)}
              className="flex flex-col items-center p-1.5 rounded-xl hover:bg-ink-100/50 transition"
            >
              <Palette className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium">Giao diện</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
