import React, { useState } from 'react';
import { 
  GraduationCap, 
  ArrowLeft, 
  Sparkles, 
  Crown, 
  BookOpen, 
  Feather, 
  ArrowRight, 
  Check, 
  Lock, 
  Mail, 
  Key, 
  ShieldCheck, 
  Globe,
  Compass,
  CheckCircle2,
  Github,
  Sun,
  Moon
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginPageProps {
  onLogin: (userData?: Partial<UserProfile>) => void;
  onBackToApp?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ 
  onLogin, 
  onBackToApp, 
  theme = 'dark', 
  onToggleTheme 
}) => {
  const [authMode, setAuthMode] = useState<'options' | 'credentials'>('options');
  const [isRegister, setIsRegister] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('thompsonmanda08@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('Thompson Manda');
  const [rememberMe, setRememberMe] = useState(true);

  const isLight = theme === 'light';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      name: name || 'Thompson Manda',
      email: email || 'thompsonmanda08@gmail.com',
      userType: isRegister ? 'Learner' : 'Creator',
    });
  };

  const handleChooseOption = (type: 'pro' | 'browse' | 'creator') => {
    if (type === 'pro') {
      onLogin({
        plan: 'PRO',
        userType: 'Creator',
        planDescription: 'Unlock full-access, Study, Quizzing engine, and custom workflows.'
      });
    } else if (type === 'browse') {
      onLogin({
        plan: 'HOBBY',
        userType: 'Learner',
        planDescription: 'Free browsing mode. Access free catalog courses.'
      });
    } else {
      onLogin({
        plan: 'CREATOR',
        userType: 'Creator',
        planDescription: 'Free creator tier. Build & publish courses and quizzes.'
      });
    }
  };

  return (
    <div className={`min-h-screen w-full font-sans flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300 ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-zinc-950 text-zinc-100'
    }`}>
      
      {/* Background Ambient Glows */}
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none ${
        isLight ? 'bg-indigo-300/30' : 'bg-indigo-600/15'
      }`} />
      <div className={`absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none ${
        isLight ? 'bg-purple-300/30' : 'bg-purple-600/15'
      }`} />

      {/* Grid Pattern Overlay */}
      <div 
        className={`absolute inset-0 pointer-events-none [background-size:24px_24px] ${
          isLight 
            ? 'opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)]' 
            : 'opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)]'
        }`}
      />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-between py-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className={`w-full h-full rounded-[14px] flex items-center justify-center ${
              isLight ? 'bg-white text-indigo-600' : 'bg-zinc-950 text-white'
            }`}>
              <GraduationCap size={20} />
            </div>
          </div>
          <div>
            <span className={`text-base font-extrabold tracking-tight flex items-center gap-1.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Apex Learn
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded-full">
                v2.4
              </span>
            </span>
            <p className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              Next-gen learning & course builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                isLight 
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-slate-200/50' 
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
              }`}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
            >
              {isLight ? <Moon size={14} className="text-indigo-600" /> : <Sun size={14} className="text-amber-400" />}
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                isLight 
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' 
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/10'
              }`}
            >
              <ArrowLeft size={14} />
              <span>Back to App</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container - Split Card Layout */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* LEFT PANEL: Branding & Value Proposition (5 Cols) */}
          <div className={`lg:col-span-5 border rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl backdrop-blur-2xl transition-all ${
            isLight 
              ? 'bg-gradient-to-b from-white via-slate-50 to-white border-slate-200/80 text-slate-900 shadow-slate-200/60' 
              : 'bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-950 border-white/10 text-white'
          }`}>
            {/* Ambient inner glow */}
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
              isLight ? 'bg-indigo-200/40' : 'bg-indigo-500/10'
            }`} />
            <div className={`absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
              isLight ? 'bg-purple-200/40' : 'bg-purple-500/10'
            }`} />

            <div>
              {/* Header inside left panel */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <GraduationCap size={18} />
                  <span className="tracking-wide uppercase text-[11px]">Apex Learn</span>
                </div>

                <div className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 ${
                  isLight ? 'text-slate-400' : 'text-zinc-500'
                }`}>
                  <Globe size={11} className="text-emerald-500" />
                  <span>Global Platform</span>
                </div>
              </div>

              {/* Main Headline */}
              <h1 className={`text-3xl sm:text-4xl font-black tracking-tight leading-[1.15] mb-3 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                Your learning, <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 dark:from-indigo-400 dark:via-purple-300 dark:to-emerald-400 bg-clip-text text-transparent">
                  on your terms.
                </span>
              </h1>

              <p className={`text-sm font-medium italic mb-8 ${
                isLight ? 'text-indigo-800' : 'text-indigo-300/90'
              }`}>
                Built for creators & learners everywhere. Loved by professionals.
              </p>

              {/* Numbered Feature Highlights matching the image layout */}
              <div className="space-y-4 my-6">
                
                <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors group ${
                  isLight 
                    ? 'bg-slate-50/80 border-slate-200/60 hover:border-slate-300' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}>
                  <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    /01
                  </span>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'}>School Management System + Learning Platform</strong> in one seamless, high-speed experience.
                  </p>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors group ${
                  isLight 
                    ? 'bg-slate-50/80 border-slate-200/60 hover:border-slate-300' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}>
                  <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    /02
                  </span>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'}>Verifiable completion certificates</strong> issued automatically with every finished course.
                  </p>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors group ${
                  isLight 
                    ? 'bg-slate-50/80 border-slate-200/60 hover:border-slate-300' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}>
                  <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    /03
                  </span>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'}>Learn at your own pace</strong> from any device with AI-powered study assistance.
                  </p>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors group ${
                  isLight 
                    ? 'bg-slate-50/80 border-slate-200/60 hover:border-slate-300' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}>
                  <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    /04
                  </span>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'}>AI Quizzing & SyncUp live rooms</strong> built around modern interactive standards.
                  </p>
                </div>

              </div>
            </div>

            {/* Left Panel Footer */}
            <div className={`pt-6 border-t flex items-center justify-between text-[11px] ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-white/5 text-zinc-500'
            }`}>
              <span className="font-mono">— Apex Learn Platform</span>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Systems Operational</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Onboarding Cards or Credential Form (7 Cols) */}
          <div className={`lg:col-span-7 border rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative shadow-2xl backdrop-blur-2xl transition-all ${
            isLight 
              ? 'bg-white/90 border-slate-200/80 text-slate-900 shadow-slate-200/60' 
              : 'bg-zinc-900/60 border-white/10 text-white'
          }`}>
            
            <div>
              {/* Header Mode Switcher (Option Cards vs Credential Login) */}
              <div className={`flex items-center justify-between mb-6 pb-4 border-b ${
                isLight ? 'border-slate-200' : 'border-white/10'
              }`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuthMode('options')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      authMode === 'options'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                        : isLight 
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    Quick Start
                  </button>
                  <button
                    onClick={() => setAuthMode('credentials')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      authMode === 'credentials'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                        : isLight 
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    Sign In with Password
                  </button>
                </div>

                <span className={`text-xs font-medium hidden sm:inline-block ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  {authMode === 'options' ? 'Choose onboarding path' : isRegister ? 'Create account' : 'Welcome back'}
                </span>
              </div>

              {/* MODE 1: Onboarding Choice Cards (Matching uploaded image layout) */}
              {authMode === 'options' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* Option 1: Subscribe to a plan (RECOMMENDED) */}
                  <div 
                    onClick={() => handleChooseOption('pro')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                      isLight 
                        ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10' 
                        : 'border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-zinc-900/80 hover:border-indigo-500/60 hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 shadow-md transition-colors">
                        <Crown size={20} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-sm font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}>
                            Subscribe to a plan
                          </h3>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                            <Sparkles size={9} /> RECOMMENDED
                          </span>
                        </div>

                        <p className={`text-xs leading-relaxed mb-3 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                          Pick your tier, get a 7-day free trial, then continue from <strong className={isLight ? 'text-slate-900' : 'text-zinc-200'}>$15/month</strong>.
                        </p>

                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-all">
                          <span>Choose this</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Just browse */}
                  <div 
                    onClick={() => handleChooseOption('browse')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative ${
                      isLight 
                        ? 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/80 shadow-sm' 
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center shrink-0 shadow-md transition-colors">
                        <BookOpen size={20} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-sm font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-200 transition-colors ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}>
                            Just browse
                          </h3>
                        </div>

                        <p className={`text-xs leading-relaxed mb-3 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                          Skip the subscription. Browse the catalog and pay only for the courses you want.
                        </p>

                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-all">
                          <span>Choose this</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Become a creator (FREE) */}
                  <div 
                    onClick={() => handleChooseOption('creator')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative ${
                      isLight 
                        ? 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/80 shadow-sm' 
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-600 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center shrink-0 shadow-md transition-colors">
                        <Feather size={20} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-sm font-bold group-hover:text-purple-600 dark:group-hover:text-purple-200 transition-colors ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}>
                            Become a creator
                          </h3>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded-full">
                            FREE
                          </span>
                        </div>

                        <p className={`text-xs leading-relaxed mb-3 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                          Publish your own courses, study material and quizzes — no school, no card required.
                        </p>

                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-all">
                          <span>Choose this</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* MODE 2: Direct Password / OAuth Form */}
              {authMode === 'credentials' && (
                <form onSubmit={handleFormSubmit} className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* Social Buttons */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => onLogin({ name: 'Google Learner', email: 'google.user@apex.learn' })}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isLight 
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                          : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onLogin({ name: 'GitHub Developer', email: 'github.dev@apex.learn' })}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isLight 
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                          : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                      }`}
                    >
                      <Github size={16} />
                      <span>GitHub</span>
                    </button>
                  </div>

                  <div className="relative flex items-center my-4">
                    <div className={`flex-grow border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />
                    <span className={`flex-shrink mx-3 text-[10px] uppercase font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>Or email</span>
                    <div className={`flex-grow border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />
                  </div>

                  {isRegister && (
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className={`w-full px-3.5 py-2.5 rounded-xl border focus:border-indigo-500 text-xs outline-none transition-all ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-900' 
                            : 'bg-zinc-950 border-white/10 text-white'
                        }`}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>Email Address</label>
                    <div className="relative">
                      <Mail size={15} className={`absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border focus:border-indigo-500 text-xs outline-none transition-all ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-900' 
                            : 'bg-zinc-950 border-white/10 text-white'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>Password</label>
                      {!isRegister && (
                        <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                          Forgot password?
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <Key size={15} className={`absolute left-3.5 top-3 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border focus:border-indigo-500 text-xs outline-none transition-all ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-900' 
                            : 'bg-zinc-950 border-white/10 text-white'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className={`flex items-center gap-2 cursor-pointer text-xs ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-zinc-950 border-white/20 text-indigo-600 focus:ring-0"
                      />
                      <span>Remember this device</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all flex items-center justify-center gap-2 active:scale-98 mt-2"
                  >
                    <span>{isRegister ? 'Create Apex Learn Account' : 'Sign In to Apex Learn'}</span>
                    <ArrowRight size={15} />
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRegister(!isRegister)}
                      className={`text-xs transition-colors ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {isRegister ? (
                        <>Already have an account? <strong className="text-indigo-600 dark:text-indigo-400">Sign in</strong></>
                      ) : (
                        <>Don't have an account? <strong className="text-indigo-600 dark:text-indigo-400">Register</strong></>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </div>

            {/* Bottom Footer Section */}
            <div className={`pt-6 mt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left ${
              isLight ? 'border-slate-200' : 'border-white/5'
            }`}>
              <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                Already have an account?{' '}
                <button 
                  onClick={() => setAuthMode('credentials')}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Sign in
                </button>
              </p>

              <span className={`text-[11px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                © 2026 APEX LEARN
              </span>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto pt-4 pb-2 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-zinc-300 transition-colors">Terms of Service</a>
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
          <a href="#support" onClick={(e) => e.preventDefault()} className="hover:text-zinc-300 transition-colors">Help Center</a>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Encrypted 256-bit SSL Connection</span>
        </div>
      </footer>

    </div>
  );
};

export default LoginPage;
