import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Book, ActivityLog } from '../../types';
import { BookCover } from '../../components/common/BookCover';
import { BookStatusBadge, FormatBadge, ActiveBadge, RoleBadge } from '../../components/common/Badges';
import { BookUploadModal } from './BookUploadModal';
import { AssignModal } from './AssignModal';
import { CreateReaderModal } from './CreateReaderModal';
import { 
  BookOpen, 
  Users, 
  History, 
  Plus, 
  UserPlus, 
  LogOut, 
  Trash2, 
  UserCheck, 
  UserX, 
  Loader2, 
  RefreshCw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'books' | 'readers' | 'logs'>('books');

  // Books state
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Readers state
  const [readers, setReaders] = useState<any[]>([]);
  const [isLoadingReaders, setIsLoadingReaders] = useState(false);
  const [isCreateReaderOpen, setIsCreateReaderOpen] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    bookId: string | null;
    bookTitle: string;
    currentAssignedUserId?: string;
  }>({
    isOpen: false,
    bookId: null,
    bookTitle: '',
  });

  const loadBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const res = await api.get<{ books: Book[] }>('/admin/books');
      setBooks(res.books || []);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const loadReaders = async () => {
    setIsLoadingReaders(true);
    try {
      const res = await api.get<{ readers: any[] }>('/admin/beta-readers');
      setReaders(res.readers || []);
    } catch (err) {
      console.error('Failed to load readers:', err);
    } finally {
      setIsLoadingReaders(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.get<{ logs: ActivityLog[] }>('/admin/logs');
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'books') loadBooks();
    if (activeTab === 'readers') loadReaders();
    if (activeTab === 'logs') loadLogs();
  }, [activeTab]);

  const handleDeleteBook = async (bookId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tác phẩm "${title}"? Mọi chương và tiến độ liên quan sẽ bị xóa vĩnh viễn.`)) {
      return;
    }
    try {
      await api.delete(`/admin/books/${bookId}`);
      loadBooks();
    } catch (err: any) {
      alert(err?.message || 'Không thể xóa truyện.');
    }
  };

  const handleToggleReaderStatus = async (readerId: string, currentStatus: boolean, username: string) => {
    const nextStatus = !currentStatus;
    const actionName = nextStatus ? 'mở khóa' : 'vô hiệu hóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản @${username}?`)) {
      return;
    }
    try {
      await api.patch(`/admin/beta-readers/${readerId}/status`, { isActive: nextStatus });
      loadReaders();
    } catch (err: any) {
      alert(err?.message || 'Không thể cập nhật trạng thái người dùng.');
    }
  };

  const handleRevokeAssignment = async (bookId: string, userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phân công này?')) return;
    try {
      await api.delete(`/admin/books/${bookId}/assign/${userId}`);
      loadBooks();
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi hủy phân công.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lily-100 text-lily-700 flex items-center justify-center font-bold font-serif">
              LB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base text-ink-900">LilyBeta</span>
                <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">Admin</span>
              </div>
              <p className="text-[11px] text-ink-400">Cổng Quản trị & Phân công Beta Reader</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-ink-800">{user?.displayName}</span>
              <span className="text-[10px] text-ink-400">@{user?.username}</span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-ink-500 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-ink-200/60 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('books')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'books'
                  ? 'bg-lily-600 text-white shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Tác phẩm ({books.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('readers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'readers'
                  ? 'bg-lily-600 text-white shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Beta Readers ({readers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'logs'
                  ? 'bg-lily-600 text-white shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Nhật ký</span>
            </button>
          </div>

          <div>
            {activeTab === 'books' && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lily-600 hover:bg-lily-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm tác phẩm mới</span>
              </button>
            )}

            {activeTab === 'readers' && (
              <button
                onClick={() => setIsCreateReaderOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lily-600 hover:bg-lily-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Cấp tài khoản mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Books */}
        {activeTab === 'books' && (
          <div className="space-y-4">
            {isLoadingBooks ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-500">
                <Loader2 className="w-7 h-7 animate-spin text-lily-600" />
                <p className="text-xs">Đang tải danh sách tác phẩm...</p>
              </div>
            ) : books.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-ink-100 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-lily-50 text-lily-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-base text-ink-900">Chưa có tác phẩm nào</h3>
                <p className="text-xs text-ink-500 max-w-sm mx-auto">
                  Hãy tải lên tệp TXT, EPUB hoặc DOCX để hệ thống tự động bóc tách chương và tạo truyện.
                </p>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lily-600 hover:bg-lily-700 text-white text-xs font-medium shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tải lên truyện đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {books.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-ink-100/70 shadow-2xs hover:shadow-soft transition flex flex-col justify-between space-y-4"
                  >
                    <div className="flex gap-4 items-start">
                      <BookCover
                        title={b.title}
                        author={b.author}
                        coverUrl={b.coverUrl}
                        coverColor={b.coverColor}
                        format={b.fileFormat}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <BookStatusBadge status={b.status} />
                          <FormatBadge format={b.fileFormat} />
                        </div>
                        <h4 className="font-serif font-bold text-sm text-ink-900 line-clamp-2 leading-snug">
                          {b.title}
                        </h4>
                        <p className="text-xs text-ink-500 line-clamp-1">{b.author}</p>
                        <p className="text-[11px] text-ink-400 font-mono">
                          {b.totalChapters} chương · {b.wordCount.toLocaleString('vi-VN')} chữ
                        </p>
                      </div>
                    </div>

                    {/* Assignment status */}
                    <div className="pt-3 border-t border-ink-100/60 flex items-center justify-between text-xs">
                      {b.assignedTo ? (
                        <div className="flex items-center gap-1.5 text-ink-700">
                          <span className="text-[11px] text-ink-400">Phụ trách:</span>
                          <span className="font-semibold text-lily-800 line-clamp-1">
                            {b.assignedTo.displayName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">
                          Chưa phân công
                        </span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setAssignModal({
                            isOpen: true,
                            bookId: b.id,
                            bookTitle: b.title,
                            currentAssignedUserId: b.assignedTo?.id,
                          })}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-lily-50 text-lily-700 hover:bg-lily-100 rounded-lg transition"
                        >
                          {b.assignedTo ? 'Đổi người' : 'Giao truyện'}
                        </button>

                        {b.assignedTo && (
                          <button
                            onClick={() => handleRevokeAssignment(b.id, b.assignedTo!.id)}
                            className="p-1 text-ink-400 hover:text-rose-600 rounded-md"
                            title="Hủy phân công"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteBook(b.id, b.title)}
                          className="p-1 text-ink-400 hover:text-rose-600 rounded-md"
                          title="Xóa truyện"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Beta Readers */}
        {activeTab === 'readers' && (
          <div className="bg-white rounded-3xl border border-ink-100 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-ink-900">Danh sách tài khoản Beta Reader</h3>
                <p className="text-xs text-ink-500">Quản lý và cấp quyền truy cập tác phẩm</p>
              </div>
              <button
                onClick={loadReaders}
                className="p-2 text-ink-400 hover:text-ink-700 rounded-xl"
                title="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoadingReaders ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-500">
                <Loader2 className="w-7 h-7 animate-spin text-lily-600" />
                <p className="text-xs">Đang tải danh sách người dùng...</p>
              </div>
            ) : readers.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-500 space-y-3">
                <p>Chưa có tài khoản Beta Reader nào trong hệ thống.</p>
                <button
                  onClick={() => setIsCreateReaderOpen(true)}
                  className="px-4 py-2 bg-lily-600 text-white rounded-xl text-xs font-medium"
                >
                  Cấp tài khoản đầu tiên
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50/50 text-ink-600 uppercase tracking-wider font-semibold border-b border-ink-100">
                    <tr>
                      <th className="px-6 py-3.5">Người dùng</th>
                      <th className="px-6 py-3.5">Tên đăng nhập</th>
                      <th className="px-6 py-3.5">Truyện phụ trách</th>
                      <th className="px-6 py-3.5">Trạng thái</th>
                      <th className="px-6 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {readers.map((r) => (
                      <tr key={r.id} className="hover:bg-ink-50/40">
                        <td className="px-6 py-4 font-semibold text-ink-900">{r.displayName}</td>
                        <td className="px-6 py-4 font-mono text-ink-600">@{r.username}</td>
                        <td className="px-6 py-4 text-ink-700">
                          <span className="font-semibold text-lily-700">{r.assignedBooksCount || 0}</span> truyện
                        </td>
                        <td className="px-6 py-4">
                          <ActiveBadge isActive={r.isActive} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggleReaderStatus(r.id, r.isActive, r.username)}
                            className={`px-3 py-1 rounded-lg font-medium transition ${
                              r.isActive
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {r.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Activity Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-3xl border border-ink-100 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-ink-900">Nhật ký hoạt động (Audit Logs)</h3>
                <p className="text-xs text-ink-500">Lưu vết các thao tác bảo mật và tiến trình đọc duyệt</p>
              </div>
              <button onClick={loadLogs} className="p-2 text-ink-400 hover:text-ink-700 rounded-xl">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-500">
                <Loader2 className="w-7 h-7 animate-spin text-lily-600" />
                <p className="text-xs">Đang tải nhật ký...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-500">Chưa có nhật ký ghi nhận.</div>
            ) : (
              <div className="divide-y divide-ink-100 text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 sm:px-6 flex items-start justify-between gap-4 hover:bg-ink-50/40">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-ink-100 text-ink-800">
                          {log.action}
                        </span>
                        <span className="font-medium text-ink-900">{log.userDisplayName || log.userName || log.userId}</span>
                        {log.bookTitle && (
                          <span className="text-ink-500">· {log.bookTitle}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-ink-500 font-mono text-[11px] line-clamp-1">{log.details}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-400 shrink-0 font-mono">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <BookUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => loadBooks()}
      />

      <AssignModal
        isOpen={assignModal.isOpen}
        bookId={assignModal.bookId}
        bookTitle={assignModal.bookTitle}
        currentAssignedUserId={assignModal.currentAssignedUserId}
        onClose={() => setAssignModal({ isOpen: false, bookId: null, bookTitle: '' })}
        onSuccess={() => loadBooks()}
      />

      <CreateReaderModal
        isOpen={isCreateReaderOpen}
        onClose={() => setIsCreateReaderOpen(false)}
        onSuccess={() => loadReaders()}
      />
    </div>
  );
};
