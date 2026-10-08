import React from 'react';
import { X, Users, UserCheck, Plus, Shield, Check } from 'lucide-react';
import { UserProfile } from '../../types';

interface LearnerProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSelectUserType: (type: 'Creator' | 'Learner') => void;
}

const LearnerProfilesModal: React.FC<LearnerProfilesModalProps> = ({
  isOpen,
  onClose,
  user,
  onSelectUserType
}) => {
  if (!isOpen) return null;

  const profiles = [
    {
      id: 'p-1',
      name: user.name,
      email: user.email,
      type: 'Creator',
      initials: user.initials,
      active: user.userType === 'Creator'
    },
    {
      id: 'p-2',
      name: `${user.name} (Learner)`,
      email: user.email.replace('+creator', '+learner'),
      type: 'Learner',
      initials: 'TL',
      active: user.userType === 'Learner'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative text-zinc-800 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Learner & Creator Profiles</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Switch profile views or manage accounts</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Select an active profile mode to customize your sidebar and course access:
          </p>

          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectUserType(p.type as 'Creator' | 'Learner');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  p.active
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                    p.type === 'Creator' ? 'bg-emerald-800' : 'bg-blue-700'
                  }`}>
                    {p.initials}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{p.name}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{p.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                    p.type === 'Creator' 
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                  }`}>
                    {p.type}
                  </span>
                  {p.active && <Check size={16} className="text-emerald-600" />}
                </div>
              </button>
            ))}
          </div>

          <button 
            onClick={() => alert("Creating secondary profile...")}
            className="w-full py-2 px-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add Sub-Learner Profile</span>
          </button>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end bg-zinc-50 dark:bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearnerProfilesModal;
