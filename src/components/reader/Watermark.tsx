import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const Watermark: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const label = `Beta • ${user.displayName || user.username}`;

  return (
    <div className="fixed bottom-4 right-4 pointer-events-none z-20 select-none reader-watermark">
      <div className="bg-ink-900/5 backdrop-blur-[1px] px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest text-ink-700/30">
        {label}
      </div>
    </div>
  );
};
