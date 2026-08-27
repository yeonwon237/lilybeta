import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Book, ActivityLog } from '../../types';
import { BookCover } from '../../components/common/BookCover';
import { BookStatusBadge, FormatBadge, ActiveBadge, RoleBadge } from '../../components/common/Badges';
import { BookUploadModal } from './BookUploadModal';
import { AssignModal } from './AssignModal';
import { CreateReaderModal } from './CreateReaderModal';
import { BetaEdit, ERROR_TYPE_LABELS } from '../../beta-edit/editTypes';
import { BetaCloudBookSource } from '../../book-engine/source/BetaCloudBookSource';
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
  ShieldCheck,
  Edit3,
  Clock,
  X
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

  const [editsModal, setEditsModal] = useState<{
    isOpen: boolean;
    bookId: string;
    bookTitle: string;
    edits: BetaEdit[];
    isLoading: boolean;
  }>({
    isOpen: false,
    bookId: '',
    bookTitle: '',
    edits: [],
    isLoading: false,
  });

  const handleOpenEditsModal = async (bookId: string, bookTitle: string) => {
    setEditsModal({
      isOpen: true,
      bookId,
      bookTitle,
      edits: [],
      isLoading: true,
    });

    try {
      const list = await BetaCloudBookSource.getInstance().getAdminBookEdits(bookId);
      setEditsModal(prev => ({ ...prev, edits: list, isLoading: false }));
    } catch (err) {
      console.error('Failed to load book edits:', err);
      setEditsModal(prev => ({ ...prev, isLoading: false }));
    }
  };

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

                    {/* Assignment status & progress */}
                    <div className="pt-3 border-t border-ink-100/60 space-y-2 text-xs">
                      {b.assignments && b.assignments.length > 0 ? (
                        <div className="space-y-1.5">
                          {b.assignments.map((a) => (
                            <div key={a.id} className="p-2 rounded-xl bg-ink-50/70 border border-ink-100/50 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-lily-800 line-clamp-1">
                                  {a.displayName} <span className="font-normal text-[10px] text-ink-400 font-mono">(@{a.username})</span>
                                </span>
                                <button
                                  onClick={() => handleRevokeAssignment(b.id, a.betaUserId)}
                                  className="p-1 text-ink-400 hover:text-rose-600 rounded-md"
                                  title="Hủy phân công"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-ink-600">
                                <span>Tiến độ: <strong className="text-purple-900 font-mono">{a.completedChaptersCount || 0}/{b.totalChapters}</strong> ({Math.round(a.overallPercentage || 0)}%)</span>
                                <span className="text-[10px] font-mono text-ink-500">Đang ở chương {a.currentChapterIndex || 1}</span>
                              </div>

                              <div className="w-full h-1 bg-ink-200/60 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-600 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, a.overallPercentage || 0))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">
                            Chưa phân công
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => setAssignModal({
                            isOpen: true,
                            bookId: b.id,
                            bookTitle: b.title,
                            currentAssignedUserId: b.assignedTo?.id,
                          })}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-lily-50 text-lily-700 hover:bg-lily-100 rounded-lg transition"
                        >
                          {b.assignments && b.assignments.length > 0 ? '+ Giao thêm người' : 'Giao truyện'}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditsModal(b.id, b.title)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition flex items-center gap-1"
                            title="Xem tất cả chỉnh sửa của Beta Readers"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Xem Edits</span>
                          </button>
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

      {/* Admin Edits Inspector Modal */}
      {editsModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditsModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-ink-100 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-ink-900 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-ink-950">
                    Bản chỉnh sửa Beta — {editsModal.bookTitle}
                  </h3>
                  <p className="text-xs text-ink-500">
                    Tổng cộng {editsModal.edits.length} đề xuất sửa từ các Beta Readers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditsModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {editsModal.isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-ink-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
                  <span className="text-xs">Đang tải danh sách chỉnh sửa...</span>
                </div>
              ) : editsModal.edits.length === 0 ? (
                <div className="text-center py-16 text-xs text-ink-400">
                  Chưa có chỉnh sửa nào từ các Beta Readers cho tác phẩm này.
                </div>
              ) : (
                editsModal.edits.map((edit) => (
                  <div key={edit.id} className="p-4 rounded-2xl border border-ink-100 bg-ink-50/40 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-900">
                          {edit.userDisplayName || edit.userName || 'Beta Reader'}
                        </span>
                        <span className="text-ink-400 font-mono text-[11px]">
                          Chương {edit.chapterIndex} · Đoạn {edit.paragraphIndex + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          {ERROR_TYPE_LABELS[edit.errorType] || edit.errorType}
                        </span>
                        <span className="text-[10px] text-ink-400 font-mono">
                          v{edit.version}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-serif">
                      <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 text-rose-950">
                        <span className="font-sans text-[10px] font-bold text-rose-700 block mb-0.5">Bản gốc:</span>
                        - {edit.originalText}
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-emerald-950 font-medium">
                        <span className="font-sans text-[10px] font-bold text-emerald-700 block mb-0.5">Đã sửa:</span>
                        + {edit.currentText}
                      </div>
                    </div>

                    {edit.reason && (
                      <p className="text-[11px] text-ink-600 italic">
                        Lý do: {edit.reason}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-ink-400 pt-1 border-t border-ink-100/60">
                      <span>Trạng thái: <strong className={edit.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}>{edit.status}</strong></span>
                      <span>{new Date(edit.updatedAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-ink-100 flex justify-end">
              <button
                onClick={() => setEditsModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-ink-100 hover:bg-ink-200 text-ink-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
