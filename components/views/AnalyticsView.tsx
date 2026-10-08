import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Globe, 
  Zap, 
  ArrowUpRight, 
  Clock, 
  Download, 
  Calendar,
  Filter,
  Layers
} from 'lucide-react';
import Card, { CardHeader, CardContent, CardFooter } from '../ui/Card';
import StatCard from '../ui/StatCard';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { AreaMetricChart, BarComparisonChart, DonutDistributionChart } from '../ui/Charts';
import { revenueChartData } from '../../data/dashboardData';

interface AnalyticsViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  theme,
  showToast,
}) => {
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d');

  const requestStats = [
    { name: '00:00', requests: 12400, latency: 22 },
    { name: '04:00', requests: 8200, latency: 19 },
    { name: '08:00', requests: 28500, latency: 26 },
    { name: '12:00', requests: 45000, latency: 31 },
    { name: '16:00', requests: 38200, latency: 25 },
    { name: '20:00', requests: 22100, latency: 21 },
  ];

  const regionalTraffic = [
    { country: 'United States (us-east-1)', share: 44, latency: '18ms', status: 'Optimal' },
    { country: 'Europe (eu-west-1)', share: 28, latency: '24ms', status: 'Optimal' },
    { country: 'Asia Pacific (ap-southeast-1)', share: 18, latency: '35ms', status: 'Optimal' },
    { country: 'Latin America (sa-east-1)', share: 10, latency: '42ms', status: 'Good' },
  ];

  const deviceData = [
    { name: 'Desktop (Chrome/Safari)', value: 62, color: '#6366f1' },
    { name: 'Mobile Devices (iOS/Android)', value: 31, color: '#10b981' },
    { name: 'Tablet & Embedded APIs', value: 7, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics & Performance Telemetry
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Real-time traffic metrics, API throughput, and latency distribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/5">
            {(['7d', '30d', '90d', '12m'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedRange === r
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => showToast('Exporting metrics report (CSV)...')}
            leftIcon={<Download size={14} />}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total API Calls"
          value="4.82M"
          change="+24.1%"
          isPositive={true}
          color="indigo"
          sparkline={[30, 45, 55, 60, 72, 85, 95]}
        />
        <StatCard
          label="Avg Global Latency"
          value="24.3 ms"
          change="-6.5%"
          isPositive={true}
          color="emerald"
          sparkline={[35, 32, 28, 29, 26, 25, 24.3]}
        />
        <StatCard
          label="Error Rate (4xx / 5xx)"
          value="0.02%"
          change="Within SLA"
          isPositive={true}
          color="purple"
          sparkline={[0.08, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02]}
        />
        <StatCard
          label="Active Client Sessions"
          value="18,409"
          change="+12.0%"
          isPositive={true}
          color="blue"
          sparkline={[12, 14, 15, 16, 17, 18, 18.4]}
        />
      </div>

      {/* Main Charts: Daily Volume & Latency breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader
            title="Hourly API Throughput"
            subtitle="Request volume processed across all edge points"
            icon={<Zap size={16} />}
          />
          <CardContent>
            <BarComparisonChart
              data={requestStats}
              bars={[{ key: 'requests', name: 'Requests', color: '#6366f1' }]}
              height={230}
              theme={theme}
            />
          </CardContent>
          <CardFooter>
            <span className="text-xs text-slate-500 dark:text-zinc-400">Peak hour: 12:00 UTC (45,000 req/sec)</span>
            <Badge variant="success" size="sm" dot>Normal Load</Badge>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="User Growth & Cohort Retention"
            subtitle="Monthly registered users vs active recurring profiles"
            icon={<TrendingUp size={16} />}
          />
          <CardContent>
            <AreaMetricChart
              data={revenueChartData}
              series={[{ key: 'users', name: 'Active Users', color: '#10b981' }]}
              height={230}
              theme={theme}
            />
          </CardContent>
          <CardFooter>
            <span className="text-xs text-slate-500 dark:text-zinc-400">+8.4% month-over-month expansion</span>
            <Badge variant="primary" size="sm">Healthy Growth</Badge>
          </CardFooter>
        </Card>
      </div>

      {/* Regional breakdown & Device Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Regional Edge Latency & Traffic Share"
              subtitle="Performance by deployment cluster zone"
              icon={<Globe size={16} />}
            />
            <CardContent className="space-y-4">
              {regionalTraffic.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.country}</span>
                      <Badge variant="success" size="sm">{item.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 dark:text-zinc-500">{item.latency}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{item.share}%</span>
                    </div>
                  </div>
                  <ProgressBar value={item.share} color="indigo" size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader
              title="Device Distribution"
              subtitle="Client user agent segmentation"
            />
            <CardContent>
              <DonutDistributionChart
                data={deviceData}
                height={170}
                theme={theme}
                centerValue="100%"
                centerLabel="Total Clients"
              />
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-white/5">
                {deviceData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-600 dark:text-zinc-300 font-medium">{d.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{d.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsView;
