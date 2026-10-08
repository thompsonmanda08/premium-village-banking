import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Terminal, 
  Download, 
  Filter, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Eye
} from 'lucide-react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import Drawer from '../ui/Drawer';
import { sampleAuditLogs } from '../../data/dashboardData';
import { SystemAuditLog } from '../../types';

interface ActivityLogsViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({
  theme,
  showToast,
}) => {
  const [logs, setLogs] = useState<SystemAuditLog[]>(sampleAuditLogs);
  const [activeLog, setActiveLog] = useState<SystemAuditLog | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'warning' | 'error' | 'info'>('all');

  const filteredLogs = filterStatus === 'all'
    ? logs
    : logs.filter((l) => l.status === filterStatus);

  const statusIcons = {
    success: <CheckCircle2 size={15} className="text-emerald-500" />,
    warning: <AlertTriangle size={15} className="text-amber-500" />,
    error: <XCircle size={15} className="text-rose-500" />,
    info: <Info size={15} className="text-sky-500" />,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Audit Trails & Security Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Immutable timeline of workspace administrative events and API actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => showToast('Exporting security audit log (JSON)...')}
            leftIcon={<Download size={14} />}
          >
            Export Log
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'success', 'warning', 'info'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all ${
              filterStatus === s
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Audit Log Timeline Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 text-slate-500 dark:text-zinc-400 font-semibold">
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Event Description</th>
              <th className="py-3 px-4">Target Resource</th>
              <th className="py-3 px-4">Source IP</th>
              <th className="py-3 px-4 text-right">Time</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredLogs.map((log) => (
              <tr
                key={log.id}
                onClick={() => setActiveLog(log)}
                className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <td className="py-3.5 px-4">{statusIcons[log.status]}</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar src={log.actor.avatar} name={log.actor.name} size="xs" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.actor.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{log.actor.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                  {log.action}
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 truncate max-w-xs">
                  {log.target}
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-400 dark:text-zinc-500">
                  {log.ipAddress}
                </td>
                <td className="py-3.5 px-4 text-right text-slate-400 dark:text-zinc-500 font-mono">
                  {log.timestamp}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Eye size={14} className="text-slate-400 dark:text-zinc-500 hover:text-indigo-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log Details Drawer */}
      <Drawer
        isOpen={Boolean(activeLog)}
        onClose={() => setActiveLog(null)}
        title="Audit Log Event Inspector"
        subtitle={`Event ID: ${activeLog?.id}`}
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveLog(null)}>
            Close Inspector
          </Button>
        }
      >
        {activeLog && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Status</span>
                <Badge variant={activeLog.status === 'success' ? 'success' : 'warning'} size="sm" dot>
                  {activeLog.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Timestamp</span>
                <span className="font-mono text-slate-800 dark:text-white">{activeLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Origin IP</span>
                <span className="font-mono text-slate-800 dark:text-white">{activeLog.ipAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Target</span>
                <span className="font-mono text-slate-800 dark:text-white">{activeLog.target}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white">Payload Snapshot (JSON)</h4>
              <pre className="p-3 bg-slate-900 text-indigo-300 rounded-xl font-mono text-[11px] overflow-x-auto">
{JSON.stringify(
  {
    event: activeLog.action,
    actor_id: activeLog.actor.email,
    target_resource: activeLog.target,
    ip: activeLog.ipAddress,
    tls_version: 'TLSv1.3',
    signature_valid: true
  },
  null,
  2
)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
};

export default ActivityLogsView;
