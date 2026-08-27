import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

export const ConfirmCompleteModal: React.FC = () => {
  const { 
    isConfirmCompleteOpen, 
    setIsConfirmCompleteOpen, 
    currentChapterIndex, 
    currentChapter, 
    markCurrentChapterCompleted 
  } = useReader();

  if (!isConfirmCompleteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full shadow-modal border border-ink-100 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="font-serif font-bold text-lg text-ink-900">
            Xác nhận hoàn thành chương {currentChapterIndex}?
          </h3>
          <p className="text-xs text-ink-600 leading-relaxed">
            {currentChapter?.title}
          </p>
          <p className="text-[11px] text-ink-500 pt-1 leading-relaxed">
            Sau khi xác nhận, chương này sẽ được đánh dấu đã beta xong và tiến độ của bạn được ghi nhận vào hệ thống. Bạn vẫn có thể mở đọc lại chương này bất cứ lúc nào.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfirmCompleteOpen(false)}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-ink-600 hover:bg-ink-100 transition"
          >
            Quay lại đọc
          </button>
          <button
            type="button"
            onClick={() => markCurrentChapterCompleted()}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
          >
            Xác nhận đã beta
          </button>
        </div>
      </div>
    </div>
  );
};
