import React from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { useReader } from '../../context/ReaderContext';
import { ReaderPageWidth, ReadingPresetId, ReaderFontFamily } from '../../types';

export const AaSettingsSheet: React.FC = () => {
  const { 
    isAaPanelOpen, 
    setIsAaPanelOpen, 
    settings, 
    updateSetting, 
    applyPreset 
  } = useReader();

  if (!isAaPanelOpen) return null;

  const fontGroups: { groupName: string; fonts: { id: ReaderFontFamily; name: string; desc: string }[] }[] = [
    {
      groupName: 'Phông sách (Serif)',
      fonts: [
        { id: 'Literata', name: 'Literata', desc: 'Tao nhã, êm mắt khi đọc lâu' },
        { id: 'Merriweather', name: 'Merriweather', desc: 'Cổ điển, nét chữ rõ ràng' },
        { id: 'Playfair Display', name: 'Playfair', desc: 'Văn học cung đình' },
      ]
    },
    {
      groupName: 'Hiện đại (Sans-serif)',
      fonts: [
        { id: 'Be Vietnam Pro', name: 'Be Vietnam Pro', desc: 'Thuần Việt, hiện đại' },
        { id: 'Inter', name: 'Inter', desc: 'Tối giản, trung tính' },
      ]
    }
  ];

  const presets: { id: ReadingPresetId; label: string; desc: string }[] = [
    { id: 'thoai-mai', label: 'Thoải mái', desc: 'Literata · Giãn 1.85 · Lề vừa' },
    { id: 'gon-gang', label: 'Gọn gàng', desc: 'Be Vietnam Pro · Cỡ 17 · Lề hẹp' },
    { id: 'sach-giay', label: 'Sách giấy', desc: 'Merriweather · Căn đều · Giấy in' },
    { id: 'doc-dem', label: 'Đọc đêm', desc: 'Literata · Nền tối dịu · Giảm mỏi mắt' },
  ];

  const pageWidthOptions: { id: ReaderPageWidth; label: string }[] = [
    { id: 'narrow', label: 'Hẹp' },
    { id: 'normal', label: 'Vừa' },
    { id: 'wide', label: 'Rộng' },
    { id: 'full', label: 'Toàn màn' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsAaPanelOpen(false)}
    >
      <div 
        className="w-full max-w-xl bg-white rounded-t-3xl shadow-modal border-t border-ink-100 p-5 md:p-6 max-h-[85vh] overflow-y-auto space-y-6 animate-in slide-in-from-bottom duration-200 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <h3 className="font-serif font-bold text-base text-ink-900">
            Tùy chỉnh đọc sách & Chữ
          </h3>
          <button
            onClick={() => setIsAaPanelOpen(false)}
            className="p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-ink-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Quick Presets */}
        <div>
          <h4 className="text-xs font-semibold text-ink-600 uppercase tracking-wider mb-2.5">
            Cấu hình mẫu nhanh
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const isSelected = settings.selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`p-3 rounded-2xl text-left border transition relative ${
                    isSelected 
                      ? 'border-purple-600 bg-purple-50/70' 
                      : 'border-ink-200/70 hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink-900">{p.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-700" />}
                  </div>
                  <p className="text-[10px] text-ink-500 mt-1 line-clamp-1">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Font Size Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-600 uppercase tracking-wider">Cỡ chữ</span>
            <span className="font-mono font-bold text-purple-800">{settings.fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-serif">A</span>
            <input
              type="range"
              min="14"
              max="28"
              step="1"
              value={settings.fontSize}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value, 10))}
              className="flex-1 accent-purple-700 h-1.5 bg-ink-200 rounded-lg cursor-pointer"
            />
            <span className="text-lg font-serif font-bold">A</span>
          </div>
        </div>

        {/* 3. Line Height & Paragraph Spacing */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-600 uppercase tracking-wider">Giãn dòng</span>
              <span className="font-mono">{settings.lineHeight}</span>
            </div>
            <div className="flex gap-1.5">
              {[1.6, 1.85, 2.1].map((lh) => (
                <button
                  key={lh}
                  onClick={() => updateSetting('lineHeight', lh)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-medium border transition ${
                    settings.lineHeight === lh 
                      ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold' 
                      : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-600 uppercase tracking-wider">Khổ đọc</span>
              <span className="font-mono text-ink-500 capitalize">{settings.pageWidth}</span>
            </div>
            <div className="flex gap-1">
              {pageWidthOptions.map((pw) => (
                <button
                  key={pw.id}
                  onClick={() => updateSetting('pageWidth', pw.id)}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium border transition ${
                    settings.pageWidth === pw.id 
                      ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold' 
                      : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  {pw.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Font Family Selector */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-ink-600 uppercase tracking-wider">
            Phông chữ tiếng Việt
          </h4>
          <div className="space-y-3">
            {fontGroups.map((group) => (
              <div key={group.groupName} className="space-y-1.5">
                <span className="text-[11px] font-medium text-ink-400">{group.groupName}</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {group.fonts.map((f) => {
                    const isSelected = settings.fontFamily === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => updateSetting('fontFamily', f.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected 
                            ? 'border-purple-600 bg-purple-50/80 shadow-2xs' 
                            : 'border-ink-200/70 hover:bg-ink-50'
                        }`}
                        style={{ fontFamily: f.id }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{f.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-purple-700" />}
                        </div>
                        <p className="text-[10px] text-ink-500 line-clamp-1 font-sans">{f.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Indent & Align */}
        <div className="flex items-center justify-between pt-2 border-t border-ink-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-600">Lùi đầu dòng:</span>
            <button
              onClick={() => updateSetting('firstLineIndent', !settings.firstLineIndent)}
              className={`px-3 py-1 rounded-lg border font-medium transition ${
                settings.firstLineIndent 
                  ? 'bg-purple-50 border-purple-600 text-purple-900' 
                  : 'border-ink-200 text-ink-500'
              }`}
            >
              {settings.firstLineIndent ? 'Bật (thụt lề)' : 'Tắt'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-600">Căn lề:</span>
            <button
              onClick={() => updateSetting('textAlign', settings.textAlign === 'left' ? 'justify' : 'left')}
              className="px-3 py-1 rounded-lg border border-ink-200 hover:bg-ink-50 font-medium capitalize"
            >
              {settings.textAlign === 'justify' ? 'Căn đều' : 'Căn trái'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
