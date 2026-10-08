import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Award,
  BookOpen,
  GraduationCap,
  Download,
  Flame,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { StudentProfile } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

interface StudentRosterTableProps {
  students: StudentProfile[];
  onAddStudent?: (newStudent: StudentProfile) => void;
  showToast?: (message: string) => void;
}

export const StudentRosterTable: React.FC<StudentRosterTableProps> = ({
  students,
  onAddStudent,
  showToast = (msg) => console.log(msg)
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  const filteredStudents = students.filter((stu) => {
    const matchesSearch =
      searchQuery === '' ||
      stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.guardianName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || stu.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search students, roll #, guardian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-zinc-200"
            >
              <option value="all">All Academic Standing</option>
              <option value="Honors">Honors / Dean's List</option>
              <option value="Active">Active Standing</option>
              <option value="Academic Probation">Academic Probation</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => showToast('Exporting student cohort directory (CSV)...')}
            leftIcon={<Download size={12} />}
          >
            Export Directory
          </Button>
          <Button
            variant="primary"
            size="xs"
            onClick={() => showToast('Enroll new student workflow triggered')}
            leftIcon={<Plus size={12} />}
          >
            Enroll Student
          </Button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-50/80 dark:bg-zinc-800/40">
                <th className="p-3.5 pl-5">Student / Roll Number</th>
                <th className="p-3.5">Academic Cohort & Year</th>
                <th className="p-3.5 text-center">GPA</th>
                <th className="p-3.5 text-center">Overall Attendance</th>
                <th className="p-3.5">Guardian & Emergency Contact</th>
                <th className="p-3.5 text-right pr-5">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              {filteredStudents.map((stu) => (
                <tr
                  key={stu.id}
                  onClick={() => setSelectedStudent(stu)}
                  className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                >
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={stu.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80'}
                        alt={stu.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                      />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {stu.name}
                        </div>
                        <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          {stu.rollNumber} • {stu.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5 text-slate-700 dark:text-zinc-300">
                    <div className="font-semibold text-slate-900 dark:text-white">{stu.cohort}</div>
                    <div className="text-[11px] text-slate-500">{stu.gradeLevel}</div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                      {stu.gpa.toFixed(2)}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {stu.overallAttendance}%
                      </span>
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            stu.overallAttendance >= 90
                              ? 'bg-emerald-500'
                              : stu.overallAttendance >= 80
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${stu.overallAttendance}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="font-medium text-slate-900 dark:text-white">{stu.guardianName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{stu.guardianPhone}</span>
                    </div>
                  </td>

                  <td className="p-3.5 text-right pr-5">
                    <Badge
                      variant={
                        stu.status === 'Honors'
                          ? 'emerald'
                          : stu.status === 'Active'
                          ? 'indigo'
                          : 'rose'
                      }
                      size="xs"
                    >
                      {stu.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STUDENT DETAILS MODAL */}
      {selectedStudent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudent(null)}
          title={`Student Profile: ${selectedStudent.name}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/5">
              <img
                src={selectedStudent.avatar}
                alt={selectedStudent.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedStudent.name}
                  </h4>
                  <Badge variant="indigo" size="xs">{selectedStudent.rollNumber}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {selectedStudent.cohort} • {selectedStudent.gradeLevel}
                </p>
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    GPA: <strong className="text-indigo-600">{selectedStudent.gpa}</strong>
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    Attendance: <strong className="text-emerald-600">{selectedStudent.overallAttendance}%</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Guardian Contact & Alerts
              </h5>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Guardian Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedStudent.guardianName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{selectedStudent.guardianPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{selectedStudent.guardianEmail}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Academic Badges & Recognitions
              </h5>
              <div className="flex flex-wrap gap-2">
                {selectedStudent.academicBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-500/20"
                  >
                    <Award size={13} /> {b}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
              <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  showToast(`Opened messaging session with ${selectedStudent.guardianName}`);
                  setSelectedStudent(null);
                }}
                leftIcon={<Mail size={14} />}
              >
                Message Guardian
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentRosterTable;
