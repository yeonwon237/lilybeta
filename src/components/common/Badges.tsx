import React from 'react';
import { ShieldCheck, UserCheck, CheckCircle2, Clock, FileText } from 'lucide-react';
import { BookStatus, UserRole } from '../../types';

export const RoleBadge: React.FC<{ role: UserRole; className?: string }> = ({ role, className = '' }) => {
  if (role === 'ADMIN') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
        <span>Quản trị viên</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 ${className}`}>
      <UserCheck className="w-3.5 h-3.5 text-purple-600" />
      <span>Beta Reader</span>
    </span>
  );
};

export const BookStatusBadge: React.FC<{ status: BookStatus; className?: string }> = ({ status, className = '' }) => {
  const map: Record<BookStatus, { label: string; bg: string; text: string; border: string }> = {
    DRAFT: { label: 'Chưa giao', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    ASSIGNED: { label: 'Đã giao', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    IN_BETA: { label: 'Đang Beta', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    BETA_COMPLETE: { label: 'Hoàn thành', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    ARCHIVED: { label: 'Lưu trữ', bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
  };

  const item = map[status] || map.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${item.bg} ${item.text} ${item.border} ${className}`}>
      <span>{item.label}</span>
    </span>
  );
};

export const FormatBadge: React.FC<{ 
  format?: 'TXT' | 'EPUB' | 'DOCX' | 'WEBSITE'; 
  variant?: 'default' | 'cover';
  className?: string 
}> = ({ format = 'TXT', variant = 'default', className = '' }) => {
  if (variant === 'cover') {
    return (
      <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-black/75 text-white border border-white/25 backdrop-blur-md ${className}`}>
        {format}
      </span>
    );
  }

  const formatStyles: Record<string, string> = {
    TXT: 'bg-ink-100 text-ink-900 border-ink-300',
    EPUB: 'bg-rose-100/90 text-rose-950 border-rose-300 font-bold',
    DOCX: 'bg-blue-100/90 text-blue-950 border-blue-300 font-bold',
    WEBSITE: 'bg-emerald-100/90 text-emerald-950 border-emerald-300 font-bold',
  };

  return (
    <span className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${formatStyles[format] || formatStyles.TXT} ${className}`}>
      {format}
    </span>
  );
};

export const ActiveBadge: React.FC<{ isActive: boolean; className?: string }> = ({ isActive, className = '' }) => {
  if (isActive) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>Hoạt động</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
      <span>Đã khóa</span>
    </span>
  );
};
