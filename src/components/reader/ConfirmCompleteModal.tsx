import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Edit3, MessageSquare, Check } from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

export const ConfirmCompleteModal: React.FC = () => {
  const { 
    book,
    isConfirmCompleteOpen, 
    setIsConfirmCompleteOpen, 
    currentChapterIndex, 
    currentChapter, 
    markCurrentChapterCompleted,
    edits,
    notes,
    isAutosaving
  } = useReader();

  const [hasUnsavedDraft, setHasUnsavedDraft] = useState<boolean>(false);

  useEffect(() => {
    if (!isConfirmCompleteOpen || !book) return;

    // Check if any unsaved edit drafts exist for this chapter
    let unsavedFound = false;
    try {
      const prefix = `lilybeta_draft_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && key.includes(`_${book.id}_${currentChapterIndex}_`)) {
          unsavedFound = true;
          break;
        }
      }
    } catch {}

    setHasUnsavedDraft(unsavedFound);
  }, [isConfirmCompleteOpen, book, currentChapterIndex]);

  if (!isConfirmCompleteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-ink-100 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="font-serif font-bold text-lg text-ink-900">
            Xác nhận hoàn thành chương {currentChapterIndex}?
          </h3>
          <p className="text-xs text-ink-600 font-medium truncate">
            {currentChapter?.title}
          </p>

          {/* Edit and Note summary */}
          <div className="pt-2 flex items-center justify-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 font-semibold border border-purple-100">
              <Edit3 className="w-3 h-3 text-purple-600" />
              <span>{edits.length} chỉnh sửa</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 font-semibold border border-amber-100">
              <MessageSquare className="w-3 h-3 text-amber-600" />
              <span>{notes.length} ghi chú</span>
            </span>
          </div>

          {/* Unsaved draft warning */}
          {hasUnsavedDraft ? (
            <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Chưa thể hoàn tất:</p>
                <p>Vẫn còn bản nháp chỉnh sửa chưa được lưu trong chương này. Hãy hoàn tất hoặc hủy bản nháp trước khi beta xong.</p>
              </div>
            </div>
          ) : isAutosaving ? (
            <div className="mt-3 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
              Hệ thống đang đồng bộ tiến độ đọc... Vui lòng đợi trong giây lát.
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-200/60 p-2.5 rounded-2xl flex items-center justify-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tất cả thay đổi đã được lưu an toàn ✓</span>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfirmCompleteOpen(false)}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-ink-600 hover:bg-ink-100 transition"
          >
            Quay lại
          </button>
          <button
            type="button"
            disabled={hasUnsavedDraft || isAutosaving}
            onClick={() => markCurrentChapterCompleted()}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:hover:bg-purple-700 text-white shadow-xs transition"
          >
            Xác nhận xong
          </button>
        </div>
      </div>
    </div>
  );
};
