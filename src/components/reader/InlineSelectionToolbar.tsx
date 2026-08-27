import React, { useEffect, useState, useRef } from 'react';
import { Edit3, MessageSquare, AlertCircle } from 'lucide-react';

export interface SelectionRangeInfo {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  rect: DOMRect;
}

interface InlineSelectionToolbarProps {
  onOpenEdit: (range: SelectionRangeInfo) => void;
  onOpenNote: (range: SelectionRangeInfo) => void;
}

export const InlineSelectionToolbar: React.FC<InlineSelectionToolbarProps> = ({
  onOpenEdit,
  onOpenNote,
}) => {
  const [selectionInfo, setSelectionInfo] = useState<SelectionRangeInfo | null>(null);
  const [crossParagraphWarning, setCrossParagraphWarning] = useState<boolean>(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setSelectionInfo(null);
        setCrossParagraphWarning(false);
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length === 0) {
        setSelectionInfo(null);
        setCrossParagraphWarning(false);
        return;
      }

      const range = selection.getRangeAt(0);

      // Find the enclosing paragraph element
      const startNode = range.startContainer;
      const endNode = range.endContainer;

      const startPara = (startNode.nodeType === Node.ELEMENT_NODE ? startNode as HTMLElement : startNode.parentElement)?.closest('[data-paragraph-index]') as HTMLElement | null;
      const endPara = (endNode.nodeType === Node.ELEMENT_NODE ? endNode as HTMLElement : endNode.parentElement)?.closest('[data-paragraph-index]') as HTMLElement | null;

      if (!startPara || !endPara) {
        setSelectionInfo(null);
        setCrossParagraphWarning(false);
        return;
      }

      // Check single paragraph rule
      if (startPara !== endPara) {
        const rect = range.getBoundingClientRect();
        setSelectionInfo({
          paragraphIndex: -1,
          startOffset: 0,
          endOffset: 0,
          selectedText,
          rect,
        });
        setCrossParagraphWarning(true);
        return;
      }

      setCrossParagraphWarning(false);
      const pIndex = parseInt(startPara.getAttribute('data-paragraph-index') || '0', 10);
      const originalText = startPara.getAttribute('data-original-text') || startPara.textContent || '';

      // Compute UTF-16 offset relative to original paragraph text
      // We look up selectedText within originalText around cursor
      let startOffset = originalText.indexOf(selectedText);
      if (startOffset === -1) {
        // Fallback normalized match
        startOffset = originalText.toLowerCase().indexOf(selectedText.toLowerCase());
      }

      if (startOffset === -1) {
        setSelectionInfo(null);
        return;
      }

      const endOffset = startOffset + selectedText.length;
      const rect = range.getBoundingClientRect();

      setSelectionInfo({
        paragraphIndex: pIndex,
        startOffset,
        endOffset,
        selectedText,
        rect,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  if (!selectionInfo) return null;

  // Calculate coordinates (fixed viewport positioned)
  const top = Math.max(10, selectionInfo.rect.top - 48);
  const left = Math.min(
    window.innerWidth - 180,
    Math.max(10, selectionInfo.rect.left + selectionInfo.rect.width / 2 - 80)
  );

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.preventDefault()} // Prevent clearing selection
    >
      {crossParagraphWarning ? (
        <div className="bg-ink-950 text-white text-[11px] px-3 py-1.5 rounded-xl shadow-lg border border-white/10 flex items-center gap-1.5 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Chỉ chọn trong 1 đoạn văn</span>
        </div>
      ) : (
        <div className="bg-ink-950/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-white/15 p-1 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              onOpenEdit(selectionInfo);
              window.getSelection()?.removeAllRanges();
              setSelectionInfo(null);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/20 text-xs font-semibold transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-300" />
            <span>Sửa</span>
          </button>

          <div className="w-px h-3.5 bg-white/20" />

          <button
            type="button"
            onClick={() => {
              onOpenNote(selectionInfo);
              window.getSelection()?.removeAllRanges();
              setSelectionInfo(null);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/20 text-xs font-semibold transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
            <span>Ghi chú</span>
          </button>
        </div>
      )}
    </div>
  );
};
