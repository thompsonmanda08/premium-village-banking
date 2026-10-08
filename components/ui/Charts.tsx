import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export interface AreaMetricChartProps {
  data: Array<{ name: string; [key: string]: any }>;
  series: Array<{
    key: string;
    name?: string;
    color: string;
    gradientFrom?: string;
    gradientTo?: string;
  }>;
  height?: number;
  showGrid?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export const AreaMetricChart: React.FC<AreaMetricChartProps> = ({
  data,
  series,
  height = 240,
  showGrid = true,
  theme = 'dark',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#71717a' : '#64748b';

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {series.map((s, idx) => (
              <linearGradient key={idx} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
              </linearGradient>
            ))}
          </defs>

          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />}

          <XAxis
            dataKey="name"
            stroke={textColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={textColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
              color: isDark ? '#ffffff' : '#0f172a',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
            }}
          />

          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name || s.key}
              stroke={s.color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${s.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface BarComparisonChartProps {
  data: Array<{ name: string; [key: string]: any }>;
  bars: Array<{
    key: string;
    name?: string;
    color: string;
  }>;
  height?: number;
  theme?: 'dark' | 'light';
  className?: string;
}

export const BarComparisonChart: React.FC<BarComparisonChartProps> = ({
  data,
  bars,
  height = 220,
  theme = 'dark',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#71717a' : '#64748b';

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" stroke={textColor} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={textColor} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
              color: isDark ? '#ffffff' : '#0f172a',
            }}
          />
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name || b.key}
              fill={b.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface DonutDistributionChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  theme?: 'dark' | 'light';
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

export const DonutDistributionChart: React.FC<DonutDistributionChartProps> = ({
  data,
  height = 200,
  innerRadius = 55,
  outerRadius = 75,
  theme = 'dark',
  centerLabel,
  centerValue,
  className = '',
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
              color: isDark ? '#ffffff' : '#0f172a',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {centerValue && (
            <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
