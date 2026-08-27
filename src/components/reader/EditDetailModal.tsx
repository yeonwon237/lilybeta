import React from 'react';
import { X, Edit3, History, RotateCcw, AlertTriangle } from 'lucide-react';
import { BetaEdit, ERROR_TYPE_LABELS } from '../../beta-edit/editTypes';

interface EditDetailModalProps {
  edit: BetaEdit | null;
  isOpen: boolean;
  onClose: () => void;
  onEditAgain: (edit: BetaEdit) => void;
  onViewHistory: (edit: BetaEdit) => void;
  onRevertEdit: (edit: BetaEdit) => Promise<void>;
}

export const EditDetailModal: React.FC<EditDetailModalProps> = ({
  edit,
  isOpen,
  onClose,
  onEditAgain,
  onViewHistory,
  onRevertEdit,
}) => {
  if (!isOpen || !edit) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-ink-100 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              {ERROR_TYPE_LABELS[edit.errorType] || edit.errorType}
            </span>
            <span className="text-[11px] font-mono text-ink-400">
              Phiên bản {edit.version}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff comparison */}
        <div className="space-y-3">
          {/* Admin Review Status Banner */}
          {edit.reviewStatus && edit.reviewStatus !== 'PENDING' && (
            <div
              className={`p-3 rounded-2xl border text-xs space-y-1 ${
                edit.reviewStatus === 'ACCEPTED'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : edit.reviewStatus === 'CHANGES_REQUESTED'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {edit.reviewStatus === 'ACCEPTED' && (
                  <>
                    <span className="text-emerald-600">✓</span>
                    <span>Admin đã chấp nhận đề xuất</span>
                  </>
                )}
                {edit.reviewStatus === 'CHANGES_REQUESTED' && (
                  <>
                    <span className="text-amber-600">⚠️</span>
                    <span>Admin yêu cầu chỉnh sửa lại</span>
                  </>
                )}
                {edit.reviewStatus === 'REJECTED' && (
                  <>
                    <span className="text-rose-600">✕</span>
                    <span>Admin đã từ chối đề xuất</span>
                  </>
                )}
              </div>
              {edit.reviewComment && (
                <p className="text-xs italic pl-4 border-l-2 border-current/30">
                  "{edit.reviewComment}"
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
              Bản gốc:
            </span>
            <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/70 text-xs font-serif text-rose-950 leading-relaxed">
              - {edit.originalText}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Đã sửa thành:
            </span>
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-xs font-serif text-emerald-950 leading-relaxed font-medium">
              + {edit.currentText}
            </div>
          </div>

          {edit.reason && (
            <div className="p-3 rounded-2xl bg-ink-50 border border-ink-100 text-xs space-y-1">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
                Lý do / Ghi chú:
              </span>
              <p className="text-ink-700 italic">{edit.reason}</p>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="pt-3 border-t border-ink-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onRevertEdit(edit)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            title="Khôi phục về bản gốc"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewHistory(edit)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ink-200 text-xs font-semibold hover:bg-ink-50 transition"
            >
              <History className="w-3.5 h-3.5 text-ink-600" />
              <span>Lịch sử ({edit.version})</span>
            </button>

            <button
              type="button"
              onClick={() => onEditAgain(edit)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa lại</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
