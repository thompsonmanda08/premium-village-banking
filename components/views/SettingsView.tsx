import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Key, 
  Shield, 
  Bell, 
  CreditCard, 
  Check, 
  Copy, 
  Plus, 
  Trash2, 
  Sun,
  Moon,
  Monitor,
  Mail,
  Send,
  Upload,
  Lock,
  Globe,
  Phone,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  IdCard,
  Laptop,
  Smartphone,
  ShieldCheck,
  Clock,
  Palette,
  Sliders,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import Card, { CardHeader, CardContent, CardFooter } from '../ui/Card';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import Switch from '../ui/Switch';
import Badge from '../ui/Badge';
import Tabs from '../ui/Tabs';
import { UserProfile, Workspace } from '../../types';

interface SettingsViewProps {
  user: UserProfile;
  workspace: Workspace;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  showToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  workspace,
  theme,
  onToggleTheme,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  
  // Profile Form States
  const [firstName, setFirstName] = useState(user.name ? user.name.split(' ')[0] : 'Thompson');
  const [lastName, setLastName] = useState(user.name ? user.name.split(' ').slice(1).join(' ') : 'Manda');
  const [displayName, setDisplayName] = useState(user.name || 'Thompson Manda');
  const [userEmail, setUserEmail] = useState(user.email || 'thompsonmanda08@gmail.com');
  const [userPhone, setUserPhone] = useState('+260 971 884 920');
  const [studentId, setStudentId] = useState('STA-2026-001');
  const [jobTitle, setJobTitle] = useState('Senior Product Engineer / Learner');
  const [bio, setBio] = useState('Building scalable interfaces, full-stack microservices, and modern web templates.');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [language, setLanguage] = useState('English (US)');
  const [timezone, setTimezone] = useState('Africa/Lusaka (CAT)');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  
  // Theme & Appearance states
  const [selectedThemeMode, setSelectedThemeMode] = useState<'light' | 'dark' | 'system'>(theme);
  const [accentColor, setAccentColor] = useState<'indigo' | 'emerald' | 'violet' | 'rose' | 'amber'>('indigo');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [workspaceSlug, setWorkspaceSlug] = useState('app.acme-corp.io');
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState([
    { id: 'key-1', name: 'Production Live Key', prefix: 'pk_live_8910482', created: 'Aug 10, 2026', lastUsed: '2 mins ago' },
    { id: 'key-2', name: 'Development Sandbox', prefix: 'pk_test_4481920', created: 'Aug 12, 2026', lastUsed: '3 days ago' },
  ]);

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Security Toggles
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState(true);

  // Notification Toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState([
    { id: 's1', device: 'Chrome on macOS (Sonoma)', location: 'Lusaka, Zambia', ip: '102.134.18.42', isCurrent: true, lastActive: 'Active now', icon: <Laptop size={16} /> },
    { id: 's2', device: 'Safari on iPhone 15 Pro', location: 'Lusaka, Zambia', ip: '102.134.19.11', isCurrent: false, lastActive: '2 hours ago', icon: <Smartphone size={16} /> },
  ]);

  const tabs = [
    { id: 'general', label: 'General & Profile', icon: <User size={14} /> },
    { id: 'appearance', label: 'Appearance & UI', icon: <Palette size={14} /> },
    { id: 'security', label: 'Security & Sessions', icon: <Shield size={14} /> },
    { id: 'workspace', label: 'Workspace & Team', icon: <Building2 size={14} /> },
    { id: 'apikeys', label: 'API Keys & Secrets', icon: <Key size={14} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
    { id: 'billing', label: 'Subscription & Plans', icon: <CreditCard size={14} /> },
  ];

  const copyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('API Key copied to clipboard');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateKey = () => {
    const newKey = {
      id: `key-${Date.now()}`,
      name: `Generated Key ${apiKeys.length + 1}`,
      prefix: `pk_live_${Math.floor(1000000 + Math.random() * 9000000)}`,
      created: 'Just now',
      lastUsed: 'Never',
    };
    setApiKeys([...apiKeys, newKey]);
    showToast('New API key generated!');
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
    showToast('API key revoked.');
  };

  const handleResendVerification = () => {
    showToast(`Verification link sent to ${userEmail}`);
  };

  const handleChangePassword = () => {
    showToast('Password reset link sent to your registered email.');
  };

  const handleSaveProfile = () => {
    setDisplayName(`${firstName} ${lastName}`.trim());
    showToast('Profile changes saved successfully!');
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setSelectedThemeMode(newTheme);
    if ((newTheme === 'light' && theme !== 'light') || (newTheme === 'dark' && theme !== 'dark')) {
      onToggleTheme();
    }
    showToast(`Theme switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)}`);
  };

  const handleRevokeOtherSessions = () => {
    setActiveSessions(activeSessions.filter(s => s.isCurrent));
    showToast('All other active device sessions have been revoked.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Sub-Header Bar & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pb-1">
          <Badge variant="neutral" size="sm" className="hidden sm:inline-flex items-center gap-1.5 py-1 px-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Settings Synced</span>
          </Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveProfile}
            leftIcon={<Check size={14} />}
          >
            Save All
          </Button>
        </div>
      </div>

      {/* 1. GENERAL & PROFILE TAB */}
      {activeTab === 'general' && (
        <div className="space-y-6 max-w-4xl">
          
          {/* Main User Profile Card */}
          <Card>
            <CardHeader
              title="Personal Profile & Identification"
              subtitle="Update your photo, personal bio, verified contact addresses, and student record."
              icon={<User size={18} className="text-indigo-500" />}
              action={
                <div className="flex items-center gap-2">
                  <Badge variant="purple" size="sm">
                    {user.role || 'Workspace Owner'}
                  </Badge>
                  <Badge variant="success" size="sm" dot>
                    Learner
                  </Badge>
                </div>
              }
            />

            <CardContent className="space-y-6">
              
              {/* Profile Avatar & Identity Row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5">
                {/* Avatar with Status Dot */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-2xl flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-md overflow-hidden">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={displayName} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <span>{firstName.charAt(0)}</span>
                    )}
                  </div>
                  <span 
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 shadow-sm" 
                    title="Online" 
                  />
                </div>

                {/* Identity Info & Actions */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {displayName}
                    </h3>
                    <CheckCircle2 size={16} className="text-indigo-500" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">•</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Member since Aug 2026
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {jobTitle}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 pt-0.5">
                    PNG, JPG, GIF or WebP. Recommended 400x400px.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => showToast('Avatar file selector opened')}
                    leftIcon={<Upload size={13} />}
                  >
                    Change Photo
                  </Button>
                </div>
              </div>

              {/* Email Verification Alert Banner */}
              {!isEmailVerified && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={16} className="text-amber-500 shrink-0" />
                    <div>
                      <span className="font-semibold">Email address not verified:</span>
                      <span className="text-amber-700 dark:text-amber-300 ml-1">
                        Please verify <strong className="font-mono">{userEmail}</strong> to enable security dispatches.
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleResendVerification}
                    leftIcon={<Send size={11} />}
                    className="border-amber-500/30 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0"
                  >
                    Resend Verification Link
                  </Button>
                </div>
              )}

              {/* Form Input Fields Grid */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Thompson"
                    required
                  />
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Manda"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Primary Email Address"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="name@company.com"
                    leftIcon={<Mail size={15} />}
                    helperText="Used for system alerts and security dispatches"
                  />
                  <Input
                    label="Phone Number"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+260 971 884 920"
                    leftIcon={<Phone size={15} />}
                    helperText="Direct contact & multi-factor verification"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Student ID / Member ID"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. STA-2026-001"
                    leftIcon={<IdCard size={15} />}
                    helperText="Issued by your school or organization identity provider"
                  />
                  <Input
                    label="Job Title / Department"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Lead Engineer"
                    leftIcon={<GraduationCap size={15} />}
                    helperText="Displayed in team directories and audit trails"
                  />
                </div>

                <Textarea
                  label="Personal Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell your team about yourself..."
                  rows={2}
                  helperText="Brief summary for team collaborators"
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/40 border-t border-slate-100 dark:border-white/5">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Last updated 24 minutes ago
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setFirstName(user.name ? user.name.split(' ')[0] : 'Thompson');
                    setLastName(user.name ? user.name.split(' ').slice(1).join(' ') : 'Manda');
                    showToast('Changes reverted');
                  }}
                >
                  Reset
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveProfile}>
                  Save Changes
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Regional & Localization Settings */}
          <Card>
            <CardHeader 
              title="Regional & Localization" 
              subtitle="Customize language, time formatting, and organization timezone"
              icon={<Globe size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      showToast(`Language set to ${e.target.value}`);
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="English (US)">English (US)</option>
                    <option value="English (UK)">English (UK)</option>
                    <option value="Français">Français</option>
                    <option value="Español">Español</option>
                    <option value="Deutsch">Deutsch</option>
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Primary interface language
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      showToast(`Timezone updated to ${e.target.value}`);
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Africa/Lusaka (CAT)">Africa/Lusaka (CAT, UTC+2)</option>
                    <option value="UTC (GMT)">UTC (GMT, UTC+0)</option>
                    <option value="America/New_York (EST)">America/New_York (EST, UTC-5)</option>
                    <option value="Europe/London (BST)">Europe/London (BST, UTC+1)</option>
                    <option value="Asia/Tokyo (JST)">Asia/Tokyo (JST, UTC+9)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <Clock size={10} /> Local clock preview: 15:04 CAT
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => {
                      setDateFormat(e.target.value);
                      showToast(`Date format set to ${e.target.value}`);
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-20)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (20/08/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (08/20/2026)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Formatted tables and audit logs
                  </p>
                </div>

              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* 2. APPEARANCE & THEME TAB */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-4xl">
          
          {/* Visual Theme Selector Cards */}
          <Card>
            <CardHeader
              title="Interface Color Palette & Theme"
              subtitle="Select how the dashboard looks across all screens and device views"
              icon={<Palette size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-6">
              
              {/* 3 Visual Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Light Theme Card */}
                <div
                  onClick={() => handleThemeChange('light')}
                  className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all ${
                    selectedThemeMode === 'light'
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <Sun size={16} />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">Crisp Light</span>
                    </div>
                    {selectedThemeMode === 'light' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        <Check size={12} />
                      </span>
                    )}
                  </div>

                  {/* Miniature UI Mockup */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-1.5 shadow-inner">
                    <div className="h-2 w-1/3 bg-slate-300 rounded" />
                    <div className="grid grid-cols-3 gap-1">
                      <div className="h-7 bg-white rounded border border-slate-200" />
                      <div className="h-7 bg-white rounded border border-slate-200" />
                      <div className="h-7 bg-indigo-100 rounded border border-indigo-200" />
                    </div>
                    <div className="h-4 bg-white rounded border border-slate-200" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5">
                    High clarity light canvas for daylight and well-lit office setups.
                  </p>
                </div>

                {/* Dark Twilight Card */}
                <div
                  onClick={() => handleThemeChange('dark')}
                  className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all ${
                    selectedThemeMode === 'dark'
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Moon size={16} />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">Dark Twilight</span>
                    </div>
                    {selectedThemeMode === 'dark' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        <Check size={12} />
                      </span>
                    )}
                  </div>

                  {/* Miniature UI Mockup */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 space-y-1.5 shadow-inner">
                    <div className="h-2 w-1/3 bg-zinc-700 rounded" />
                    <div className="grid grid-cols-3 gap-1">
                      <div className="h-7 bg-zinc-900 rounded border border-zinc-800" />
                      <div className="h-7 bg-zinc-900 rounded border border-zinc-800" />
                      <div className="h-7 bg-indigo-950/70 rounded border border-indigo-800/50" />
                    </div>
                    <div className="h-4 bg-zinc-900 rounded border border-zinc-800" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5">
                    OLED-optimized dark twilight aesthetic designed to reduce eye strain.
                  </p>
                </div>

                {/* System Auto Card */}
                <div
                  onClick={() => handleThemeChange('system')}
                  className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all ${
                    selectedThemeMode === 'system'
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                        <Monitor size={16} />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">System Preference</span>
                    </div>
                    {selectedThemeMode === 'system' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        <Check size={12} />
                      </span>
                    )}
                  </div>

                  {/* Miniature UI Mockup */}
                  <div className="rounded-xl border border-slate-300 dark:border-zinc-800 bg-gradient-to-r from-slate-100 to-zinc-950 p-2.5 space-y-1.5 shadow-inner">
                    <div className="h-2 w-1/3 bg-slate-400 dark:bg-zinc-600 rounded" />
                    <div className="grid grid-cols-3 gap-1">
                      <div className="h-7 bg-white dark:bg-zinc-900 rounded border border-slate-200 dark:border-zinc-800" />
                      <div className="h-7 bg-white dark:bg-zinc-900 rounded border border-slate-200 dark:border-zinc-800" />
                      <div className="h-7 bg-teal-100 dark:bg-teal-950/70 rounded border border-teal-200 dark:border-teal-800/50" />
                    </div>
                    <div className="h-4 bg-white dark:bg-zinc-900 rounded border border-slate-200 dark:border-zinc-800" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5">
                    Automatically matches your OS daylight schedule and display settings.
                  </p>
                </div>

              </div>

              {/* Accent Color Palette Chooser */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Primary Accent Color
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Controls primary buttons, sparklines, active indicators, and focus highlights
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { id: 'indigo', name: 'Indigo Electric', bg: 'bg-indigo-600' },
                    { id: 'emerald', name: 'Emerald Forest', bg: 'bg-emerald-600' },
                    { id: 'violet', name: 'Royal Violet', bg: 'bg-violet-600' },
                    { id: 'rose', name: 'Vibrant Rose', bg: 'bg-rose-600' },
                    { id: 'amber', name: 'Warm Amber', bg: 'bg-amber-500' },
                  ].map((color) => (
                    <button
                      key={color.id}
                      onClick={() => {
                        setAccentColor(color.id as any);
                        showToast(`Accent color set to ${color.name}`);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        accentColor === color.id
                          ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-zinc-800 shadow-sm'
                          : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${color.bg}`} />
                      <span className="text-slate-800 dark:text-zinc-200">{color.name}</span>
                      {accentColor === color.id && <Check size={12} className="text-indigo-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* UI Density Switcher */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Compact Table & List Density
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Reduces row padding in DataTables to fit 30% more data per viewport screen
                  </p>
                </div>
                <Switch
                  checked={density === 'compact'}
                  onChange={(checked) => {
                    setDensity(checked ? 'compact' : 'comfortable');
                    showToast(checked ? 'Compact density mode enabled' : 'Comfortable density mode enabled');
                  }}
                  label=""
                />
              </div>

            </CardContent>
          </Card>

        </div>
      )}

      {/* 3. SECURITY & SESSIONS TAB */}
      {activeTab === 'security' && (
        <div className="space-y-6 max-w-4xl">
          
          {/* Password & Credentials */}
          <Card>
            <CardHeader
              title="Password & Authentication Credentials"
              subtitle="Manage your primary password, login methods, and hardware keys"
              icon={<Lock size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Lock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Account Password
                      </h4>
                      <Badge variant="success" size="xs">
                        Strong Rating
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Last changed 42 days ago • Enforces 14+ characters, uppercase, and symbols
                    </p>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleChangePassword}
                  leftIcon={<Lock size={13} />}
                  className="shrink-0"
                >
                  Change Password
                </Button>
              </div>

              <div className="space-y-4 pt-2">
                <Switch
                  checked={mfaEnabled}
                  onChange={(v) => {
                    setMfaEnabled(v);
                    showToast(v ? '2FA Enabled' : '2FA Disabled');
                  }}
                  label="Two-Factor Authentication (2FA / TOTP)"
                  description="Requires 6-digit one-time code from Google Authenticator, 1Password, or YubiKey."
                />
                
                <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
                
                <Switch
                  checked={sessionTimeout}
                  onChange={(v) => {
                    setSessionTimeout(v);
                    showToast(v ? '15-min idle timeout activated' : 'Idle timeout disabled');
                  }}
                  label="Strict 15-Minute Session Inactivity Timeout"
                  description="Automatically locks dashboard console after 15 minutes of idle cursor time."
                />
                
                <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
                
                <Switch
                  checked={ipWhitelist}
                  onChange={(v) => {
                    setIpWhitelist(v);
                    showToast(v ? 'IP whitelist restricted' : 'IP whitelist opened');
                  }}
                  label="IP Allowlist Restriction"
                  description="Restricts administrative portal access strictly to trusted corporate VPN CIDR blocks."
                />
              </div>
            </CardContent>
          </Card>

          {/* Active Device Sessions */}
          <Card>
            <CardHeader
              title="Active Device Sessions"
              subtitle="Devices currently authenticated to this administrative account"
              icon={<ShieldCheck size={18} className="text-indigo-500" />}
              action={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleRevokeOtherSessions}
                  leftIcon={<Trash2 size={12} />}
                >
                  Revoke Other Sessions
                </Button>
              }
            />
            <CardContent className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${session.isCurrent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                      {session.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{session.device}</span>
                        {session.isCurrent && (
                          <Badge variant="success" size="xs">Current Device</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {session.location} • IP: {session.ip} • <span className="font-medium text-slate-700 dark:text-zinc-300">{session.lastActive}</span>
                      </p>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        setActiveSessions(activeSessions.filter(s => s.id !== session.id));
                        showToast(`Session on ${session.device} terminated`);
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      )}

      {/* 4. WORKSPACE TAB */}
      {activeTab === 'workspace' && (
        <div className="space-y-5 max-w-4xl">
          <Card>
            <CardHeader 
              title="Workspace Identity & Moniker" 
              subtitle="Organization branding, slug domain, and company attributes"
              icon={<Building2 size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Workspace Name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Acme Corp Production"
                />
                <Input
                  label="Workspace Slug / Vanity URL"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value)}
                  helperText="Custom root domains require Enterprise plan"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Input
                  label="Primary Contact Email"
                  defaultValue="ops@acme-corp.io"
                  helperText="Recipient of system outage and billing notices"
                />
                <Input
                  label="Default Deployment Region"
                  defaultValue="europe-west2 (London)"
                  disabled
                  helperText="Managed by cloud infrastructure cluster"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="primary" size="sm" onClick={() => showToast('Workspace settings saved!')}>
                Save Workspace
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* 5. API KEYS TAB */}
      {activeTab === 'apikeys' && (
        <div className="space-y-5 max-w-4xl">
          <Card>
            <CardHeader
              title="API Access Tokens & Secret Credentials"
              subtitle="Tokens used for server-side REST API, Webhooks, and programmatic integrations"
              icon={<Key size={18} className="text-indigo-500" />}
              action={
                <Button
                  variant="primary"
                  size="xs"
                  onClick={handleGenerateKey}
                  leftIcon={<Plus size={13} />}
                >
                  Generate New Token
                </Button>
              }
            />
            <CardContent className="space-y-3">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate">{k.name}</span>
                      <Badge variant="success" size="sm">Active</Badge>
                    </div>
                    <p className="font-mono text-slate-500 dark:text-zinc-400 text-[11px]">{k.prefix}****************</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Created: {k.created} • Last used: {k.lastUsed}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => copyKey(k.id, `${k.prefix}_full_key_token`)}
                      leftIcon={copiedKeyId === k.id ? <Check size={12} /> : <Copy size={12} />}
                    >
                      {copiedKeyId === k.id ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => handleDeleteKey(k.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="space-y-5 max-w-4xl">
          <Card>
            <CardHeader 
              title="Notification Channels & Alerts" 
              subtitle="Configure email dispatches, webhook broadcasts, and incident summaries"
              icon={<Bell size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-4">
              <Switch
                checked={emailAlerts}
                onChange={setEmailAlerts}
                label="Urgent Email Incident Alerts"
                description="Receive instant dispatch emails on error rate spikes or cluster outage events."
              />
              <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
              <Switch
                checked={slackWebhook}
                onChange={setSlackWebhook}
                label="Slack / Discord Webhook Notifications"
                description="Broadcast high-priority transactions and security flags to dedicated channel."
              />
              <div className="border-t border-slate-100 dark:border-white/5 pt-3" />
              <Switch
                checked={weeklyDigest}
                onChange={setWeeklyDigest}
                label="Weekly Analytics & Ledger Digest"
                description="Send summary executive reports every Monday morning at 08:00."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7. BILLING TAB */}
      {activeTab === 'billing' && (
        <div className="space-y-5 max-w-4xl">
          <Card>
            <CardHeader 
              title="Current Subscription & Plan Limits" 
              subtitle="Manage your enterprise subscription, invoices, and quota allocation"
              icon={<CreditCard size={18} className="text-indigo-500" />}
            />
            <CardContent className="space-y-4">
              <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-base">Enterprise Scale Tier</span>
                    <Badge variant="purple" size="sm">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    $1,250.00 / month • Renews on Sep 01, 2026 • 99.99% Uptime SLA Guaranteed
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => showToast('Invoices downloaded')}>
                    View Invoices
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => showToast('Plan upgrade portal opening...')}>
                    Upgrade Plan
                  </Button>
                </div>
              </div>

              {/* Usage Quota Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">API Requests</span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-1">842.1k / 1.0M</p>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full w-[84%]" />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Database Storage</span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-1">24.5 GB / 50 GB</p>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[49%]" />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Active Seats</span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-1">12 / 25 Members</p>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full w-[48%]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};

export default SettingsView;
