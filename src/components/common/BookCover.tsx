import React, { useState } from 'react';
import { FormatBadge } from './Badges';

interface BookCoverProps {
  title: string;
  author?: string;
  coverUrl?: string;
  coverColor?: string;
  format?: 'TXT' | 'EPUB' | 'DOCX' | 'WEBSITE';
  size?: 'sm' | 'md' | 'lg' | 'responsive';
  className?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  coverUrl,
  coverColor = '#D9829B',
  format,
  size = 'md',
  className = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !imageFailed;

  const sizeClasses = {
    sm: 'w-14 h-20 text-[10px]',
    md: 'w-24 sm:w-28 h-36 sm:h-40 text-xs',
    lg: 'w-32 sm:w-36 h-48 sm:h-52 text-sm',
    responsive: 'w-full aspect-[2/3] text-xs sm:text-sm',
  }[size];

  return (
    <div
      className={`relative rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden shrink-0 select-none ${sizeClasses} ${className}`}
      style={{ backgroundColor: coverColor }}
    >
      {showImage ? (
        <img
          src={coverUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 p-2.5 sm:p-3 flex flex-col justify-between bg-gradient-to-br from-white/20 via-transparent to-black/40">
          <div className="flex justify-between items-start">
            <span className="text-white/80 text-[9px] font-mono tracking-widest uppercase font-semibold">LILY BETA</span>
            {format && <FormatBadge format={format} variant="cover" />}
          </div>
          <div className="space-y-0.5">
            <h4 className="font-serif font-bold text-white line-clamp-3 leading-snug drop-shadow-sm text-xs sm:text-sm">
              {title}
            </h4>
            {author && (
              <p className="text-white/90 text-[10px] sm:text-[11px] line-clamp-1 italic">
                {author}
              </p>
            )}
          </div>
          <div className="w-4 h-0.5 bg-white/40 rounded-full" />
        </div>
      )}

      {showImage && format && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <FormatBadge format={format} variant="cover" />
        </div>
      )}

      <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl pointer-events-none" />
    </div>
  );
};
