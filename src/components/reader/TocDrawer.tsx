import React, { useState, useEffect, useRef } from 'react';
import { X, Search, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

export const TocDrawer: React.FC = () => {
  const { 
    book,
    isTocOpen, 
    setIsTocOpen, 
    currentChapterIndex, 
    totalChapters, 
    chapterList,
    workflowMap,
    jumpToChapter 
  } = useReader();

  const [search, setSearch] = useState('');
  const currentChapterRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to current chapter when TOC opens
  useEffect(() => {
    if (isTocOpen && currentChapterRef.current) {
      currentChapterRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }, [isTocOpen]);

  if (!isTocOpen) return null;

  const chapters = chapterList.length > 0 ? chapterList : Array.from({ length: totalChapters }, (_, i) => {
    const num = i + 1;
    return {
      index: num,
      title: `Chương ${num}`,
      wordCount: 1500,
      isRead: num < currentChapterIndex,
      isCurrent: num === currentChapterIndex,
      status: 'NOT_STARTED',
    };
  });

  const filtered = chapters.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.index.toString() === search.trim()
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-start bg-black/30 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsTocOpen(false)}
    >
      <div 
        className="w-full max-w-sm h-full bg-white shadow-modal border-r border-ink-100 p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-ink-100">
            <div>
              <h3 className="font-serif font-bold text-base text-ink-900">
                Mục lục chương
              </h3>
              <p className="text-xs text-ink-500 mt-0.5 truncate max-w-[220px]">
                {book?.title}
              </p>
            </div>
            <button
              onClick={() => setIsTocOpen(false)}
              className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workflow Status Legend */}
          <div className="flex items-center gap-3 text-[11px] text-ink-500 bg-ink-50 p-2 rounded-xl">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đã beta</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <span>Đang đọc</span>
            </span>
            <span className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-ink-300" />
              <span>Chưa đọc</span>
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc số chương..."
              className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-ink-200 text-xs focus:border-purple-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1 my-2 divide-y divide-ink-50">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-ink-400">
              Không tìm thấy chương nào
            </div>
          ) : (
            filtered.map((c) => {
              const wf = workflowMap[c.index] || {};
              const status = wf.status || c.status || 'NOT_STARTED';
              const isCurrent = c.index === currentChapterIndex;
              const isCompleted = status === 'COMPLETED';

              return (
                <div
                  key={c.index}
                  ref={isCurrent ? currentChapterRef : null}
                  onClick={() => jumpToChapter(c.index)}
                  className={`px-3 py-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                    isCurrent 
                      ? 'bg-purple-50 text-purple-900 font-bold border border-purple-200/80 shadow-2xs' 
                      : 'text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {/* Status Icon */}
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0 animate-pulse" />
                    ) : status === 'IN_PROGRESS' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-ink-300 shrink-0" />
                    )}

                    <span className="truncate">
                      {c.title}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-ink-400 shrink-0">
                    {c.wordCount ? `${c.wordCount.toLocaleString('vi-VN')} chữ` : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-[11px] text-ink-400">
          <span>Tổng số: {totalChapters} chương</span>
          <span className="text-purple-700 font-semibold font-mono">
            {book?.completedChaptersCount || 0}/{totalChapters} đã hoàn thành
          </span>
        </div>
      </div>
    </div>
  );
};
