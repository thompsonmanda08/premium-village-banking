import React, { useState } from 'react';
import { ExternalLink, Store, Power } from 'lucide-react';

interface WelcomeCardProps {
  userName: string;
  theme?: 'light' | 'dark' | 'system';
  onOpenStorefront?: () => void;
  onToggleStatus?: (isOnline: boolean) => void;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ 
  userName, 
  theme = 'dark',
  onOpenStorefront,
  onToggleStatus 
}) => {
  const [isPublished, setIsPublished] = useState(true);
  const isLight = theme === 'light';

  const handleToggle = () => {
    const nextState = !isPublished;
    setIsPublished(nextState);
    if (onToggleStatus) onToggleStatus(nextState);
  };

  return (
    <div className={`group relative h-full rounded-2xl p-4 flex flex-col justify-between overflow-hidden backdrop-blur-xl transition-all duration-300 border ${
      isLight 
        ? 'bg-white/80 border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md text-slate-800' 
        : 'bg-zinc-900/40 border-white/5 hover:border-blue-500/30 hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] text-white'
    }`}>
      
      {/* Ambient Background Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 pointer-events-none transition-colors duration-500 ${
        isLight ? 'bg-blue-300/20 group-hover:bg-blue-400/30' : 'bg-blue-600/10 group-hover:bg-blue-600/20'
      }`} />

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <h2 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Hi, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">{userName}</span>
            <span className="text-sm animate-pulse">👋</span>
          </h2>
          <p className={`${isLight ? 'text-slate-500' : 'text-zinc-500'} font-medium text-[10px]`}>Dashboard Overview</p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3 mt-1">
        {/* Toggle Switch */}
        <div 
          onClick={handleToggle}
          className={`cursor-pointer rounded-xl px-2 py-2 flex flex-col justify-center gap-1 group/toggle border transition-colors ${
            isLight 
              ? 'bg-slate-100/80 border-slate-200 hover:bg-slate-200/60' 
              : 'bg-black/20 border-white/5 hover:bg-black/40'
          }`}
        >
          <div className="flex items-center justify-between">
             <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>Status</span>
             <div className={`w-6 h-3 rounded-full p-0.5 transition-colors duration-300 ${isPublished ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-700'}`}>
                <div className={`bg-white w-2 h-2 rounded-full shadow-sm transform transition-transform duration-300 ${isPublished ? 'translate-x-3' : 'translate-x-0'}`} />
             </div>
          </div>
          <p className={`text-[10px] font-medium truncate ${isPublished ? 'text-emerald-600 dark:text-emerald-400' : isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            {isPublished ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Action Button */}
        <button 
          onClick={onOpenStorefront}
          className={`flex flex-col items-center justify-center gap-1 border rounded-xl py-1 transition-colors group/btn ${
            isLight 
              ? 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-800 border-slate-200' 
              : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
          }`}
        >
          <Store size={14} className={isLight ? "text-blue-600" : "text-blue-200"} />
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold">Storefront</span>
            <ExternalLink size={8} className="opacity-50" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default WelcomeCard;