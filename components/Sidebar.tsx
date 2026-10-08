import React, { useState } from 'react';
import { 
  LayoutDashboard,
  BarChart3, 
  Database,
  FolderKanban, 
  Layers,
  Activity,
  Settings,
  HelpCircle, 
  MoreVertical, 
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Building2,
  Check,
  GraduationCap,
  ShoppingBag,
  FileCheck,
  Calendar
} from 'lucide-react';
import { UserProfile, Workspace } from '../types';
import UserMenu from './UserMenu';
import Badge from './ui/Badge';

interface SidebarProps {
  user: UserProfile;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (id: string) => void;
  onOpenModal: (modalType: any) => void;
  theme: 'light' | 'dark' | 'system';
  onSelectTheme?: (mode: 'light' | 'dark' | 'system') => void;
  onToggleTheme?: () => void;
  activeNav: string;
  onSelectNav: (nav: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenModal,
  theme,
  onSelectTheme,
  onToggleTheme,
  activeNav,
  onSelectNav,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Generic Modular Navigation items
  const mainNavItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'edutech', label: 'EduTech & Calendar', icon: Calendar, isNew: true },
    { id: 'erp', label: 'ERP & Documents', icon: FileCheck, isNew: true },
    { id: 'courses', label: 'Courses & Video', icon: GraduationCap, isNew: true },
    { id: 'ecommerce', label: 'E-Commerce Store', icon: ShoppingBag, isNew: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },

    { id: 'records', label: 'Data Records', icon: Database },
    { id: 'projects', label: 'Projects & Tasks', icon: FolderKanban },
    { id: 'showcase', label: 'UI Components', icon: Layers },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isLight = theme === 'light';
  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className={`lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30 backdrop-blur-xl ${
        isLight 
          ? 'bg-white/90 border-slate-200 text-slate-800' 
          : 'bg-zinc-950/90 border-white/10 text-white'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
            <Layers size={18} />
          </div>
          <div>
            <span className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Modular App</span>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{currentWorkspace?.name || 'Workspace'}</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className={`p-1.5 rounded-xl border ${
            isLight 
              ? 'bg-slate-100 text-slate-700 border-slate-200' 
              : 'bg-zinc-900 text-zinc-200 border-white/10'
          }`}
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col justify-between border-r backdrop-blur-2xl transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } p-3.5 select-none ${
          isLight 
            ? 'bg-white/95 border-slate-200 text-slate-800' 
            : 'bg-zinc-950/90 border-white/10 text-zinc-100'
        }`}
      >
        {/* Top Section */}
        <div>
          {/* Platform Branding / Workspace Switcher Trigger */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg shadow-indigo-500/25">
                <Layers size={18} />
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <h2 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Modular App</h2>
                  <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400/90 flex items-center gap-1">
                    <Sparkles size={10} /> Universal Template
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden lg:flex w-6 h-6 rounded-lg border items-center justify-center transition-all ${
                isLight 
                  ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' 
                  : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
              }`}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* Quick Workspace Switcher Bar */}
          {!isCollapsed && workspaces.length > 0 && (
            <div className="mb-4 relative">
              <button
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    : 'bg-zinc-900/60 border-white/10 text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 size={14} className="text-indigo-500 shrink-0" />
                  <span className="truncate">{currentWorkspace?.name || 'My Workspace'}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-bold shrink-0">
                  {currentWorkspace?.role || 'Admin'}
                </span>
              </button>

              {isWorkspaceMenuOpen && (
                <div className={`absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-white/10'
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 px-2 py-1 uppercase tracking-wider">
                    Switch Workspace
                  </div>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        if (onSelectWorkspace) onSelectWorkspace(ws.id);
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                        ws.id === activeWorkspaceId
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.id === activeWorkspaceId && <Check size={13} />}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button
                    onClick={() => {
                      onOpenModal('new-workspace');
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                  >
                    <Plus size={13} /> Add New Workspace
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Main Navigation Items */}
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectNav(item.id);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive 
                      ? isLight 
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-sm font-bold' 
                        : 'bg-gradient-to-r from-indigo-600/20 via-purple-600/15 to-transparent border border-indigo-500/30 text-indigo-200 shadow-sm' 
                      : isLight 
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={`${
                      isActive 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : isLight 
                          ? 'text-slate-400 group-hover:text-slate-700' 
                          : 'text-zinc-400 group-hover:text-zinc-200'
                    } shrink-0 transition-colors`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>

                  {!isCollapsed && item.isNew && (
                    <Badge variant="purple" size="sm">NEW</Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Navigation & Profile Section */}
        <div className={`space-y-2 pt-4 border-t ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
          
          {/* Help & Support Button */}
          <button
            onClick={() => {
              onOpenModal('help');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isLight 
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
            title={isCollapsed ? "Help & Documentation" : undefined}
          >
            <HelpCircle size={18} className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-zinc-400'}`} />
            {!isCollapsed && <span>Help & Docs</span>}
          </button>

          {/* User Menu Trigger */}
          <div className="relative">
            <UserMenu
              isOpen={isUserMenuOpen}
              user={user}
              onOpenModal={onOpenModal}
              theme={theme}
              onSelectTheme={onSelectTheme || ((mode) => {
                if (onToggleTheme) onToggleTheme();
              })}
              onClose={() => setIsUserMenuOpen(false)}
            />

            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left border ${
                isUserMenuOpen 
                  ? isLight 
                    ? 'bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-sm' 
                    : 'bg-zinc-800/80 border-indigo-500/40 text-white shadow-md' 
                  : isLight 
                    ? 'bg-slate-50 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/80 text-slate-800' 
                    : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-800/50 text-zinc-200'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shrink-0 shadow-sm">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover bg-zinc-950" />
                ) : (
                  <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center font-extrabold text-[11px] text-white">
                    {user.initials || 'TM'}
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {user.name}
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
                    {user.role || 'Admin'}
                  </p>
                </div>
              )}

              {!isCollapsed && (
                <MoreVertical size={15} className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-zinc-400'}`} />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
