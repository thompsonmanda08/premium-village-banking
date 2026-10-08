import React from 'react';
import { Flame, CheckCircle2, ChevronRight } from 'lucide-react';

interface StreakCardProps {
  days: number;
  target: number;
  theme?: 'light' | 'dark' | 'system';
  isCheckedIn?: boolean;
  onCheckIn?: () => void;
}

const StreakCard: React.FC<StreakCardProps> = ({ 
  days, 
  target, 
  theme = 'dark',
  isCheckedIn = false,
  onCheckIn 
}) => {
  const progressPercentage = Math.min((days / target) * 100, 100);
  const isLight = theme === 'light';
  
  return (
    <div className={`group relative h-full rounded-2xl p-4 flex flex-col justify-between overflow-hidden backdrop-blur-xl transition-all duration-300 border ${
      isLight 
        ? 'bg-white/80 border-slate-200/80 shadow-sm hover:border-orange-400 hover:shadow-md text-slate-800' 
        : 'bg-zinc-900/40 border-white/5 hover:border-orange-500/30 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.2)] text-white'
    }`}>
      
      {/* Background Effect */}
      <div className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-[50px] pointer-events-none transition-colors duration-500 ${
        isLight ? 'bg-orange-300/20 group-hover:bg-orange-400/30' : 'bg-orange-500/10 group-hover:bg-orange-500/20'
      }`} />

      {/* Top Row: Header & Stats */}
      <div className="relative z-10 flex justify-between items-start">
        <div className={`flex items-center gap-1.5 px-2 py-1 border rounded-lg ${
          isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-500/10 border-orange-500/20'
        }`}>
          <Flame size={10} className="text-orange-500 fill-orange-500 animate-pulse" />
          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Streak</span>
        </div>
        
        {/* Stat Number */}
        <div className="flex items-baseline gap-1">
           <span className={`text-3xl font-black leading-none tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{days}</span>
           <span className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>days</span>
        </div>
      </div>

      {/* Middle: Progress Bar */}
      <div className="relative z-10 my-auto pt-2">
         <div className={`flex justify-between text-[10px] mb-1 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            <span>Progress</span>
            <span>{days}/{target}</span>
         </div>
         <div className={`h-1 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`}>
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
         </div>
      </div>

      {/* Bottom: Action Button */}
      <button 
        onClick={onCheckIn}
        className="relative z-10 w-full group/btn mt-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg p-[1px] shadow-sm hover:shadow-orange-500/20 transition-all"
      >
          <div className={`${
            isCheckedIn 
              ? 'bg-orange-500 text-white' 
              : isLight 
                ? 'bg-white/90 group-hover/btn:bg-transparent' 
                : 'bg-zinc-900/40 group-hover/btn:bg-transparent'
          } h-full w-full rounded-[7px] px-3 py-1.5 flex items-center justify-between backdrop-blur-sm transition-colors`}>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className={isCheckedIn ? "text-white" : isLight ? "text-orange-600 group-hover/btn:text-white" : "text-white/90"} />
              <span className={`font-bold text-xs ${isCheckedIn ? 'text-white' : isLight ? 'text-slate-800 group-hover/btn:text-white' : 'text-white'}`}>
                {isCheckedIn ? 'Checked In' : 'Check In'}
              </span>
            </div>
            <ChevronRight size={12} className={`opacity-60 group-hover/btn:translate-x-0.5 transition-transform ${isCheckedIn ? 'text-white' : isLight ? 'text-slate-600 group-hover/btn:text-white' : ''}`} />
          </div>
      </button>
    </div>
  );
};

export default StreakCard;