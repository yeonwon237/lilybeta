import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { ErrorType, ERROR_TYPE_OPTIONS, BetaEdit } from '../../beta-edit/editTypes';
import { SelectionRangeInfo } from './InlineSelectionToolbar';

interface EditBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectionRange: SelectionRangeInfo | null;
  existingEdit?: BetaEdit | null;
  onSaveEdit: (data: {
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    originalText: string;
    proposedText: string;
    errorType: ErrorType;
    reason?: string;
    expectedVersion?: number;
  }) => Promise<void>;
  userId?: string;
  bookId?: string;
  chapterIndex?: number;
}

export const EditBottomSheet: React.FC<EditBottomSheetProps> = ({
  isOpen,
  onClose,
  selectionRange,
  existingEdit,
  onSaveEdit,
  userId = 'default',
  bookId = 'default',
  chapterIndex = 1,
}) => {
  const originalText = existingEdit ? existingEdit.originalText : (selectionRange?.selectedText || '');
  const pIndex = existingEdit ? existingEdit.paragraphIndex : (selectionRange?.paragraphIndex || 0);
  const startOffset = existingEdit ? existingEdit.startOffset : (selectionRange?.startOffset || 0);
  const endOffset = existingEdit ? existingEdit.endOffset : (selectionRange?.endOffset || 0);

  const draftKey = `lilybeta_draft_${userId}_${bookId}_${chapterIndex}_${pIndex}_${startOffset}`;

  const [proposedText, setProposedText] = useState<string>('');
  const [errorType, setErrorType] = useState<ErrorType>('XUNG_HO');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDraftRestored, setHasDraftRestored] = useState<boolean>(false);

  // Initialize or restore draft when opening
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setHasDraftRestored(false);
      return;
    }

    if (existingEdit) {
      setProposedText(existingEdit.currentText);
      setErrorType(existingEdit.errorType);
      setReason(existingEdit.reason || '');
      return;
    }

    // New edit: check local draft
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.proposedText) {
          setProposedText(parsed.proposedText);
          setErrorType(parsed.errorType || 'XUNG_HO');
          setReason(parsed.reason || '');
          setHasDraftRestored(true);
          return;
        }
      }
    } catch {}

    setProposedText(originalText);
    setErrorType('XUNG_HO');
    setReason('');
  }, [isOpen, existingEdit, originalText, draftKey]);

  // Autosave draft locally as user types
  useEffect(() => {
    if (!isOpen || existingEdit) return;

    if (proposedText && proposedText !== originalText) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          proposedText,
          errorType,
          reason,
          updatedAt: Date.now(),
        }));
      } catch {}
    }
  }, [proposedText, errorType, reason, isOpen, existingEdit, originalText, draftKey]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanProposed = proposedText.trim();
    if (!cleanProposed) {
      setErrorMessage('Vui lòng nhập nội dung chỉnh sửa');
      return;
    }

    if (cleanProposed === originalText.trim()) {
      setErrorMessage('Nội dung sửa chưa thay đổi so với bản gốc');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveEdit({
        paragraphIndex: pIndex,
        startOffset,
        endOffset,
        originalText,
        proposedText: cleanProposed,
        errorType,
        reason: reason.trim() || undefined,
        expectedVersion: existingEdit?.version,
      });

      // Clear draft on success
      try {
        localStorage.removeItem(draftKey);
      } catch {}

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể lưu bản sửa. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Clean up draft if user cancels without changes
    if (proposedText === originalText) {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-ink-100 p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-ink-900 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base text-ink-950">
              {existingEdit ? 'Chỉnh sửa lại đề xuất' : 'Đề xuất chỉnh sửa (Beta Edit)'}
            </h3>
            {hasDraftRestored && (
              <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full">
                Đã phục hồi nháp
              </span>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Original Text (Read-Only) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-500 uppercase tracking-wider text-[11px]">
                Bản gốc trong tác phẩm:
              </span>
              <span className="font-mono text-[10px] text-ink-400">
                Đoạn {pIndex + 1} · {originalText.length} ký tự
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-xs font-serif text-ink-800 leading-relaxed max-h-24 overflow-y-auto">
              "{originalText}"
            </div>
          </div>

          {/* 2. Proposed Text Textarea */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-purple-900 uppercase tracking-wider">
              Sửa thành:
            </label>
            <textarea
              value={proposedText}
              onChange={(e) => setProposedText(e.target.value)}
              rows={3}
              placeholder="Nhập nội dung đã được sửa..."
              className="w-full p-3 rounded-2xl border border-purple-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 text-xs font-serif text-ink-950 focus:outline-none resize-none leading-relaxed"
              autoFocus
            />
          </div>

          {/* 3. Error Type Picker */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-ink-600 uppercase tracking-wider">
              Phân loại lỗi:
            </label>
            <select
              value={errorType}
              onChange={(e) => setErrorType(e.target.value as ErrorType)}
              className="w-full p-2.5 rounded-xl border border-ink-200 text-xs bg-white text-ink-800 focus:border-purple-600 focus:outline-none"
            >
              {ERROR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Reason / Note */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-ink-600 uppercase tracking-wider">
              Lý do sửa / Ghi chú cho biên tập viên:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nhân vật là nữ nên đổi xưng hô; hoặc ngữ cảnh thời phong kiến..."
              className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs focus:border-purple-600 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-ink-100">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-ink-600 hover:bg-ink-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
            >
              {isSubmitting ? (
                <span>Đang lưu...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{existingEdit ? 'Cập nhật bản sửa' : 'Lưu bản sửa'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
