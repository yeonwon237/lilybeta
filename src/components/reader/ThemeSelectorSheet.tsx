import React from 'react';
import { X, Check } from 'lucide-react';
import { useReader, ALL_READER_THEMES } from '../../context/ReaderContext';

export const ThemeSelectorSheet: React.FC = () => {
  const { 
    isThemePanelOpen, 
    setIsThemePanelOpen, 
    settings, 
    updateSetting 
  } = useReader();

  if (!isThemePanelOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsThemePanelOpen(false)}
    >
      <div 
        className="w-full max-w-xl bg-white rounded-t-3xl shadow-modal border-t border-ink-100 p-5 md:p-6 max-h-[85vh] overflow-y-auto space-y-5 animate-in slide-in-from-bottom duration-200 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <h3 className="font-serif font-bold text-base text-ink-900">
            Không gian đọc (12 Themes)
          </h3>
          <button
            onClick={() => setIsThemePanelOpen(false)}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Themes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ALL_READER_THEMES.map((t) => {
            const isSelected = settings.activeThemeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateSetting('activeThemeId', t.id)}
                className={`p-3 rounded-2xl text-left border transition relative flex flex-col justify-between h-24 ${
                  isSelected 
                    ? 'border-purple-600 ring-2 ring-purple-600/30 shadow-sm' 
                    : 'border-ink-200/80 hover:border-ink-400'
                }`}
                style={{ backgroundColor: t.previewBg }}
              >
                <div className="flex items-center justify-between w-full">
                  <span 
                    className="font-bold text-xs"
                    style={{ color: t.previewText }}
                  >
                    {t.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-purple-700 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <p 
                  className="text-[10px] line-clamp-2 opacity-75 font-serif leading-tight"
                  style={{ color: t.previewText }}
                >
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
