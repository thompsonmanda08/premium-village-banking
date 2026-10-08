import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar as CalendarIcon,
  CheckCircle2,
  Users,
  BookOpen,
  Video,
  Clock,
  Sparkles,
  TrendingUp,
  Award,
  ChevronRight,
  Plus,
  Play,
  ArrowRight
} from 'lucide-react';
import {
  CalendarEvent,
  AttendanceSession,
  StudentProfile,
  EduAssignment
} from '../../types';
import {
  sampleCalendarEvents,
  sampleAttendanceSessions,
  sampleStudents,
  sampleEduAssignments
} from '../../data/edutechData';
import CustomCalendar from '../edutech/CustomCalendar';
import AttendanceRegister from '../edutech/AttendanceRegister';
import StudentRosterTable from '../edutech/StudentRosterTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Card, { CardHeader, CardContent } from '../ui/Card';

interface EduTechViewProps {
  theme: 'dark' | 'light';
  showToast: (message: string) => void;
  onNavigateToCourses?: () => void;
}

export const EduTechView: React.FC<EduTechViewProps> = ({
  theme,
  showToast,
  onNavigateToCourses
}) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'attendance' | 'students' | 'assignments' | 'courses'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>(sampleCalendarEvents);
  const [students, setStudents] = useState<StudentProfile[]>(sampleStudents);
  const [assignments, setAssignments] = useState<EduAssignment[]>(sampleEduAssignments);

  const handleAddEvent = (newEvent: CalendarEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="indigo" size="sm" className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30">
                EduTech & School Operations
              </Badge>
              <span className="text-xs text-indigo-300 font-medium">Semester Fall 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Academic Operations, Calendar & Attendance Suite
            </h1>
            <p className="text-sm text-indigo-200/80 leading-relaxed">
              Customizable multi-user interactive academic timetable, automated RFID/QR biometric attendance register, student cohort profiles, and integrated video classroom linkages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onNavigateToCourses && (
              <Button
                variant="primary"
                size="md"
                onClick={onNavigateToCourses}
                leftIcon={<Video size={16} />}
                className="shadow-lg shadow-indigo-500/30 font-bold"
              >
                Open Video Classroom
              </Button>
            )}
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="space-y-1">
            <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <Users size={14} /> Total Cohort Scholars
            </span>
            <div className="text-xl font-black text-white">1,420 Active</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <CalendarIcon size={14} /> Today's Sessions
            </span>
            <div className="text-xl font-black text-white">8 Scheduled</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Avg Attendance Rate
            </span>
            <div className="text-xl font-black text-emerald-400">96.4%</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <Clock size={14} /> Next Live Lecture
            </span>
            <div className="text-sm font-bold text-indigo-100 truncate">CS-301 in 14m</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        <div className="flex items-center gap-2">
          {[
            { id: 'calendar', label: 'Calendar & Timetable', icon: CalendarIcon, badge: `${events.length}` },
            { id: 'attendance', label: 'Attendance Register', icon: CheckCircle2, badge: 'Live' },
            { id: 'students', label: 'Student Rosters & Cohorts', icon: Users, badge: `${students.length}` },
            { id: 'assignments', label: 'Assignments & Gradebook', icon: BookOpen, badge: `${assignments.length}` },
            { id: 'courses', label: 'Video Courses Link', icon: GraduationCap }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB CONTENT: 1. CALENDAR & TIMETABLE */}
      {/* ========================================== */}
      {activeTab === 'calendar' && (
        <CustomCalendar
          events={events}
          onAddEvent={handleAddEvent}
          showToast={showToast}
        />
      )}

      {/* ========================================== */}
      {/* TAB CONTENT: 2. ATTENDANCE REGISTER */}
      {/* ========================================== */}
      {activeTab === 'attendance' && (
        <AttendanceRegister
          initialSessions={sampleAttendanceSessions}
          showToast={showToast}
        />
      )}

      {/* ========================================== */}
      {/* TAB CONTENT: 3. STUDENT ROSTERS */}
      {/* ========================================== */}
      {activeTab === 'students' && (
        <StudentRosterTable
          students={students}
          showToast={showToast}
        />
      )}

      {/* ========================================== */}
      {/* TAB CONTENT: 4. GRADEBOOK & ASSIGNMENTS */}
      {/* ========================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Coursework Assignments & Submissions
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Automated code test runners, PDF essay grading rubrics, and average cohort metrics
              </p>
            </div>
            <Button
              variant="primary"
              size="xs"
              onClick={() => showToast('Create assignment rubric wizard opened')}
              leftIcon={<Plus size={12} />}
            >
              Create Assignment
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assignments.map((asg) => (
              <div
                key={asg.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4 hover:border-indigo-400 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                      {asg.courseCode}
                    </span>
                    <Badge variant={asg.status === 'Grading' ? 'amber' : 'emerald'} size="xs">
                      {asg.status}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {asg.title}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Format: <strong>{asg.submissionType}</strong> • Max {asg.totalPoints} Points
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-zinc-300">
                    <span>Submissions:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {asg.submissionsCount} received
                    </span>
                  </div>

                  {asg.averageScore > 0 && (
                    <div className="flex justify-between text-xs text-slate-600 dark:text-zinc-300">
                      <span>Cohort Avg Score:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {asg.averageScore} / {asg.totalPoints} pts
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={12} /> Due: {asg.dueDate}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => showToast(`Opening grading rubric for ${asg.title}`)}
                    >
                      Grade Submissions
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB CONTENT: 5. VIDEO COURSES LINKAGE */}
      {/* ========================================== */}
      {activeTab === 'courses' && (
        <Card>
          <CardHeader
            title="Integrated Video Classroom & Course Lectures"
            subtitle="Connect your weekly timetable directly to asynchronous video lectures, notes & certificates"
            action={
              onNavigateToCourses && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onNavigateToCourses}
                  rightIcon={<ArrowRight size={14} />}
                >
                  Launch Classroom
                </Button>
              )
            }
          />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Play size={24} className="fill-indigo-400" />
                </div>
                <h4 className="text-base font-bold text-white">
                  Udemy-Style Lecture Player
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Students can seamlessly jump from their scheduled timetable lecture into high-definition recorded modules with synchronized timestamped notes, downloadable curriculum slides, and verifiable course completion certificates.
                </p>
                {onNavigateToCourses && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onNavigateToCourses}
                  >
                    View All 12 Enrolled Video Courses
                  </Button>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-slate-900/60 border border-emerald-500/20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Award size={24} />
                </div>
                <h4 className="text-base font-bold text-white">
                  Accredited Certification
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Track course completion progress bar, take automated end-of-module quizzes, and generate PDF completion certificates signed by course instructors directly into student portfolios.
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={14} /> 4 Certificates Issued this Term
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EduTechView;
