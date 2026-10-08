import React, { useState } from 'react';
import { X, Settings, Users, Key, Save, Check, Building2, Plus, Trash2 } from 'lucide-react';
import { Workspace } from '../../types';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onUpdateWorkspace: (id: string, updated: Partial<Workspace>) => void;
}

const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onUpdateWorkspace
}) => {
  const [name, setName] = useState(workspace?.name || '');
  const [plan, setPlan] = useState<'HOBBY' | 'PRO' | 'ENTERPRISE'>(workspace?.plan || 'HOBBY');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateWorkspace(workspace.id, { name, plan });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Workspace Settings</h3>
              <p className="text-xs text-zinc-400">Manage workspace name, tier, and member permissions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Workspace Name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Plan Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(['HOBBY', 'PRO', 'ENTERPRISE'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPlan(tier)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    plan === tier 
                      ? 'bg-purple-500/10 border-purple-500 text-purple-300 font-bold shadow-md shadow-purple-500/10' 
                      : 'bg-zinc-950 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <p className="text-xs">{tier}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {tier === 'HOBBY' ? 'Free' : tier === 'PRO' ? '$29/mo' : 'Custom'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Members List preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Users size={14} className="text-zinc-400" />
                Team Members (3)
              </label>
              <button 
                type="button"
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> Invite Member
              </button>
            </div>

            <div className="space-y-1.5 bg-zinc-950/50 p-2.5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">TM</div>
                  <div>
                    <p className="font-semibold text-white">Thompson Manda</p>
                    <p className="text-[9px] text-zinc-400">thompsonmanda08@gmail.com</p>
                  </div>
                </div>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md font-extrabold">Owner</span>
              </div>

              <div className="flex items-center justify-between py-1 px-2 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">AK</div>
                  <div>
                    <p className="font-semibold text-zinc-300">Alex Kim</p>
                    <p className="text-[9px] text-zinc-500">alex@company.dev</p>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">Developer</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
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
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
            >
              {isSaved ? (
                <>
                  <Check size={14} className="text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkspaceSettingsModal;
