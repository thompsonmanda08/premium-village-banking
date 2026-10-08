import React from 'react';
import { X, FileText, MessageSquare, ExternalLink, HelpCircle, LogOut, CheckCircle2 } from 'lucide-react';

interface DocsSupportModalProps {
  isOpen: boolean;
  type: 'docs' | 'support' | 'logout' | null;
  onClose: () => void;
  onConfirmLogout?: () => void;
}

const DocsSupportModal: React.FC<DocsSupportModalProps> = ({
  isOpen,
  type,
  onClose,
  onConfirmLogout
}) => {
  if (!isOpen || !type) return null;

  if (type === 'logout') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
        <div 
          className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-2xl relative text-center space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <LogOut size={24} />
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Sign out of Apex Cloud?</h3>
            <p className="text-xs text-zinc-400 mt-1">You can log back in anytime with your credentials.</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (onConfirmLogout) onConfirmLogout();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              type === 'docs' 
                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' 
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            }`}>
              {type === 'docs' ? <FileText size={18} /> : <MessageSquare size={18} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {type === 'docs' ? 'Documentation Center' : '24/7 Priority Support'}
              </h3>
              <p className="text-xs text-zinc-400">
                {type === 'docs' ? 'Guides, API references, and tutorials' : 'Connect with our team of specialists'}
              </p>
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
        <div className="p-5 space-y-3">
          {type === 'docs' ? (
            <>
              <div className="p-3 bg-zinc-950 rounded-xl border border-white/5 flex items-center justify-between hover:border-blue-500/30 transition-colors cursor-pointer group">
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-blue-300">Quick Start Guide</p>
                  <p className="text-[10px] text-zinc-500">Learn how to deploy your first workspace app in 5 mins.</p>
                </div>
                <ExternalLink size={14} className="text-zinc-500 group-hover:text-blue-400" />
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-white/5 flex items-center justify-between hover:border-blue-500/30 transition-colors cursor-pointer group">
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-blue-300">API Documentation v2</p>
                  <p className="text-[10px] text-zinc-500">REST and GraphQL SDK reference endpoints.</p>
                </div>
                <ExternalLink size={14} className="text-zinc-500 group-hover:text-blue-400" />
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-zinc-950 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-emerald-400">Support Engineers Online</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Average response time is <span className="font-bold text-white">&lt; 3 minutes</span>.
                </p>
              </div>

              <button 
                onClick={() => alert("Connecting to live chat agent...")}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} />
                <span>Start Live Chat</span>
              </button>
            </>
          )}
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

export default DocsSupportModal;
