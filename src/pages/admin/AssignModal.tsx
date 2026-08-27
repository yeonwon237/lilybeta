import React, { useState, useEffect } from 'react';
import { User, X, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface AssignModalProps {
  isOpen: boolean;
  bookId: string | null;
  bookTitle: string;
  currentAssignedUserId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({
  isOpen,
  bookId,
  bookTitle,
  currentAssignedUserId,
  onClose,
  onSuccess,
}) => {
  const [readers, setReaders] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssignedUserId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(currentAssignedUserId || '');
      loadReaders();
    }
  }, [isOpen, currentAssignedUserId]);

  const loadReaders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ readers: any[] }>('/admin/beta-readers');
      // Filter active readers
      setReaders((res.readers || []).filter(r => r.isActive));
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách Beta Reader.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!bookId || !selectedUserId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(`/admin/books/${bookId}/assign`, { betaUserId: selectedUserId });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi giao tác phẩm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-modal border border-ink-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-semibold text-base text-ink-900">Giao tác phẩm cho Beta Reader</h3>
            <p className="text-xs text-ink-500 line-clamp-1">{bookTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-ink-700 rounded-full hover:bg-ink-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-ink-500">
              <Loader2 className="w-6 h-6 animate-spin text-lily-600" />
              <p className="text-xs">Đang tải danh sách Beta Reader...</p>
            </div>
          ) : readers.length === 0 ? (
            <div className="py-6 text-center text-ink-500 text-xs">
              Hiện chưa có tài khoản Beta Reader nào đang hoạt động.
              <br />
              Vui lòng tạo tài khoản Beta Reader trước.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-700">Chọn người phụ trách</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm bg-white"
              >
                <option value="">-- Chọn Beta Reader --</option>
                {readers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName} (@{r.username}) - đang phụ trách {r.assignedBooksCount || 0} truyện
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-100 bg-ink-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs text-ink-600 hover:text-ink-900"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={isSubmitting || !selectedUserId}
            className="px-5 py-2 text-xs font-medium text-white bg-lily-600 hover:bg-lily-700 rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang phân công...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Xác nhận giao truyện</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
