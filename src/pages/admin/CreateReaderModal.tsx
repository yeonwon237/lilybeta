import React, { useState } from 'react';
import { X, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface CreateReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateReaderModal: React.FC<CreateReaderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password.trim()) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/admin/beta-readers', {
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });

      setUsername('');
      setDisplayName('');
      setPassword('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo tài khoản Beta Reader.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-modal border border-ink-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-semibold text-base text-ink-900">Cấp tài khoản Beta Reader</h3>
            <p className="text-xs text-ink-500">Tài khoản được sử dụng để đăng nhập vào LilyBeta</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-ink-700 rounded-full hover:bg-ink-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-700">Tên hiển thị *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ví dụ: Linh Thảo, Hoàng Nam"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-700">Tên đăng nhập (Username) *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ví dụ: linh_beta, beta_01"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-700">Mật khẩu ban đầu *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-ink-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs text-ink-600 hover:text-ink-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-medium text-white bg-lily-600 hover:bg-lily-700 rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tạo tài khoản...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tạo tài khoản</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
