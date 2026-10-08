import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  QrCode,
  Smartphone,
  Scan,
  Users,
  Send,
  Download,
  Flame,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Calendar as CalendarIcon,
  MessageSquare,
  Lock
} from 'lucide-react';
import { AttendanceSession, AttendanceRecord, AttendanceStatus } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

interface AttendanceRegisterProps {
  initialSessions: AttendanceSession[];
  showToast?: (message: string) => void;
}

export const AttendanceRegister: React.FC<AttendanceRegisterProps> = ({
  initialSessions,
  showToast = (msg) => console.log(msg)
}) => {
  const [sessions, setSessions] = useState<AttendanceSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessions[0]?.id || '');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);
  const [remarksStudent, setRemarksStudent] = useState<{ id: string; name: string; remarks: string } | null>(null);

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  // Helper to recalculate counts
  const updateSessionRecords = (sessionId: string, newRecords: AttendanceRecord[]) => {
    setSessions((prev) =>
      prev.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const presentCount = newRecords.filter((r) => r.status === 'present').length;
        const absentCount = newRecords.filter((r) => r.status === 'absent').length;
        const lateCount = newRecords.filter((r) => r.status === 'late').length;
        const excusedCount = newRecords.filter((r) => r.status === 'excused').length;

        return {
          ...sess,
          records: newRecords,
          presentCount,
          absentCount,
          lateCount,
          excusedCount
        };
      })
    );
  };

  // Cycle status for a student: Present -> Late -> Absent -> Excused -> Present
  const handleCycleStatus = (studentId: string) => {
    if (!activeSession) return;
    const order: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

    const newRecords = activeSession.records.map((rec) => {
      if (rec.studentId !== studentId) return rec;
      const currentIndex = order.indexOf(rec.status);
      const nextStatus = order[(currentIndex + 1) % order.length];

      return {
        ...rec,
        status: nextStatus,
        checkInTime: nextStatus === 'absent' ? undefined : (rec.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        tardyMinutes: nextStatus === 'late' ? (rec.tardyMinutes || 10) : undefined
      };
    });

    updateSessionRecords(activeSession.id, newRecords);
  };

  // Set explicit status
  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    if (!activeSession) return;
    const newRecords = activeSession.records.map((rec) => {
      if (rec.studentId !== studentId) return rec;
      return {
        ...rec,
        status,
        checkInTime: status === 'absent' ? undefined : (rec.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      };
    });
    updateSessionRecords(activeSession.id, newRecords);
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    if (!activeSession) return;
    const newRecords = activeSession.records.map((rec) => ({
      ...rec,
      status: 'present' as AttendanceStatus,
      checkInTime: rec.checkInTime || '08:30 AM',
      method: rec.method || 'manual'
    }));
    updateSessionRecords(activeSession.id, newRecords);
    showToast(`Marked all ${newRecords.length} students as Present`);
  };

  // Automated Scanning Simulation (QR / NFC / Facial AI)
  const handleSimulateAutomatedScan = () => {
    if (!activeSession) return;
    setIsSimulatingScan(true);

    setTimeout(() => {
      const methods: Array<'qr_scan' | 'nfc_badge' | 'face_ai'> = ['qr_scan', 'nfc_badge', 'face_ai'];
      const newRecords = activeSession.records.map((rec, i) => {
        // randomly make 5 present, 1 late
        const status: AttendanceStatus = i === 4 ? 'late' : 'present';
        const method = methods[i % methods.length];
        return {
          ...rec,
          status,
          method,
          checkInTime: `08:${25 + (i * 2)} AM`,
          tardyMinutes: status === 'late' ? 14 : undefined
        };
      });

      updateSessionRecords(activeSession.id, newRecords);
      setIsSimulatingScan(false);
      showToast('Automated AI & NFC Badge Attendance scan completed for class!');
    }, 1200);
  };

  // Notify Parents of Absentees
  const handleNotifyAbsentees = () => {
    if (!activeSession) return;
    const absentees = activeSession.records.filter((r) => r.status === 'absent');
    if (absentees.length === 0) {
      showToast('All students are present or accounted for. No guardian alerts needed.');
      return;
    }

    const newRecords = activeSession.records.map((r) =>
      r.status === 'absent' ? { ...r, parentNotified: true } : r
    );
    updateSessionRecords(activeSession.id, newRecords);
    showToast(`Dispatched SMS & Email notifications to guardians of ${absentees.length} absent student(s).`);
  };

  // Calculate attendance rate
  const attendanceRate = activeSession
    ? Math.round(((activeSession.presentCount + activeSession.lateCount) / activeSession.totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Top Banner & Session Selector */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeSession.courseCode}: {activeSession.courseName}
                  </h2>
                  <Badge variant="indigo" size="xs">
                    {activeSession.section}
                  </Badge>
                  {activeSession.isFinalized ? (
                    <Badge variant="zinc" size="xs">Finalized & Locked</Badge>
                  ) : (
                    <Badge variant="emerald" size="xs">Live Register Active</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {activeSession.date} • {activeSession.startTime} - {activeSession.endTime} • {activeSession.room} • Instructor: {activeSession.instructorName}
                </p>
              </div>
            </div>
          </div>

          {/* Session Switcher dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {sessions.map((sess) => (
                <option key={sess.id} value={sess.id}>
                  {sess.courseCode} ({sess.date} - {sess.section})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Stats Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attendance Rate</span>
            <div className="text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1.5">
              {attendanceRate}%
              <span className={`text-[10px] font-bold ${attendanceRate >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {attendanceRate >= 90 ? 'Optimal' : 'Needs Review'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-500/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present</span>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {activeSession.presentCount} / {activeSession.totalStudents}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-500/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Late / Tardy</span>
            <div className="text-lg font-black text-amber-700 dark:text-amber-300">
              {activeSession.lateCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-200/50 dark:border-rose-500/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Unexcused Absent</span>
            <div className="text-lg font-black text-rose-700 dark:text-rose-300">
              {activeSession.absentCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-200/50 dark:border-indigo-500/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Excused</span>
            <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
              {activeSession.excusedCount}
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={handleMarkAllPresent}
              leftIcon={<Check size={12} />}
            >
              Mark All Present
            </Button>

            <Button
              variant="outline"
              size="xs"
              disabled={isSimulatingScan}
              onClick={handleSimulateAutomatedScan}
              leftIcon={<Sparkles size={12} className="text-indigo-500" />}
            >
              {isSimulatingScan ? 'Scanning RFID/AI...' : 'Auto-Scan Badge / Face AI'}
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsQrModalOpen(true)}
              leftIcon={<QrCode size={12} className="text-emerald-500" />}
            >
              Show Dynamic Class QR
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {activeSession.absentCount > 0 && (
              <Button
                variant="danger"
                size="xs"
                onClick={handleNotifyAbsentees}
                leftIcon={<Send size={12} />}
              >
                Alert Parents of Absentees ({activeSession.absentCount})
              </Button>
            )}

            <Button
              variant="outline"
              size="xs"
              onClick={() => showToast('Exporting official attendance sheet (CSV)...')}
              leftIcon={<Download size={12} />}
            >
              Export CSV Register
            </Button>
          </div>
        </div>
      </div>

      {/* Attendance Roster Grid Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/80 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Enrolled Student Roster ({activeSession.records.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Click status button to cycle: <strong className="text-emerald-600">Present</strong> → <strong className="text-amber-600">Late</strong> → <strong className="text-rose-600">Absent</strong> → <strong className="text-indigo-600">Excused</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-50/40 dark:bg-zinc-800/20">
                <th className="p-3.5 pl-5">Student / Roll Number</th>
                <th className="p-3.5">Attendance Status</th>
                <th className="p-3.5">Check-In Method & Time</th>
                <th className="p-3.5 text-center">Historical Rate</th>
                <th className="p-3.5 text-center">Streak</th>
                <th className="p-3.5 text-right pr-5">Remarks & Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              {activeSession.records.map((rec) => {
                return (
                  <tr
                    key={rec.studentId}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Student Info */}
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={rec.studentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80'}
                          alt={rec.studentName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {rec.studentName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {rec.studentRollNo}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Pill with 1-click cycle */}
                    <td className="p-3.5">
                      <button
                        onClick={() => handleCycleStatus(rec.studentId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all hover:scale-105 shadow-xs border cursor-pointer"
                        style={{
                          backgroundColor:
                            rec.status === 'present'
                              ? '#10b98115'
                              : rec.status === 'late'
                              ? '#f59e0b15'
                              : rec.status === 'absent'
                              ? '#ef444415'
                              : '#6366f115',
                          borderColor:
                            rec.status === 'present'
                              ? '#10b98140'
                              : rec.status === 'late'
                              ? '#f59e0b40'
                              : rec.status === 'absent'
                              ? '#ef444440'
                              : '#6366f140',
                          color:
                            rec.status === 'present'
                              ? '#10b981'
                              : rec.status === 'late'
                              ? '#f59e0b'
                              : rec.status === 'absent'
                              ? '#ef4444'
                              : '#6366f1'
                        }}
                      >
                        {rec.status === 'present' && <CheckCircle2 size={13} />}
                        {rec.status === 'late' && <Clock size={13} />}
                        {rec.status === 'absent' && <XCircle size={13} />}
                        {rec.status === 'excused' && <ShieldAlert size={13} />}
                        <span className="capitalize">{rec.status}</span>
                      </button>
                    </td>

                    {/* Method & Check-in Time */}
                    <td className="p-3.5 text-slate-600 dark:text-zinc-300">
                      {rec.status === 'absent' ? (
                        <span className="text-slate-400 font-mono text-[11px]">— Not checked in</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                            <Clock size={11} className="text-slate-400" />
                            {rec.checkInTime || '08:30 AM'}
                            {rec.tardyMinutes && (
                              <span className="text-amber-500 text-[10px]">({rec.tardyMinutes}m late)</span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500">
                            {rec.method === 'qr_scan' && <QrCode size={10} />}
                            {rec.method === 'nfc_badge' && <Smartphone size={10} />}
                            {rec.method === 'face_ai' && <Scan size={10} />}
                            {rec.method || 'manual'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Historical Rate */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {rec.historicalAttendanceRate}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              rec.historicalAttendanceRate >= 90
                                ? 'bg-emerald-500'
                                : rec.historicalAttendanceRate >= 80
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${rec.historicalAttendanceRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Attendance Streak */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Flame size={12} /> {rec.presentStreak}
                      </span>
                    </td>

                    {/* Remarks & Parent Alert */}
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-2">
                        {rec.parentNotified && (
                          <Badge variant="rose" size="xs">
                            Parent Notified
                          </Badge>
                        )}
                        <button
                          onClick={() => setRemarksStudent({ id: rec.studentId, name: rec.studentName, remarks: rec.remarks || '' })}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                          title="Add note / remark"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                      {rec.remarks && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                          "{rec.remarks}"
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DYNAMIC QR CODE DISPLAY MODAL */}
      {isQrModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsQrModalOpen(false)}
          title="Dynamic Student Check-In QR Terminal"
          size="md"
        >
          <div className="space-y-4 text-center py-2">
            <div className="p-6 bg-slate-900 text-white rounded-2xl mx-auto max-w-[280px] space-y-4 shadow-xl border border-emerald-500/30">
              <div className="w-48 h-48 mx-auto bg-white p-3 rounded-xl flex items-center justify-center shadow-inner">
                {/* SVG QR Code Simulation */}
                <div className="w-full h-full border-4 border-slate-900 p-2 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 bg-slate-900 border-2 border-white" />
                    <div className="w-8 h-8 bg-slate-900 border-2 border-white" />
                  </div>
                  <div className="text-center font-mono font-black text-slate-900 text-[10px] tracking-tight">
                    CS301-ROOM102
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="w-8 h-8 bg-slate-900 border-2 border-white" />
                    <div className="w-4 h-4 bg-emerald-600 rounded-full animate-ping" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-Refreshing (45s left)
                </div>
                <p className="text-[10px] font-mono text-slate-400 break-all">
                  TOKEN: CAMPUS-ATT-CS301-2026-TOKEN-9X87F
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300">
              Students open their Campus Mobile App, scan this QR terminal, and are authenticated via biometric/geofence token.
            </p>

            <div className="pt-2">
              <Button variant="primary" onClick={() => setIsQrModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REMARKS MODAL */}
      {remarksStudent && (
        <Modal
          isOpen={true}
          onClose={() => setRemarksStudent(null)}
          title={`Attendance Note: ${remarksStudent.name}`}
          size="sm"
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              placeholder="e.g. Medical certificate submitted, campus transit delay, or excused sports duty..."
              value={remarksStudent.remarks}
              onChange={(e) => setRemarksStudent({ ...remarksStudent, remarks: e.target.value })}
              className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="xs" onClick={() => setRemarksStudent(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  if (activeSession) {
                    const newRecords = activeSession.records.map((r) =>
                      r.studentId === remarksStudent.id ? { ...r, remarks: remarksStudent.remarks } : r
                    );
                    updateSessionRecords(activeSession.id, newRecords);
                  }
                  setRemarksStudent(null);
                  showToast(`Saved note for ${remarksStudent.name}`);
                }}
              >
                Save Note
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AttendanceRegister;
