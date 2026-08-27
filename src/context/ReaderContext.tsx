import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { 
  Book, 
  Chapter, 
  ReaderSettings, 
  ReaderThemeOption, 
  ReadingPresetId, 
  ChapterWorkflowStatus 
} from '../types';
import { BetaCloudBookSource } from '../book-engine/source/BetaCloudBookSource';
import { useAuth } from './AuthContext';

export const ALL_READER_THEMES: ReaderThemeOption[] = [
  { id: 'theme-paper', name: 'Giấy in', className: 'reader-theme-paper', previewBg: '#F8F5EC', previewText: '#2B2621', description: 'Màu giấy in sách truyền thống' },
  { id: 'theme-cream', name: 'Kem', className: 'reader-theme-cream', previewBg: '#FAF7F0', previewText: '#2C261F', description: 'Ấm áp, êm mắt ban ngày' },
  { id: 'theme-white', name: 'Trắng', className: 'reader-theme-white', previewBg: '#FFFFFF', previewText: '#1F1C18', description: 'Sáng rõ, tối giản tiêu chuẩn' },
  { id: 'theme-gray', name: 'Xám', className: 'reader-theme-gray', previewBg: '#ECEEEF', previewText: '#202326', description: 'Tối giản hiện đại' },
  { id: 'theme-night', name: 'Đêm', className: 'reader-theme-night', previewBg: '#1A1A1D', previewText: '#D0D0D5', description: 'Bảo vệ mắt trong phòng tối' },
  { id: 'theme-lily', name: 'Hồng Lily', className: 'reader-theme-lily', previewBg: '#FCF4F7', previewText: '#2D1E26', description: 'Hồng phấn mềm mại đặc trưng Lily' },
  { id: 'theme-warm', name: 'Hổ phách', className: 'reader-theme-warm', previewBg: '#FAF2E6', previewText: '#362A1F', description: 'Ánh đèn vàng thư phòng' },
  { id: 'theme-matcha', name: 'Lá trà', className: 'reader-theme-matcha', previewBg: '#F0F4ED', previewText: '#1E2B1F', description: 'Màu trà xanh dịu êm cho thị giác' },
  { id: 'theme-moon', name: 'Ánh trăng', className: 'reader-theme-moon', previewBg: '#22252A', previewText: '#DCE0E6', description: 'Màn đêm ánh trăng dịu' },
  { id: 'theme-oled', name: 'Đen sâu', className: 'reader-theme-oled', previewBg: '#000000', previewText: '#CFCFCF', description: 'Đen tuyệt đối tiết kiệm pin' },
  { id: 'theme-vintage', name: 'Nâu cổ', className: 'reader-theme-vintage', previewBg: '#EAE1D2', previewText: '#2A241C', description: 'Phong vị trang sách hoài niệm' },
  { id: 'theme-ancient', name: 'Thư tịch', className: 'reader-theme-ancient', previewBg: '#382F28', previewText: '#E5DCD1', description: 'Trầm mặc phong vị thư tịch cổ' },
];

const SETTINGS_STORAGE_KEY = 'lilybeta_reader_settings_v2';

const defaultSettings: ReaderSettings = {
  fontFamily: 'Literata',
  fontSize: 18,
  fontWeight: 'normal',
  lineHeight: 1.85,
  paragraphSpacing: 1.2,
  pageWidth: 'normal',
  marginHorizontal: 24,
  textAlign: 'left',
  firstLineIndent: true,
  readingMode: 'scroll',
  activeThemeId: 'theme-paper',
  selectedPreset: 'thoai-mai',
};

const loadPersistedSettings = (): ReaderSettings => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    }
  } catch {}
  return defaultSettings;
};

interface ReaderContextType {
  book: Book | null;
  currentChapterIndex: number;
  currentChapter: Chapter | null;
  totalChapters: number;
  chapterList: Array<{ index: number; title: string; wordCount: number; isRead: boolean; isCurrent: boolean; status?: string; completedAt?: string }>;
  workflowMap: Record<number, { status: string; startedAt?: string; completedAt?: string }>;
  settings: ReaderSettings;
  activeTheme: ReaderThemeOption;
  isLoadingChapter: boolean;
  readerError: string | null;
  isToolbarVisible: boolean;
  isAaPanelOpen: boolean;
  isThemePanelOpen: boolean;
  isTocOpen: boolean;
  isConfirmCompleteOpen: boolean;
  isAutosaving: boolean;
  lastSavedText: string | null;

  // Actions
  initReader: (bookId: string, chapterIndex?: number) => Promise<void>;
  loadChapter: (chapterIndex: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  jumpToChapter: (index: number) => Promise<void>;
  toggleToolbar: () => void;
  updateSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  applyPreset: (presetId: ReadingPresetId) => void;
  markCurrentChapterCompleted: () => Promise<void>;
  triggerAutosave: (scrollPercent: number, scrollOffset: number) => void;
  setIsAaPanelOpen: (open: boolean) => void;
  setIsThemePanelOpen: (open: boolean) => void;
  setIsTocOpen: (open: boolean) => void;
  setIsConfirmCompleteOpen: (open: boolean) => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export const ReaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const source = BetaCloudBookSource.getInstance();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(1);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [totalChapters, setTotalChapters] = useState<number>(1);
  const [chapterList, setChapterList] = useState<any[]>([]);
  const [workflowMap, setWorkflowMap] = useState<Record<number, any>>({});
  const [settings, setSettings] = useState<ReaderSettings>(loadPersistedSettings);
  const [isLoadingChapter, setIsLoadingChapter] = useState<boolean>(true);
  const [readerError, setReaderError] = useState<string | null>(null);

  // Floating panels state
  const [isToolbarVisible, setIsToolbarVisible] = useState<boolean>(false);
  const [isAaPanelOpen, setIsAaPanelOpen] = useState<boolean>(false);
  const [isThemePanelOpen, setIsThemePanelOpen] = useState<boolean>(false);
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState<boolean>(false);

  // Autosave state
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);
  const [lastSavedText, setLastSavedText] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const activeTheme = ALL_READER_THEMES.find(t => t.id === settings.activeThemeId) || ALL_READER_THEMES[0];

  // Persist settings changes
  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const applyPreset = (presetId: ReadingPresetId) => {
    let presetOverrides: Partial<ReaderSettings> = {};
    switch (presetId) {
      case 'thoai-mai':
        presetOverrides = { fontFamily: 'Literata', fontSize: 18, lineHeight: 1.85, paragraphSpacing: 1.2, marginHorizontal: 24, textAlign: 'left', activeThemeId: 'theme-paper' };
        break;
      case 'gon-gang':
        presetOverrides = { fontFamily: 'Be Vietnam Pro', fontSize: 17, lineHeight: 1.7, paragraphSpacing: 1.0, marginHorizontal: 16, textAlign: 'left', activeThemeId: 'theme-cream' };
        break;
      case 'sach-giay':
        presetOverrides = { fontFamily: 'Merriweather', fontSize: 18, lineHeight: 1.9, paragraphSpacing: 1.2, marginHorizontal: 28, textAlign: 'justify', activeThemeId: 'theme-vintage' };
        break;
      case 'doc-dem':
        presetOverrides = { fontFamily: 'Literata', fontSize: 18, lineHeight: 1.85, paragraphSpacing: 1.2, marginHorizontal: 24, textAlign: 'left', activeThemeId: 'theme-night' };
        break;
    }
    setSettings(prev => {
      const next = { ...prev, ...presetOverrides, selectedPreset: presetId };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Load Book & Workflow
  const initReader = async (bookId: string, targetChapter?: number) => {
    setIsLoadingChapter(true);
    setReaderError(null);

    try {
      const loadedBook = await source.getBook(bookId);
      if (!loadedBook) {
        setReaderError('Bạn không có quyền truy cập tác phẩm này hoặc tác phẩm không tồn tại.');
        setIsLoadingChapter(false);
        return;
      }

      setBook(loadedBook);
      setTotalChapters(loadedBook.totalChapters || 1);

      const [toc, workflow] = await Promise.all([
        source.getChapterList(bookId),
        source.getChapterWorkflow(bookId),
      ]);

      setChapterList(toc);
      setWorkflowMap(workflow);

      const chapterToOpen = targetChapter && targetChapter >= 1 ? targetChapter : (loadedBook.currentChapter || 1);
      await loadChapterInternal(bookId, chapterToOpen, loadedBook.totalChapters || 1);
    } catch (err: any) {
      setReaderError(err?.message || 'Không thể tải dữ liệu đọc bản thảo.');
    } finally {
      setIsLoadingChapter(false);
    }
  };

  const loadChapterInternal = async (bookId: string, chapterIndex: number, total: number) => {
    setIsLoadingChapter(true);
    setReaderError(null);

    try {
      const ch = await source.getChapter(bookId, chapterIndex);
      if (!ch) {
        setReaderError('Không tìm thấy nội dung chương này.');
        return;
      }

      setCurrentChapter(ch);
      setCurrentChapterIndex(chapterIndex);

      // Update chapterList isCurrent & isRead
      setChapterList(prev => prev.map(item => ({
        ...item,
        isCurrent: item.index === chapterIndex,
        isRead: item.index < chapterIndex || item.status === 'COMPLETED',
      })));

      // Update local workflowMap if newly started
      setWorkflowMap(prev => {
        const existing = prev[chapterIndex];
        if (!existing || existing.status === 'NOT_STARTED') {
          return {
            ...prev,
            [chapterIndex]: { status: 'IN_PROGRESS', startedAt: new Date().toISOString() },
          };
        }
        return prev;
      });

      // Restore scroll position
      const targetScroll = ch.lastScrollPercent || 0;
      setTimeout(() => {
        if (targetScroll > 0) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: (targetScroll / 100) * maxScroll, behavior: 'instant' });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 50);

    } catch (err: any) {
      setReaderError(err?.message || 'Lỗi khi tải chương.');
    } finally {
      setIsLoadingChapter(false);
    }
  };

  const loadChapter = async (chapterIndex: number) => {
    if (!book) return;
    await loadChapterInternal(book.id, chapterIndex, totalChapters);
  };

  const nextChapter = async () => {
    if (!book || currentChapterIndex >= totalChapters) return;
    await loadChapter(currentChapterIndex + 1);
  };

  const prevChapter = async () => {
    if (!book || currentChapterIndex <= 1) return;
    await loadChapter(currentChapterIndex - 1);
  };

  const jumpToChapter = async (index: number) => {
    setIsTocOpen(false);
    await loadChapter(index);
  };

  const toggleToolbar = () => {
    setIsToolbarVisible(v => !v);
  };

  // Debounced cloud autosave (1 second debounce)
  const triggerAutosave = useCallback((scrollPercent: number, scrollOffset: number) => {
    if (!book || !currentChapter) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setIsAutosaving(true);
        const overallPercent = Math.min(100, Math.round((currentChapterIndex / totalChapters) * 100));
        await source.saveProgress(
          book.id,
          currentChapterIndex,
          overallPercent,
          currentChapter.title,
          scrollPercent,
          scrollOffset
        );
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setLastSavedText(`Đã lưu lúc ${nowStr}`);
      } catch (err) {
        console.warn('Autosave progress failed:', err);
      } finally {
        setIsAutosaving(false);
      }
    }, 1000);
  }, [book, currentChapter, currentChapterIndex, totalChapters, source]);

  // Mark current chapter as completed
  const markCurrentChapterCompleted = async () => {
    if (!book) return;

    try {
      const res = await source.completeChapter(book.id, currentChapterIndex);

      // Update workflowMap
      setWorkflowMap(prev => ({
        ...prev,
        [currentChapterIndex]: {
          status: 'COMPLETED',
          completedAt: res.completedAt,
        },
      }));

      // Update chapterList
      setChapterList(prev => prev.map(ch => ch.index === currentChapterIndex ? {
        ...ch,
        status: 'COMPLETED',
        completedAt: res.completedAt,
        isRead: true,
      } : ch));

      // Update book completed count
      setBook(prev => prev ? {
        ...prev,
        completedChaptersCount: res.completedChaptersCount,
        progressPercent: res.overallPercentage,
      } : null);

      setIsConfirmCompleteOpen(false);

    } catch (err: any) {
      alert(err?.message || 'Không thể hoàn thành chương.');
    }
  };

  return (
    <ReaderContext.Provider
      value={{
        book,
        currentChapterIndex,
        currentChapter,
        totalChapters,
        chapterList,
        workflowMap,
        settings,
        activeTheme,
        isLoadingChapter,
        readerError,
        isToolbarVisible,
        isAaPanelOpen,
        isThemePanelOpen,
        isTocOpen,
        isConfirmCompleteOpen,
        isAutosaving,
        lastSavedText,
        initReader,
        loadChapter,
        nextChapter,
        prevChapter,
        jumpToChapter,
        toggleToolbar,
        updateSetting,
        applyPreset,
        markCurrentChapterCompleted,
        triggerAutosave,
        setIsAaPanelOpen,
        setIsThemePanelOpen,
        setIsTocOpen,
        setIsConfirmCompleteOpen,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
};

export const useReader = () => {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
};
