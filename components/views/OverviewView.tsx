import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity, 
  ArrowUpRight, 
  CreditCard, 
  Calendar,
  Sparkles,
  Download,
  Filter,
  Plus,
  Zap,
  ShieldCheck,
  Server,
  Layers
} from 'lucide-react';
import StatCard from '../ui/StatCard';
import Card, { CardHeader, CardContent, CardFooter } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar, { AvatarGroup } from '../ui/Avatar';
import ProgressBar from '../ui/ProgressBar';
import DataTable, { ColumnDef } from '../ui/DataTable';
import { AreaMetricChart, DonutDistributionChart } from '../ui/Charts';
import WelcomeCard from '../WelcomeCard';
import StreakCard from '../StreakCard';
import SupportCard from '../SupportCard';
import CalendarWidget from '../edutech/CalendarWidget';
import { sampleCalendarEvents } from '../../data/edutechData';
import { 
  sampleMetrics, 
  revenueChartData, 
  trafficSourceData, 
  sampleTransactions,
  sampleAuditLogs
} from '../../data/dashboardData';
import { TransactionRecord, UserProfile, Workspace } from '../../types';

interface OverviewViewProps {
  user: UserProfile;
  workspace: Workspace;
  theme: 'dark' | 'light';
  onNavigate: (nav: string) => void;
  onOpenModal: (modal: any) => void;
  onSelectTransaction?: (tx: TransactionRecord) => void;
  showToast?: (message: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  user,
  workspace,
  theme,
  onNavigate,
  onOpenModal,
  onSelectTransaction,
  showToast,
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '12m'>('30d');
  const [metricFilter, setMetricFilter] = useState<'all' | 'revenue' | 'users'>('all');
  const [streakDays, setStreakDays] = useState(user.streakDays || 5);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const handleCheckIn = () => {
    if (!hasCheckedIn) {
      setHasCheckedIn(true);
      setStreakDays(prev => prev + 1);
      if (showToast) {
        showToast("🔥 Daily check-in complete! Streak increased to " + (streakDays + 1) + " days!");
      }
    } else {
      if (showToast) {
        showToast("You've already checked in for today!");
      }
    }
  };

  const handleToggleStatus = (isOnline: boolean) => {
    if (showToast) {
      showToast(isOnline ? "🟢 Storefront & system status is now Online" : "🟡 Storefront is now in maintenance mode");
    }
  };

  const handleOpenStorefront = () => {
    if (showToast) {
      showToast("Opening live storefront preview...");
    }
    onNavigate('records');
  };

  const transactionColumns: ColumnDef<TransactionRecord>[] = [
    {
      key: 'customerName',
      header: 'Customer',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={item.customerAvatar} name={item.customerName} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white truncate">{item.customerName}</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{item.customerEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Plan / Item',
      render: (item) => (
        <span className="text-slate-600 dark:text-zinc-300 font-medium">{item.category}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (item) => {
        const variants: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
          Completed: 'success',
          Pending: 'warning',
          Failed: 'danger',
          Refunded: 'info',
        };
        return (
          <Badge variant={variants[item.status] || 'neutral'} size="sm" dot>
            {item.status}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      render: (item) => (
        <span className="text-slate-400 dark:text-zinc-500">{item.date}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Previous Version Control Cards (Welcome, Streak, Support) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WelcomeCard
          userName={user.name.split(' ')[0]}
          theme={theme}
          onOpenStorefront={handleOpenStorefront}
          onToggleStatus={handleToggleStatus}
        />
        <StreakCard
          days={streakDays}
          target={user.streakTarget || 7}
          theme={theme}
          isCheckedIn={hasCheckedIn}
          onCheckIn={handleCheckIn}
        />
        <SupportCard
          theme={theme}
          onOpenSupport={() => onOpenModal('support')}
        />
      </div>

      {/* Top Banner & Quick Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-zinc-900/60 border border-indigo-500/20 p-6 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={14} /> Modular Dashboard Template
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                Live Preview
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Welcome back, {user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
              All core services are performing normally. You have 4 active projects, $124.5k gross volume, and 99.98% system uptime across all clusters.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('showcase')}
              leftIcon={<Layers size={14} />}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              UI Showcase
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenModal('new-workspace')}
              leftIcon={<Plus size={14} />}
            >
              New Entity
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sampleMetrics.map((m) => (
          <StatCard
            key={m.id}
            label={m.label}
            value={m.value}
            change={m.change}
            isPositive={m.isPositive}
            period={m.period}
            sparkline={m.sparkline}
            color={m.color}
            icon={
              m.id === 'm1' ? <DollarSign size={16} /> :
              m.id === 'm2' ? <Users size={16} /> :
              m.id === 'm3' ? <TrendingUp size={16} /> :
              <Activity size={16} />
            }
            onClick={() => onNavigate('analytics')}
          />
        ))}
      </div>

      {/* Charts Section: Main Area Chart + Donut Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Area Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Revenue & Growth Trajectory"
              subtitle="Monthly recurring revenue vs infrastructure costs"
              action={
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-white/5">
                  {(['7d', '30d', '12m'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setTimeRange(r)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        timeRange === r
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              }
            />
            <CardContent>
              <AreaMetricChart
                data={revenueChartData}
                series={[
                  { key: 'revenue', name: 'Revenue ($)', color: '#6366f1' },
                  { key: 'expenses', name: 'Expenses ($)', color: '#ec4899' },
                ]}
                height={260}
                theme={theme}
              />
            </CardContent>
            <CardFooter>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-slate-600 dark:text-zinc-300 font-medium">Revenue</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">$124,592</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                  <span className="text-slate-600 dark:text-zinc-300 font-medium">Expenses</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">$51,000</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onNavigate('analytics')}
                rightIcon={<ArrowUpRight size={12} />}
              >
                Detailed Reports
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Traffic Channels Donut Chart */}
        <div>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader
              title="Traffic Distribution"
              subtitle="Acquisition breakdown by channel"
            />
            <CardContent>
              <DonutDistributionChart
                data={trafficSourceData}
                height={180}
                theme={theme}
                centerValue="100%"
                centerLabel="Total Share"
              />

              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-white/5">
                {trafficSourceData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 dark:text-zinc-300 font-medium">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Bottom Grid: Recent Transactions Table + Quick Health/Resource Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Transactions Smart Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Recent Transactions & Events
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Latest customer purchases and billing ledger entries
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onNavigate('records')}
              rightIcon={<ArrowUpRight size={12} />}
            >
              View All Records
            </Button>
          </div>

          <DataTable
            data={sampleTransactions}
            columns={transactionColumns}
            keyExtractor={(item) => item.id}
            pageSize={4}
            searchable={false}
            onRowClick={(item) => onSelectTransaction && onSelectTransaction(item)}
          />
        </div>

        {/* System & Resource Monitor Card & Academic Calendar Widget */}
        <div className="space-y-4">
          <CalendarWidget
            events={sampleCalendarEvents}
            onOpenFullCalendar={() => onNavigate('edutech')}
            onAddEvent={() => onNavigate('edutech')}
          />

          <Card>
            <CardHeader
              title="Infrastructure & Limits"
              subtitle="Current quota consumption"
              icon={<Server size={16} />}
            />
            <CardContent className="space-y-3.5">
              <ProgressBar
                label="API Requests Quota"
                value={42.5}
                color="indigo"
                size="sm"
              />
              <ProgressBar
                label="Storage Volume (SSD)"
                value={68}
                color="emerald"
                size="sm"
              />
              <ProgressBar
                label="Compute Engine Memory"
                value={81}
                color="amber"
                size="sm"
              />
            </CardContent>
            <CardFooter>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Auto-scales at 85%
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onOpenModal('usage')}
              >
                Manage Limits
              </Button>
            </CardFooter>
          </Card>

          {/* Quick Team Presence Card */}
          <Card>
            <CardHeader
              title="Active Team Collaborators"
              subtitle="3 teammates currently online"
              icon={<Users size={16} />}
            />
            <CardContent>
              <div className="flex items-center justify-between">
                <AvatarGroup
                  avatars={[
                    { name: 'Sarah Jenkins', src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
                    { name: 'David Chen', src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
                    { name: 'Elena Rostova', src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
                    { name: 'Alex Rivera' },
                  ]}
                  max={3}
                  size="md"
                />
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onOpenModal('workspace')}
                >
                  Invite +
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
};

export default OverviewView;
