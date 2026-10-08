import React, { useState } from 'react';
import { X, User, Mail, Shield, Save, Check, Camera, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [userType, setUserType] = useState<'Creator' | 'Learner' | 'Admin'>(user.userType || 'Creator');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({ name, email, userType });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative text-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Account Settings</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage your profile, email, and creator preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-14 h-14 rounded-full bg-emerald-800 text-white font-bold text-lg flex items-center justify-center shrink-0 border-2 border-emerald-600 shadow-sm">
              {user.avatar ? (
                <img src={user.avatar} alt={name} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.initials || 'TM'
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">Profile Identity</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Initials avatar: {user.initials}</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {userType} Account
              </span>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-600 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-600 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">User Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Creator', 'Learner', 'Admin'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setUserType(type)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      userType === type 
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-700/20"
            >
              {isSaved ? (
                <>
                  <Check size={14} className="text-emerald-200" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
