import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, Sparkles, RefreshCw, AlertTriangle, Trash2, ArrowLeft } from 'lucide-react';
import { ErrorType, ERROR_TYPE_OPTIONS, BetaEdit } from '../../beta-edit/editTypes';
import { SelectionRangeInfo } from './InlineSelectionToolbar';
import { DraftStore, ExistingEditDraft } from '../../beta-edit/draftStore';

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

  const [proposedText, setProposedText] = useState<string>('');
  const [errorType, setErrorType] = useState<ErrorType>('XUNG_HO');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDraftRestored, setHasDraftRestored] = useState<boolean>(false);
  const [restoredVersion, setRestoredVersion] = useState<number | null>(null);

  // Stale draft conflict state (when draft.baseVersion !== existingEdit.version)
  const [staleDraft, setStaleDraft] = useState<ExistingEditDraft | null>(null);

  // Discard confirmation modal state
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Baseline comparison
  const baseText = existingEdit ? existingEdit.currentText : originalText;
  const baseErrorType = existingEdit ? existingEdit.errorType : 'XUNG_HO';
  const baseReason = existingEdit?.reason || '';

  const hasUnsavedChanges = 
    proposedText !== baseText || 
    errorType !== baseErrorType || 
    reason.trim() !== baseReason.trim();

  // Initialize or restore draft when opening
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setHasDraftRestored(false);
      setRestoredVersion(null);
      setStaleDraft(null);
      setShowDiscardConfirm(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    if (existingEdit) {
      // Check existing edit draft
      const draftResult = DraftStore.getExistingDraft(userId, existingEdit.id, existingEdit.version);
      if (draftResult) {
        if (draftResult.isStale) {
          // Conflict: draft is from an older or different version
          setStaleDraft(draftResult.draft);
          setProposedText(existingEdit.currentText);
          setErrorType(existingEdit.errorType);
          setReason(existingEdit.reason || '');
        } else {
          // Clean restore: draft baseVersion matches current edit version
          setProposedText(draftResult.draft.proposedText);
          setErrorType(draftResult.draft.errorType);
          setReason(draftResult.draft.reason || '');
          setHasDraftRestored(true);
          setRestoredVersion(existingEdit.version);
        }
        return;
      }

      setProposedText(existingEdit.currentText);
      setErrorType(existingEdit.errorType);
      setReason(existingEdit.reason || '');
      return;
    }

    // New edit: check local draft
    const savedDraft = DraftStore.getNewDraft(
      userId,
      bookId,
      chapterIndex,
      pIndex,
      startOffset,
      endOffset
    );

    if (savedDraft && savedDraft.proposedText) {
      setProposedText(savedDraft.proposedText);
      setErrorType(savedDraft.errorType || 'XUNG_HO');
      setReason(savedDraft.reason || '');
      setHasDraftRestored(true);
      return;
    }

    setProposedText(originalText);
    setErrorType('XUNG_HO');
    setReason('');
  }, [isOpen, existingEdit, originalText, userId, bookId, chapterIndex, pIndex, startOffset, endOffset]);

  // Debounced autosave as user types (400ms)
  useEffect(() => {
    if (!isOpen) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (existingEdit) {
        if (hasUnsavedChanges && proposedText.trim()) {
          DraftStore.saveExistingDraft({
            userId,
            bookId,
            chapterIndex,
            editId: existingEdit.id,
            baseVersion: existingEdit.version,
            proposedText,
            errorType,
            reason: reason.trim() || undefined,
          });
        }
      } else {
        if (proposedText && proposedText !== originalText) {
          DraftStore.saveNewDraft({
            userId,
            bookId,
            chapterIndex,
            paragraphIndex: pIndex,
            startOffset,
            endOffset,
            originalText,
            proposedText,
            errorType,
            reason: reason.trim() || undefined,
          });
        }
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [proposedText, errorType, reason, isOpen, existingEdit, originalText, userId, bookId, chapterIndex, pIndex, startOffset, endOffset, hasUnsavedChanges]);

  if (!isOpen) return null;

  const handleApplyStaleDraft = () => {
    if (!staleDraft) return;
    setProposedText(staleDraft.proposedText);
    setErrorType(staleDraft.errorType);
    setReason(staleDraft.reason || '');
    setHasDraftRestored(true);
    setRestoredVersion(staleDraft.baseVersion);
    setStaleDraft(null);
  };

  const handleDiscardStaleDraft = () => {
    if (!staleDraft || !existingEdit) return;
    DraftStore.deleteExistingDraft(userId, existingEdit.id, staleDraft.baseVersion);
    setStaleDraft(null);
  };

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

      // Clear draft on successful cloud save
      if (existingEdit) {
        DraftStore.deleteExistingDraft(userId, existingEdit.id, existingEdit.version);
      } else {
        DraftStore.deleteNewDraft(userId, bookId, chapterIndex, pIndex, startOffset, endOffset);
      }

      onClose();
    } catch (err: any) {
      // Keep draft intact on error so user never loses their changes
      setErrorMessage(err?.message || 'Không thể lưu bản sửa. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      // Clean up irrelevant draft if text was reverted back to original
      if (existingEdit) {
        DraftStore.deleteExistingDraft(userId, existingEdit.id, existingEdit.version);
      } else {
        DraftStore.deleteNewDraft(userId, bookId, chapterIndex, pIndex, startOffset, endOffset);
      }
      onClose();
    }
  };

  // Discard draft action: delete from store and close
  const handleConfirmDiscard = () => {
    if (existingEdit) {
      DraftStore.deleteExistingDraft(userId, existingEdit.id, existingEdit.version);
    } else {
      DraftStore.deleteNewDraft(userId, bookId, chapterIndex, pIndex, startOffset, endOffset);
    }
    setShowDiscardConfirm(false);
    onClose();
  };

  // Keep draft action: ensure saved and close
  const handleKeepDraftAndClose = () => {
    if (existingEdit) {
      DraftStore.saveExistingDraft({
        userId,
        bookId,
        chapterIndex,
        editId: existingEdit.id,
        baseVersion: existingEdit.version,
        proposedText,
        errorType,
        reason: reason.trim() || undefined,
      });
    } else {
      DraftStore.saveNewDraft({
        userId,
        bookId,
        chapterIndex,
        paragraphIndex: pIndex,
        startOffset,
        endOffset,
        originalText,
        proposedText,
        errorType,
        reason: reason.trim() || undefined,
      });
    }
    setShowDiscardConfirm(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleRequestClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-ink-100 p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-ink-900 max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base text-ink-950">
              {existingEdit ? 'Chỉnh sửa lại đề xuất' : 'Đề xuất chỉnh sửa (Beta Edit)'}
            </h3>
            {hasDraftRestored && (
              <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                {restoredVersion !== null ? `Đã phục hồi nháp v${restoredVersion}` : 'Đã phục hồi nháp'}
              </span>
            )}
          </div>
          <button
            onClick={handleRequestClose}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stale Draft Version Conflict Banner */}
        {staleDraft && existingEdit && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Phát hiện bản nháp từ phiên bản cũ (v{staleDraft.baseVersion})</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Phiên bản máy chủ hiện tại là <strong>v{existingEdit.version}</strong>. Hệ thống không tự động ghi đè. Bạn có muốn xem lại bản nháp cũ hay bỏ qua?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyStaleDraft}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-[11px] transition"
              >
                Xem & khôi phục nháp
              </button>
              <button
                type="button"
                onClick={handleDiscardStaleDraft}
                className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold rounded-xl text-[11px] transition"
              >
                Bỏ bản nháp cũ
              </button>
            </div>
          </div>
        )}

        {/* Original text preview */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
            Văn bản gốc trong bản thảo:
          </label>
          <div className="p-3 rounded-2xl bg-ink-50/70 border border-ink-100 text-xs text-ink-800 font-serif italic max-h-24 overflow-y-auto">
            "{originalText}"
          </div>
        </div>

        {/* Replacement input */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider block">
              Đề xuất văn bản thay thế: <span className="text-purple-700">*</span>
            </label>
            <textarea
              rows={3}
              value={proposedText}
              onChange={(e) => setProposedText(e.target.value)}
              placeholder="Nhập nội dung chỉnh sửa của bạn..."
              className="w-full p-3 rounded-2xl border border-ink-200 text-xs font-serif text-ink-900 bg-white placeholder:text-ink-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition"
              autoFocus
            />
          </div>

          {/* Error type picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider block">
              Phân loại lỗi: <span className="text-purple-700">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ERROR_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setErrorType(opt.id)}
                  className={`p-2 rounded-xl text-left text-xs transition border flex flex-col justify-between ${
                    errorType === opt.id
                      ? 'bg-purple-50/80 border-purple-600 text-purple-900 font-semibold shadow-2xs'
                      : 'bg-white border-ink-100 hover:bg-ink-50/50 text-ink-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[9px] text-ink-400 font-normal line-clamp-1">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason / note */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider block">
              Lý do hoặc giải thích thêm (không bắt buộc):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Đại từ nhân vật không đúng bối cảnh đoạn trước..."
              className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs text-ink-900 bg-white placeholder:text-ink-300 focus:outline-none focus:border-purple-600 transition"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-100">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-100 rounded-xl transition"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-purple-900 hover:bg-purple-950 disabled:bg-ink-300 rounded-xl shadow-xs transition"
            >
              {isSubmitting ? (
                <span>Đang lưu...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{existingEdit ? 'Cập nhật đề xuất' : 'Lưu chỉnh sửa'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Discard Confirmation Modal (Bug 2 Fix) */}
        {showDiscardConfirm && (
          <div 
            className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-3xl p-6 flex flex-col justify-center items-center text-center space-y-4 z-20 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="font-serif font-bold text-base text-ink-950">
                Bạn có thay đổi chưa lưu
              </h4>
              <p className="text-xs text-ink-600 max-w-xs leading-relaxed">
                Bạn muốn tiếp tục sửa, giữ bản nháp trên trình duyệt để sửa tiếp sau, hay xóa bỏ bản nháp này?
              </p>
            </div>

            <div className="flex flex-col w-full max-w-xs gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-semibold shadow-xs transition"
              >
                Tiếp tục sửa
              </button>

              <button
                type="button"
                onClick={handleKeepDraftAndClose}
                className="w-full py-2.5 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-800 font-semibold transition"
              >
                Giữ bản nháp & Đóng
              </button>

              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="w-full py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bỏ bản nháp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
