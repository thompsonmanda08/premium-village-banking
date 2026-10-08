import React from 'react';
import { MessageCircle, ArrowUpRight, User } from 'lucide-react';

interface SupportCardProps {
  theme?: 'light' | 'dark' | 'system';
  onOpenSupport?: () => void;
}

const SupportCard: React.FC<SupportCardProps> = ({ 
  theme = 'dark',
  onOpenSupport 
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`group relative h-full rounded-2xl p-4 flex flex-col justify-between overflow-hidden backdrop-blur-xl transition-all duration-300 border ${
      isLight 
        ? 'bg-white/80 border-slate-200/80 shadow-sm hover:border-emerald-400 hover:shadow-md text-slate-800' 
        : 'bg-zinc-900/40 border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)] text-white'
    }`}>
      
       {/* Ambient Background Glow */}
       <div className={`absolute top-1/2 left-1/2 w-20 h-20 rounded-full blur-[40px] -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
         isLight ? 'bg-emerald-300/20' : 'bg-emerald-500/10'
       }`} />

      <div className="relative z-10 flex items-start justify-between">
        <div>
           <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Support
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" />
          </h2>
          <p className={`${isLight ? 'text-slate-500' : 'text-zinc-500'} text-[10px] mt-0.5`}>Online now</p>
        </div>
        
        {/* Compact Avatar Pile */}
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] shadow-sm border ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-zinc-800 border-zinc-900 text-zinc-500'
            }`}>
              <User size={10} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto pt-2">
        <button 
          onClick={onOpenSupport}
          className={`w-full font-semibold py-1.5 px-3 rounded-lg transition-all duration-300 flex items-center justify-between group/btn border ${
            isLight 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <MessageCircle size={14} />
            <span className="text-xs">WhatsApp</span>
          </div>
          <ArrowUpRight size={12} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default SupportCard;