import React from 'react';
import { X, CreditCard, Crown, Check, Zap, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}

const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  const features = [
    'Unlock full-access Study mode',
    'AI-powered Quizzing engine',
    'Custom learning & course workflows',
    '24/7 Priority creator support',
    'Unlimited course publishing & SyncUp'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative text-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Billing & Subscriptions</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Current plan: {user.plan || 'Pro plan'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Active Pro Banner */}
          <div className="p-4 rounded-xl bg-emerald-700 text-white flex items-center justify-between shadow-lg shadow-emerald-700/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Crown size={22} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold">{user.plan || 'Pro plan'}</h4>
                <p className="text-xs text-emerald-100">Renews on Sept 15, 2026</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg">Active</span>
          </div>

          {/* Included Features */}
          <div className="space-y-2 pt-1">
            <h5 className="text-xs font-bold text-zinc-900 dark:text-white">Included in Pro Plan:</h5>
            <div className="grid grid-cols-1 gap-1.5">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Check size={11} />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-zinc-500" />
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Visa ending in 4242</p>
                <p className="text-[10px] text-zinc-500">Expires 12/28</p>
              </div>
            </div>
            <button className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
              Edit
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end bg-zinc-50 dark:bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingModal;
