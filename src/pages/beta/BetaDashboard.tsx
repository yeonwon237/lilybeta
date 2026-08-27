import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Book } from '../../types';
import { BookCover } from '../../components/common/BookCover';
import { FormatBadge, BookStatusBadge } from '../../components/common/Badges';
import { BookOpen, LogOut, Loader2, Clock, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

interface BetaDashboardProps {
  onSelectBook: (bookId: string) => void;
}

export const BetaDashboard: React.FC<BetaDashboardProps> = ({ onSelectBook }) => {
  const { user, logout } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignedBooks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ books: Book[] }>('/books');
      setBooks(res.books || []);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách truyện được giao.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedBooks();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold font-serif">
              LB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base text-ink-900">LilyBeta</span>
                <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">Beta Reader</span>
              </div>
              <p className="text-[11px] text-ink-400">Không gian đọc duyệt bản thảo</p>
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-purple-900/5 via-lily-500/5 to-purple-900/5 rounded-3xl p-6 sm:p-8 border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-800">
                Khu vực Beta Reader
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-ink-900">
              Chào mừng, {user?.displayName}!
            </h2>
            <p className="text-xs sm:text-sm text-ink-600">
              Bạn đang được phân công duyệt <span className="font-semibold text-purple-800">{books.length} tác phẩm</span>.
            </p>
          </div>

          <div className="px-4 py-2 rounded-xl bg-white/80 border border-purple-100 shadow-2xs text-xs text-ink-600">
            Dữ liệu chương được bảo mật tuyệt đối cho từng Beta Reader.
          </div>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-lg text-ink-900">Truyện được giao cho bạn</h3>
          <span className="text-xs text-ink-400">{books.length} tác phẩm</span>
        </div>

        {/* Assigned Books Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-ink-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-xs">Đang tải danh sách tác phẩm được giao...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-rose-100 text-rose-800 text-xs">
            {error}
          </div>
        ) : books.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-ink-100 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-base text-ink-900">Bạn chưa được giao tác phẩm nào</h4>
            <p className="text-xs text-ink-500 max-w-sm mx-auto">
              Khi Quản trị viên phân công bản thảo mới cho tài khoản của bạn, truyện sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {books.map((b) => (
              <div
                key={b.id}
                onClick={() => onSelectBook(b.id)}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-ink-100/70 shadow-2xs hover:shadow-soft transition cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="flex gap-4 sm:gap-5 items-start">
                  <BookCover
                    title={b.title}
                    author={b.author}
                    coverUrl={b.coverUrl}
                    coverColor={b.coverColor}
                    format={b.fileFormat}
                    size="md"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <FormatBadge format={b.fileFormat} />
                      <span className="text-[10px] text-ink-400 font-mono">
                        {b.totalChapters} chương · {b.wordCount.toLocaleString('vi-VN')} chữ
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-base text-ink-900 line-clamp-2 leading-snug group-hover:text-purple-700 transition">
                      {b.title}
                    </h4>

                    <p className="text-xs text-ink-500 line-clamp-1 italic">{b.author}</p>

                    {/* Reading Progress */}
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between text-[11px] text-ink-500">
                        <span>Tiến độ: Chương {b.currentChapter || 1}/{b.totalChapters}</span>
                        <span className="font-medium font-mono text-purple-700">
                          {Math.round(b.progressPercent || 0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, b.progressPercent || 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-ink-100 flex items-center justify-between text-xs">
                  <span className="text-ink-400 text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Đọc gần nhất: {b.lastReadAt ? new Date(b.lastReadAt).toLocaleDateString('vi-VN') : 'Chưa đọc'}
                  </span>

                  <button className="flex items-center gap-1 text-purple-700 font-semibold group-hover:translate-x-0.5 transition">
                    <span>Mở đọc bản thảo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
