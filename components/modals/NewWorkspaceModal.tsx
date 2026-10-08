import React, { useState } from 'react';
import { X, Plus, Building2, Check } from 'lucide-react';
import { Workspace } from '../../types';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (newWs: Workspace) => void;
}

const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace
}) => {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'HOBBY' | 'PRO'>('HOBBY');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const colors = [
      'bg-gradient-to-tr from-emerald-600 to-teal-600',
      'bg-gradient-to-tr from-amber-600 to-orange-600',
      'bg-gradient-to-tr from-cyan-600 to-blue-600',
      'bg-gradient-to-tr from-fuchsia-600 to-pink-600'
    ];

    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      name: name.trim(),
      role: 'Owner',
      plan: plan,
      isCurrent: false,
      avatarColor: colors[Math.floor(Math.random() * colors.length)]
    };

    onCreateWorkspace(newWs);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Create Workspace</h3>
              <p className="text-xs text-zinc-400">Add a new organization or team workspace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Workspace Name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="e.g. Acme Studio, Personal Dev"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Starting Tier</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPlan('HOBBY')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  plan === 'HOBBY' 
                    ? 'bg-indigo-500/10 border-indigo-500 text-white font-bold' 
                    : 'bg-zinc-950 border-white/5 text-zinc-400'
                }`}
              >
                <p className="text-xs font-semibold">Hobby</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Free for personal projects</p>
              </button>

              <button
                type="button"
                onClick={() => setPlan('PRO')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  plan === 'PRO' 
                    ? 'bg-purple-500/10 border-purple-500 text-white font-bold' 
                    : 'bg-zinc-950 border-white/5 text-zinc-400'
                }`}
              >
                <p className="text-xs font-semibold">Pro Team</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">$29/mo with team sharing</p>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
            >
              <Plus size={14} />
              <span>Create Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewWorkspaceModal;
