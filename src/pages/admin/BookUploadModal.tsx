import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { BookImporter } from '../../book-engine/importers';
import { ParsedBookDraft, SupportedFormat } from '../../book-engine/types';
import { BetaCloudBookSource } from '../../book-engine/source/BetaCloudBookSource';
import { FormatBadge } from '../../components/common/Badges';

interface BookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookUploadModal: React.FC<BookUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedBookDraft | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverColor, setCoverColor] = useState('#D9829B');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setIsParsing(true);

    try {
      const parsedDraft = await BookImporter.parse(selectedFile);
      setDraft(parsedDraft);
      setTitle(parsedDraft.title);
      setAuthor(parsedDraft.author);
      setCoverColor(parsedDraft.suggestedCoverColor || '#D9829B');
    } catch (err: any) {
      setError(err?.message || 'Không thể phân tích tệp truyện này.');
      setDraft(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !title.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const source = BetaCloudBookSource.getInstance();
      await source.saveBook(draft, {
        title: title.trim(),
        author: author.trim() || 'Chưa rõ tác giả',
        coverColor,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi lưu truyện vào cơ sở dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  };

  const colors = ['#D9829B', '#C74A7C', '#706248', '#5B3584', '#342F29', '#2E5B88', '#2E7D52'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-modal border border-ink-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-serif font-bold text-lg text-ink-900">Nhập truyện bản thảo mới</h3>
            <p className="text-xs text-ink-500">Hỗ trợ các định dạng TXT, EPUB, DOCX</p>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400 hover:text-ink-700 rounded-full hover:bg-ink-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!draft ? (
            /* File Picker Area */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isParsing ? 'border-lily-300 bg-lily-50/50' : 'border-ink-200 hover:border-lily-400 hover:bg-ink-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />

              {isParsing ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-8 h-8 text-lily-600 animate-spin" />
                  <p className="text-sm font-medium text-ink-700">Đang quét cấu trúc chương và làm sạch văn bản...</p>
                  <p className="text-xs text-ink-400">ChapterDetector đang phân tích tiêu đề và định dạng</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-lily-100 text-lily-600 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Bấm để chọn tệp truyện hoặc kéo thả vào đây</p>
                    <p className="text-xs text-ink-500 mt-1">Định dạng hỗ trợ: .TXT, .EPUB, .DOCX</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Draft Preview & Edit */
            <div className="space-y-6">
              {/* Parse diagnostics card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-900">
                    Phân tích thành công {draft.totalChapters} chương ({draft.wordCount.toLocaleString('vi-VN')} chữ)
                  </p>
                  <p className="text-emerald-700">
                    Tệp: <span className="font-mono font-medium">{draft.originalFileName}</span> ({draft.fileSizeMB} MB) · Định dạng: {draft.fileFormat} · Độ tin cậy: {draft.confidence}
                  </p>
                </div>
              </div>

              {/* Editable metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-ink-700">Tên tác phẩm *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-700">Tác giả</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-lily-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-700">Màu bìa</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCoverColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-full transition ${coverColor === c ? 'ring-2 ring-offset-2 ring-ink-800 scale-110' : 'opacity-80 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Chapter preview list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                    Xem trước một số chương đầu ({Math.min(5, draft.chapters.length)}/{draft.totalChapters})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setFile(null);
                    }}
                    className="text-xs text-lily-600 hover:underline"
                  >
                    Chọn tệp khác
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100 text-xs">
                  {draft.chapters.slice(0, 5).map((ch) => (
                    <div key={ch.index} className="p-2.5 flex items-center justify-between bg-white hover:bg-ink-50">
                      <span className="font-medium text-ink-800 line-clamp-1">{ch.title}</span>
                      <span className="text-ink-400 font-mono text-[11px] shrink-0 ml-2">{ch.wordCount.toLocaleString('vi-VN')} chữ</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-100 bg-ink-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-ink-600 hover:text-ink-900 rounded-xl"
          >
            Hủy
          </button>

          {draft && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-lily-600 hover:bg-lily-700 rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu vào Cloud...</span>
                </>
              ) : (
                <span>Lưu truyện vào hệ thống</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
