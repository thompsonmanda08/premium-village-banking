import React from 'react';
import { 
  User, 
  Users, 
  CreditCard, 
  HelpCircle, 
  Sun, 
  Monitor, 
  Moon, 
  LogOut, 
  Crown,
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { UserProfile } from '../types';

interface UserMenuProps {
  isOpen: boolean;
  user: UserProfile;
  onOpenModal: (modalType: 'account' | 'learners' | 'billing' | 'help' | 'logout' | 'upgrade') => void;
  theme: 'light' | 'dark' | 'system';
  onSelectTheme?: (mode: 'light' | 'dark' | 'system') => void;
  onClose: () => void;
  position?: 'bottom-left' | 'top-right' | 'bottom-right';
}

const UserMenu: React.FC<UserMenuProps> = ({
  isOpen,
  user,
  onOpenModal,
  theme,
  onSelectTheme = () => {},
  onClose,
  position = 'bottom-left'
}) => {
  if (!isOpen) return null;

  const positionClasses = (position === 'top-right' || position === 'bottom-right')
    ? 'top-full right-0 mt-3 animate-in fade-in slide-in-from-top-2'
    : 'bottom-full left-0 mb-3 animate-in fade-in slide-in-from-bottom-2';

  const isLight = theme === 'light';

  return (
    <>
      {/* Invisible backdrop to dismiss on outside click */}
      <div 
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" 
        onClick={onClose} 
      />

      {/* Popover Menu Container - Adapts to Light/Dark Mode */}
      <div 
        className={`absolute ${positionClasses} w-80 z-50 rounded-2xl p-3 duration-200 font-sans border transition-all ${
          isLight 
            ? 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl' 
            : 'bg-zinc-900/95 border-white/10 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(99,102,241,0.15)] backdrop-blur-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle ambient glowing gradients */}
        <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
          isLight ? 'bg-indigo-300/20' : 'bg-indigo-500/10'
        }`} />
        <div className={`absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl pointer-events-none ${
          isLight ? 'bg-purple-300/20' : 'bg-purple-500/10'
        }`} />

        {/* 1. Header: User Avatar, Name & Email */}
        <div className={`relative border rounded-xl p-3 flex items-center gap-3 mb-2 group transition-colors ${
          isLight 
            ? 'bg-slate-50 border-slate-200/80 hover:border-indigo-300' 
            : 'bg-zinc-800/40 border-white/10 hover:border-indigo-500/30'
        }`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-500 p-0.5 shadow-md shadow-indigo-500/20 shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover bg-zinc-950" />
            ) : (
              <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center font-extrabold text-xs text-white">
                {user.initials || 'TM'}
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className={`text-xs font-bold tracking-tight leading-tight truncate flex items-center gap-1 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {user.name}
              <ShieldCheck size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </h3>
            <p className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              {user.email}
            </p>
          </div>
        </div>

        {/* 2. Pro Plan Card - Clickable trigger for Upgrade Modal */}
        <button
          onClick={() => { onOpenModal('upgrade'); onClose(); }}
          className={`w-full text-left p-3 mb-2 rounded-xl border flex items-start gap-3 transition-all duration-150 cursor-pointer group ${
            isLight 
              ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-slate-50 hover:border-indigo-300 hover:shadow-md' 
              : 'border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-zinc-900 hover:border-indigo-500/60 hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]'
          }`}
          title="Click to view pricing plans and upgrade"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-colors">
            <Crown size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors flex items-center gap-1 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {user.plan || 'Pro plan'}
                <Sparkles size={11} className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                ACTIVE
              </span>
            </div>
            <p className={`text-[10px] leading-snug mt-1 transition-colors ${
              isLight ? 'text-slate-600 group-hover:text-slate-800' : 'text-zinc-400 group-hover:text-zinc-300'
            }`}>
              {user.planDescription || 'Unlock full-access, Study, Quizzing engine, and custom workflows.'}
            </p>
            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1.5 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              <span>View all plans & upgrade</span> →
            </p>
          </div>
        </button>

        {/* Divider */}
        <div className={`border-t my-2 ${isLight ? 'border-slate-200' : 'border-white/5'}`} />

        {/* 3. Navigation Links */}
        <div className="space-y-0.5">
          <button 
            onClick={() => { onOpenModal('account'); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group/item text-left ${
              isLight 
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={15} className="text-slate-400 dark:text-zinc-400 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors" />
            <span>Account Settings</span>
          </button>

          <button 
            onClick={() => { onOpenModal('learners'); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group/item text-left ${
              isLight 
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={15} className="text-slate-400 dark:text-zinc-400 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors" />
            <span>Learner profiles</span>
          </button>

          <button 
            onClick={() => { onOpenModal('billing'); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group/item text-left ${
              isLight 
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard size={15} className="text-slate-400 dark:text-zinc-400 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors" />
            <span>Billing</span>
          </button>

          <button 
            onClick={() => { onOpenModal('help'); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group/item text-left ${
              isLight 
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <HelpCircle size={15} className="text-slate-400 dark:text-zinc-400 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors" />
            <span>Help & Feedback</span>
          </button>
        </div>

        {/* Divider */}
        <div className={`border-t my-2 ${isLight ? 'border-slate-200' : 'border-white/5'}`} />

        {/* 4. Bottom Row: Logout & Theme Toggle (No "Theme" label) */}
        <div className="px-1 py-0.5 flex items-center justify-between gap-2">
          <button
            onClick={() => { onOpenModal('logout'); onClose(); }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-colors text-left"
          >
            <LogOut size={15} className="text-red-500 dark:text-red-400" />
            <span>Log out</span>
          </button>

          {/* Segmented Theme Control */}
          <div className={`flex items-center gap-0.5 p-1 border rounded-xl ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-950/80 border-white/5'
          }`}>
            <button
              onClick={() => onSelectTheme('light')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                theme === 'light' 
                  ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                  : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="Light theme"
            >
              <Sun size={13} />
            </button>

            <button
              onClick={() => onSelectTheme('system')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                theme === 'system' 
                  ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                  : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="System preference"
            >
              <Monitor size={13} />
            </button>

            <button
              onClick={() => onSelectTheme('dark')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                theme === 'dark' 
                  ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                  : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="Dark theme"
            >
              <Moon size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserMenu;
