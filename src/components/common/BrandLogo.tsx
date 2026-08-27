import React from 'react';

interface BrandLogoProps {
  badge?: string;
  badgeVariant?: 'admin' | 'reader' | 'default';
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  badge,
  badgeVariant = 'default',
  subtitle,
  className = '',
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl',
  }[size];

  const badgeStyles = {
    admin: 'bg-rose-100 text-rose-800 border-rose-200',
    reader: 'bg-purple-100 text-purple-900 border-purple-200',
    default: 'bg-ink-100 text-ink-700 border-ink-200',
  }[badgeVariant];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/logo-icon.png"
        alt="LilyHub LilyBeta"
        className={`${iconSizes} object-contain shrink-0 drop-shadow-xs transition-transform hover:scale-105`}
      />
      <div>
        <div className="flex items-center gap-1.5 leading-none">
          <div className="flex items-baseline">
            <span className={`font-serif font-bold text-[#1E1B4B] tracking-tight ${textSizes}`}>
              Lily
            </span>
            <span className={`font-sans font-extrabold text-[#9333EA] tracking-tight ${textSizes}`}>
              Beta
            </span>
          </div>
          {badge && (
            <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-ink-400 mt-0.5 leading-tight">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
