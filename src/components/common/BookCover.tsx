import React, { useState } from 'react';
import { FormatBadge } from './Badges';

interface BookCoverProps {
  title: string;
  author?: string;
  coverUrl?: string;
  coverColor?: string;
  format?: 'TXT' | 'EPUB' | 'DOCX' | 'WEBSITE';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'responsive';
  className?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  coverUrl,
  coverColor = '#9A3412', // Warm literary terracotta default
  format,
  size = 'md',
  className = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !imageFailed;

  const sizeClasses = {
    xs: 'w-12 h-16 text-[9px] rounded-md',
    sm: 'w-16 h-24 sm:w-20 sm:h-28 text-[10px] rounded-lg',
    md: 'w-24 sm:w-28 h-36 sm:h-42 text-xs rounded-xl',
    lg: 'w-32 sm:w-36 h-48 sm:h-54 text-sm rounded-xl',
    responsive: 'w-full aspect-[2/3] text-xs sm:text-sm rounded-xl',
  }[size];

  return (
    <div
      className={`relative shadow-md shadow-ink-950/15 group-hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shrink-0 select-none ${sizeClasses} ${className}`}
      style={{ backgroundColor: coverColor }}
    >
      {/* 3D Realistic Book Spine Lighting Effects */}
      {/* Spine dark gradient on the left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/40 via-black/15 to-transparent z-20 pointer-events-none" />
      {/* Spine crease line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/15 z-20 pointer-events-none" />
      {/* Right page-turn subtle sheen */}
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-l from-white/20 to-transparent z-20 pointer-events-none" />

      {showImage ? (
        <img
          src={coverUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 p-2 sm:p-2.5 flex flex-col justify-between bg-gradient-to-br from-white/15 via-transparent to-black/50 z-10">
          <div className="flex justify-between items-start pl-1">
            <span className="text-white/85 text-[8px] sm:text-[9px] font-mono tracking-widest uppercase font-bold">
              LILY BETA
            </span>
            {format && <FormatBadge format={format} variant="cover" />}
          </div>

          <div className="space-y-0.5 pl-1">
            <h4 className="font-serif font-bold text-white line-clamp-3 leading-snug drop-shadow-md text-[11px] sm:text-xs">
              {title}
            </h4>
            {author && (
              <p className="text-white/90 text-[9px] sm:text-[10px] line-clamp-1 italic font-serif">
                {author}
              </p>
            )}
          </div>

          <div className="w-5 h-0.5 bg-white/50 rounded-full pl-1 mb-0.5" />
        </div>
      )}

      {showImage && format && (
        <div className="absolute top-1.5 right-1.5 z-20">
          <FormatBadge format={format} variant="cover" />
        </div>
      )}

      {/* Outer subtle bezel */}
      <div className="absolute inset-0 ring-1 ring-inset ring-black/15 rounded-[inherit] pointer-events-none z-30" />
    </div>
  );
};
