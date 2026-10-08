import React from 'react';
import { X, BarChart2, HardDrive, Cpu, Zap, Activity, ArrowUpRight } from 'lucide-react';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UsageModal: React.FC<UsageModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const usageData = [
    { label: 'Active Projects', used: 6, limit: 10, unit: 'projects', percent: 60, icon: BarChart2, color: 'from-indigo-500 to-purple-600' },
    { label: 'Bandwidth', used: 42.5, limit: 100, unit: 'GB', percent: 42.5, icon: Zap, color: 'from-amber-500 to-orange-600' },
    { label: 'Build Execution', used: 180, limit: 300, unit: 'mins', percent: 60, icon: Cpu, color: 'from-emerald-500 to-teal-600' },
    { label: 'Cloud Storage', used: 3.4, limit: 5, unit: 'GB', percent: 68, icon: HardDrive, color: 'from-blue-500 to-cyan-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Project Usage & Quotas</h3>
              <p className="text-xs text-zinc-400">Monthly resource usage for Hobby Plan</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {usageData.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/5 text-zinc-300">
                        <Icon size={14} />
                      </div>
                      <span className="font-semibold text-white">{item.label}</span>
                    </div>
                    <span className="text-zinc-400 font-mono">
                      {item.used} / {item.limit} {item.unit}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${item.color} transition-all duration-500`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-zinc-900 border border-indigo-500/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">Need higher limits?</p>
              <p className="text-[11px] text-zinc-400">Upgrade to Pro for unlimited build minutes and 1TB bandwidth.</p>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 shadow-sm flex items-center gap-1 transition-all">
              <span>Upgrade</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex justify-end bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsageModal;
