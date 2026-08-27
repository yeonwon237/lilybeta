import React, { useState } from 'react';
import { X, Check, MessageSquare } from 'lucide-react';
import { SelectionRangeInfo } from './InlineSelectionToolbar';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectionRange: SelectionRangeInfo | null;
  onSaveNote: (data: {
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    selectedText?: string;
    note: string;
  }) => Promise<void>;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  selectionRange,
  onSaveNote,
}) => {
  const [noteContent, setNoteContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !selectionRange) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      setIsSubmitting(true);
      await onSaveNote({
        paragraphIndex: selectionRange.paragraphIndex,
        startOffset: selectionRange.startOffset,
        endOffset: selectionRange.endOffset,
        selectedText: selectionRange.selectedText,
        note: noteContent.trim(),
      });
      setNoteContent('');
      onClose();
    } catch (err) {
      alert('Không thể lưu ghi chú.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-ink-100 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="font-serif font-bold text-base text-ink-950">
              Thêm ghi chú đoạn văn
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="p-3 rounded-2xl bg-ink-50/70 border border-ink-100 text-xs font-serif text-ink-700 italic">
            "{selectionRange.selectedText}"
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-ink-600 uppercase tracking-wider">
              Nội dung ghi chú:
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Nhập suy nghĩ, câu hỏi hoặc nhắc nhở cho đoạn này..."
              className="w-full p-3 rounded-2xl border border-ink-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs text-ink-950 focus:outline-none resize-none"
              autoFocus
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-ink-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-600 hover:bg-ink-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !noteContent.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
            >
              <Check className="w-4 h-4" />
              <span>Lưu ghi chú</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
