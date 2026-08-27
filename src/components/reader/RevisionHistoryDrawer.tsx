import React, { useEffect, useState } from 'react';
import { X, History, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { BetaEdit, EditRevision, ERROR_TYPE_LABELS } from '../../beta-edit/editTypes';
import { BetaCloudBookSource } from '../../book-engine/source/BetaCloudBookSource';

interface RevisionHistoryDrawerProps {
  edit: BetaEdit | null;
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  chapterIndex: number;
}

export const RevisionHistoryDrawer: React.FC<RevisionHistoryDrawerProps> = ({
  edit,
  isOpen,
  onClose,
  bookId,
  chapterIndex,
}) => {
  const [revisions, setRevisions] = useState<EditRevision[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !edit) {
      setRevisions([]);
      return;
    }

    const fetchRevisions = async () => {
      setIsLoading(true);
      try {
        const source = BetaCloudBookSource.getInstance();
        const list = await source.getEditRevisions(bookId, chapterIndex, edit.id);
        setRevisions(list);
      } catch (err) {
        console.error('Failed to load revisions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRevisions();
  }, [isOpen, edit, bookId, chapterIndex]);

  if (!isOpen || !edit) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl border-l border-ink-100 p-5 sm:p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200 text-ink-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pb-4 border-b border-ink-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-ink-950">
                Lịch sử sửa đổi
              </h3>
              <p className="text-[11px] text-ink-400 font-mono">
                Đoạn {edit.paragraphIndex + 1} · {revisions.length} phiên bản
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
              <span className="text-xs">Đang tải lịch sử...</span>
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-center text-xs text-ink-400 py-12">Chưa có lịch sử sửa đổi</p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink-100">
              {revisions.map((rev, idx) => {
                const isLatest = idx === revisions.length - 1;
                return (
                  <div key={rev.id || idx} className="relative space-y-1.5">
                    {/* Bullet marker */}
                    <div
                      className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 bg-white ${
                        isLatest
                          ? 'border-purple-600 ring-2 ring-purple-100'
                          : 'border-ink-300'
                      }`}
                    />

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink-900">
                        Phiên bản {rev.revisionNumber}
                        {isLatest && (
                          <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium">
                            Hiện tại
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-ink-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(rev.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Diff block */}
                    <div className="p-3 rounded-2xl bg-ink-50/70 border border-ink-100 space-y-2 text-xs font-serif">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-sans font-semibold text-rose-700 uppercase tracking-wider block">
                          Trước:
                        </span>
                        <p className="text-rose-950 line-through opacity-75">
                          {rev.beforeText}
                        </p>
                      </div>

                      <div className="space-y-0.5 pt-1 border-t border-ink-100/60">
                        <span className="text-[10px] font-sans font-semibold text-emerald-700 uppercase tracking-wider block">
                          Sau:
                        </span>
                        <p className="text-emerald-950 font-medium">
                          {rev.afterText}
                        </p>
                      </div>

                      {/* Error tag & reason */}
                      <div className="pt-1.5 flex items-center justify-between font-sans text-[10px] border-t border-ink-100/60">
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold">
                          {ERROR_TYPE_LABELS[rev.errorTypeAfter] || rev.errorTypeAfter}
                        </span>
                        {rev.reasonAfter && (
                          <span className="text-ink-500 italic truncate max-w-[180px]">
                            {rev.reasonAfter}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-ink-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-ink-200 text-xs font-semibold hover:bg-ink-50 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
