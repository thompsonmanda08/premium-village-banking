import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import OverviewView from './components/views/OverviewView';
import AnalyticsView from './components/views/AnalyticsView';
import DataRecordsView from './components/views/DataRecordsView';
import ProjectsBoardView from './components/views/ProjectsBoardView';
import ComponentShowcaseView from './components/views/ComponentShowcaseView';
import ActivityLogsView from './components/views/ActivityLogsView';
import SettingsView from './components/views/SettingsView';
import LearningCoursesView from './components/views/LearningCoursesView';
import EcommerceView from './components/views/EcommerceView';
import ErpWorkflowView from './components/views/ErpWorkflowView';
import EduTechView from './components/views/EduTechView';

import AccountSettingsModal from './components/modals/AccountSettingsModal';
import WorkspaceSettingsModal from './components/modals/WorkspaceSettingsModal';
import UsageModal from './components/modals/UsageModal';
import NewWorkspaceModal from './components/modals/NewWorkspaceModal';
import DocsSupportModal from './components/modals/DocsSupportModal';
import UpgradeModal from './components/modals/UpgradeModal';
import BillingModal from './components/modals/BillingModal';
import LearnerProfilesModal from './components/modals/LearnerProfilesModal';
import UserMenu from './components/UserMenu';
import LoginPage from './components/LoginPage';
import Modal from './components/ui/Modal';
import Button from './components/ui/Button';
import Badge from './components/ui/Badge';
import { UserProfile, Workspace, TransactionRecord } from './types';
import { 
  Sparkles, 
  Search, 
  Bell, 
  Zap, 
  CheckCircle2, 
  ChevronDown,
  Sun,
  Moon,
  Command,
  LayoutDashboard,
  BarChart3,
  Database,
  FolderKanban,
  Layers,
  Activity,
  Settings,
  ArrowRight,
  GraduationCap,
  ShoppingBag,
  FileCheck,
  Calendar
} from 'lucide-react';

const App: React.FC = () => {
  // 1. User State
  const [user, setUser] = useState<UserProfile>({
    id: 'usr-1',
    name: 'Thompson Manda',
    email: 'thompsonmanda08@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Workspace Owner',
    plan: 'ENTERPRISE',
    streakDays: 5,
    streakTarget: 7,
    storeName: 'Core Platform',
    isCheckedIn: true
  });

  // 2. Workspaces State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'ws-1',
      name: "Acme Corp Production",
      role: 'Owner',
      plan: 'ENTERPRISE',
      isCurrent: true,
      avatarColor: 'bg-gradient-to-tr from-indigo-600 to-purple-600'
    },
    {
      id: 'ws-2',
      name: 'Sandbox Staging Dev',
      role: 'Admin',
      plan: 'PRO',
      isCurrent: false,
      avatarColor: 'bg-gradient-to-tr from-emerald-600 to-teal-600'
    }
  ]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-1');

  // 3. UI Navigation & Theme State
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isHeaderUserMenuOpen, setIsHeaderUserMenuOpen] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  // 4. Modal State
  const [activeModal, setActiveModal] = useState<
    'account' | 'workspace' | 'usage' | 'new-workspace' | 'docs' | 'support' | 'logout' | 'upgrade' | 'billing' | 'learners' | 'help' | 'create-course' | null
  >(null);

  // 5. Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keyboard shortcut listener for ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLoginSuccess = (userData?: Partial<UserProfile>) => {
    if (userData) {
      setUser(prev => ({ ...prev, ...userData }));
    }
    setIsLoggedOut(false);
    setActiveNav('dashboard');
    showToast('Logged in successfully!');
  };

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    const target = workspaces.find(w => w.id === id);
    if (target) {
      showToast(`Switched workspace to "${target.name}"`);
    }
  };

  const handleCreateWorkspace = (newWs: Workspace) => {
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
    showToast(`Created workspace "${newWs.name}"!`);
  };

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updated }));
    showToast("Account details updated successfully");
  };

  const handleUpdateWorkspace = (id: string, updated: Partial<Workspace>) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updated } : w));
    showToast("Workspace settings saved");
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`);
  };

  const handleSelectTheme = (mode: 'light' | 'dark' | 'system') => {
    if (mode === 'system') {
      setTheme('dark');
    } else {
      setTheme(mode);
    }
    showToast(`Switched to ${mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'} theme`);
  };

  const navigationOptions = [
    { id: 'dashboard', label: 'Dashboard Overview', desc: 'Main telemetry & stats', icon: LayoutDashboard },
    { id: 'edutech', label: 'EduTech & Academic Calendar', desc: 'Customizable calendar, timetable & automated attendance registers', icon: Calendar },
    { id: 'erp', label: 'ERP & Document Approvals', desc: 'Procurement PR/PO/GRN/PV, PDF verification & audit log', icon: FileCheck },
    { id: 'courses', label: 'Courses & Video Classroom', desc: 'Udemy-style video lectures, notes & certificates', icon: GraduationCap },
    { id: 'ecommerce', label: 'E-Commerce Storefront', desc: 'Developer hardware, merch & order tracker', icon: ShoppingBag },
    { id: 'analytics', label: 'Analytics & Traffic', desc: 'Throughput & error rates', icon: BarChart3 },
    { id: 'records', label: 'Data Records & Ledger', desc: 'Manage tables & transactions', icon: Database },
    { id: 'projects', label: 'Project Workflows', desc: 'Kanban board & deliverables', icon: FolderKanban },
    { id: 'showcase', label: 'UI Component Showcase', desc: 'Reusable component library', icon: Layers },
    { id: 'logs', label: 'Security & Audit Logs', desc: 'Event timelines & traces', icon: Activity },
    { id: 'settings', label: 'Workspace Settings', desc: 'Profile, API keys, 2FA', icon: Settings },
  ];

  const filteredCommands = navigationOptions.filter((opt) =>
    opt.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
    opt.desc.toLowerCase().includes(commandSearch.toLowerCase())
  );

  if (isLoggedOut || activeNav === 'login') {
    return (
      <LoginPage 
        onLogin={handleLoginSuccess} 
        onBackToApp={() => {
          setIsLoggedOut(false);
          setActiveNav('dashboard');
        }} 
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row font-sans transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30' 
        : 'bg-slate-100 text-slate-900 selection:bg-indigo-500/20'
    }`}>
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-indigo-500/40 text-white text-xs font-semibold rounded-2xl shadow-2xl shadow-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar with User Menu Popover */}
      <Sidebar
        user={user}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenModal={(modal) => setActiveModal(modal)}
        theme={theme}
        onSelectTheme={handleSelectTheme}
        onToggleTheme={handleToggleTheme}
        activeNav={activeNav}
        onSelectNav={(nav) => setActiveNav(nav)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* Top Header Bar */}
        <header className={`mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
          isLight ? 'border-slate-200' : 'border-white/5'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeNav === 'dashboard' && 'Dashboard Overview'}
                {activeNav === 'courses' && 'Video Learning & Classroom'}
                {activeNav === 'ecommerce' && 'Developer Gear & Storefront'}
                {activeNav === 'analytics' && 'Analytics & Performance'}
                {activeNav === 'records' && 'Data Ledger & Records'}
                {activeNav === 'projects' && 'Projects & Kanban Tasks'}
                {activeNav === 'showcase' && 'Reusable Component Library'}
                {activeNav === 'logs' && 'Audit Trails & Security'}
                {activeNav === 'settings' && 'Workspace Settings'}
              </h1>
              <Badge variant="purple" size="sm">
                {user.plan}
              </Badge>
            </div>
            <p className={`${isLight ? 'text-slate-500' : 'text-zinc-400'} text-xs mt-1 flex items-center gap-2`}>
              <span>Active Workspace: <strong className={isLight ? 'text-slate-800 font-semibold' : 'text-zinc-300 font-semibold'}>{currentWorkspace?.name}</strong></span>
              <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`} />
              <span className="text-emerald-500 font-medium">All systems normal</span>
            </p>
          </div>

          {/* Quick Header Actions: Search, Theme, Usage, User Menu */}
          <div className="flex items-center gap-2">
            
            {/* Quick Command Palette Search Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-sm'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <Search size={14} className="text-slate-400 dark:text-zinc-500" />
              <span className="hidden md:inline text-slate-500 dark:text-zinc-400">Search commands...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-white/5">
                ⌘K
              </kbd>
            </button>

            {/* Theme Toggle Button */}
            <button 
              onClick={handleToggleTheme}
              className={`p-2 border rounded-xl text-xs font-semibold transition-colors flex items-center justify-center ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
              title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
            >
              {isLight ? <Moon size={15} className="text-indigo-600" /> : <Sun size={15} className="text-amber-400" />}
            </button>

            {/* Usage Stats Quick Trigger */}
            <button 
              onClick={() => setActiveModal('usage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <Zap size={14} className="text-amber-500 dark:text-amber-400 fill-amber-400" />
              <span className="hidden sm:inline">Usage</span>
            </button>

            {/* Header User Menu Trigger */}
            <div className={`relative ml-1 pl-2 border-l ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                onClick={() => setIsHeaderUserMenuOpen(!isHeaderUserMenuOpen)}
                className={`flex items-center gap-2.5 p-1.5 rounded-xl transition-all text-xs font-semibold border ${
                  isHeaderUserMenuOpen 
                    ? isLight
                      ? 'bg-indigo-50 border-indigo-300 text-slate-900 shadow-sm'
                      : 'bg-zinc-800/90 border-indigo-500/50 text-white shadow-md shadow-indigo-500/10' 
                    : isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-zinc-900/80 hover:bg-zinc-800/90 border-white/10 hover:border-white/20 text-zinc-200'
                }`}
                title="User Menu"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-0.5 shrink-0 shadow-sm">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover bg-zinc-950" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center font-extrabold text-[10px] text-white">
                      {user.initials || 'TM'}
                    </div>
                  )}
                </div>
                <span className="hidden sm:inline-block max-w-[100px] truncate font-bold text-xs">{user.name}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${
                  isHeaderUserMenuOpen 
                    ? 'rotate-180 text-indigo-600 dark:text-indigo-400' 
                    : isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
              </button>

              <UserMenu
                isOpen={isHeaderUserMenuOpen}
                user={user}
                onOpenModal={(modal) => setActiveModal(modal)}
                theme={theme}
                onSelectTheme={handleSelectTheme}
                onClose={() => setIsHeaderUserMenuOpen(false)}
                position="top-right"
              />
            </div>
          </div>
        </header>

        {/* Dynamic Nav View Content */}
        {activeNav === 'dashboard' && (
          <OverviewView
            user={user}
            workspace={currentWorkspace}
            theme={theme}
            onNavigate={(nav) => setActiveNav(nav)}
            onOpenModal={(modal) => setActiveModal(modal)}
            showToast={showToast}
          />
        )}

        {activeNav === 'edutech' && (
          <EduTechView
            theme={theme}
            showToast={showToast}
            onNavigateToCourses={() => setActiveNav('courses')}
          />
        )}

        {activeNav === 'erp' && (
          <ErpWorkflowView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'courses' && (
          <LearningCoursesView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'ecommerce' && (
          <EcommerceView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'analytics' && (
          <AnalyticsView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'records' && (
          <DataRecordsView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'projects' && (
          <ProjectsBoardView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'showcase' && (
          <ComponentShowcaseView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'logs' && (
          <ActivityLogsView
            theme={theme}
            showToast={showToast}
          />
        )}

        {activeNav === 'settings' && (
          <SettingsView
            user={user}
            workspace={currentWorkspace}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            showToast={showToast}
          />
        )}

      </main>

      {/* Global Command Palette Dialog */}
      <Modal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
            <Search size={16} className="text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              autoFocus
              placeholder="Search views, components, or settings..."
              value={commandSearch}
              onChange={(e) => setCommandSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-white/5">
              ESC
            </kbd>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {filteredCommands.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setActiveNav(opt.id);
                    setIsCommandPaletteOpen(false);
                    setCommandSearch('');
                    showToast(`Navigated to ${opt.label}`);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">{opt.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-300 dark:text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Modals Container */}
      <AccountSettingsModal
        isOpen={activeModal === 'account'}
        onClose={() => setActiveModal(null)}
        user={user}
        onUpdateUser={handleUpdateUser}
      />

      <WorkspaceSettingsModal
        isOpen={activeModal === 'workspace'}
        onClose={() => setActiveModal(null)}
        workspace={currentWorkspace}
        onUpdateWorkspace={handleUpdateWorkspace}
      />

      <UsageModal
        isOpen={activeModal === 'usage'}
        onClose={() => setActiveModal(null)}
      />

      <NewWorkspaceModal
        isOpen={activeModal === 'new-workspace'}
        onClose={() => setActiveModal(null)}
        onCreateWorkspace={handleCreateWorkspace}
      />

      <DocsSupportModal
        isOpen={activeModal === 'docs' || activeModal === 'support' || activeModal === 'logout' || activeModal === 'help'}
        type={activeModal === 'docs' ? 'docs' : activeModal === 'support' || activeModal === 'help' ? 'support' : activeModal === 'logout' ? 'logout' : null}
        onClose={() => setActiveModal(null)}
        onConfirmLogout={() => {
          setIsLoggedOut(true);
          showToast("Logged out successfully");
        }}
      />

      <UpgradeModal
        isOpen={activeModal === 'upgrade'}
        onClose={() => setActiveModal(null)}
        user={user}
        onSelectPlan={(planName, desc) => {
          handleUpdateUser({ plan: planName, planDescription: desc });
          showToast(`Successfully upgraded to ${planName}!`);
        }}
      />

      <BillingModal
        isOpen={activeModal === 'billing'}
        onClose={() => setActiveModal(null)}
        user={user}
      />

      <LearnerProfilesModal
        isOpen={activeModal === 'learners'}
        onClose={() => setActiveModal(null)}
      />

    </div>
  );
};

export default App;
