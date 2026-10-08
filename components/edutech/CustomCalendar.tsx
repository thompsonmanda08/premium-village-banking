import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Users,
  Clock,
  MapPin,
  Tag,
  Search,
  CheckCircle2,
  Video,
  AlertCircle,
  X,
  Share2,
  UserCheck,
  Building,
  GraduationCap,
  Sparkles,
  Download
} from 'lucide-react';
import {
  CalendarEvent,
  CalendarEventType,
  CalendarViewMode,
  CalendarEventPriority
} from '../../types';
import { connectedCalendarUsers, timetablePeriods } from '../../data/edutechData';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

interface CustomCalendarProps {
  events: CalendarEvent[];
  onAddEvent: (newEvent: CalendarEvent) => void;
  onUpdateEvent?: (updatedEvent: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  showToast?: (message: string) => void;
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  showToast = (msg) => console.log(msg)
}) => {
  // Navigation & View Mode State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConnectionType, setSelectedConnectionType] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Form State for Add Event
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'lecture' as CalendarEventType,
    priority: 'normal' as CalendarEventPriority,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:15',
    courseCode: 'CS-301',
    courseName: 'Distributed Systems & Cloud Orchestration',
    location: 'Turing Hall • Aud-102',
    roomNumber: 'AUD-102',
    color: '#6366f1',
    isMandatory: false,
    hasAttendanceCheck: true,
    meetingUrl: '',
    connectionUser: 'user-self'
  });

  // Calculate Month Grid Information
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week' || viewMode === 'timetable') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week' || viewMode === 'timetable') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.courseCode && evt.courseCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (evt.courseName && evt.courseName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase());

      // Connection Filter
      const matchesConnection =
        selectedConnectionType === 'all' ||
        (selectedConnectionType === 'self' && evt.creator?.connectionType === 'Self') ||
        (selectedConnectionType === 'instructor' && evt.creator?.connectionType === 'My Instructor') ||
        (selectedConnectionType === 'advisor' && evt.creator?.connectionType === 'My Advisor') ||
        (selectedConnectionType === 'classmates' && (evt.creator?.connectionType === 'Classmate' || evt.creator?.connectionType === 'Study Group Peer')) ||
        (selectedConnectionType === 'department' && evt.creator?.connectionType === 'Department Head');

      // Event Type
      const matchesType = selectedEventType === 'all' || evt.type === selectedEventType;

      // Mandatory
      const matchesMandatory = !mandatoryOnly || evt.isMandatory;

      return matchesSearch && matchesConnection && matchesType && matchesMandatory;
    });
  }, [events, searchQuery, selectedConnectionType, selectedEventType, mandatoryOnly]);

  // Create event submission
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Please enter an event title');
      return;
    }

    const creatorUser = connectedCalendarUsers.find((u) => u.id === formData.connectionUser) || connectedCalendarUsers[0];

    const newEvt: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: formData.title,
      description: formData.description || 'Academic session scheduled in EduTech portal.',
      type: formData.type,
      priority: formData.priority,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      courseCode: formData.courseCode,
      courseName: formData.courseName,
      location: formData.location,
      roomNumber: formData.roomNumber,
      color: formData.color,
      isMandatory: formData.isMandatory,
      hasAttendanceCheck: formData.hasAttendanceCheck,
      meetingUrl: formData.meetingUrl,
      creator: {
        id: creatorUser.id,
        name: creatorUser.name,
        role: creatorUser.role.includes('Professor') ? 'Instructor' : creatorUser.role.includes('Advisor') ? 'Academic Advisor' : 'Student',
        avatar: creatorUser.avatar,
        initials: creatorUser.initials,
        connectionType: creatorUser.connectionType as any
      },
      connectedUsers: [
        { id: creatorUser.id, name: creatorUser.name, role: creatorUser.role, status: 'Accepted' },
        { id: 'user-self', name: 'Alex Thompson (You)', role: 'Student', status: 'Accepted' }
      ],
      tags: [formData.type, formData.courseCode, formData.isMandatory ? 'Mandatory' : 'Optional']
    };

    onAddEvent(newEvt);
    setIsAddModalOpen(false);
    showToast(`Added "${formData.title}" to calendar`);

    // Reset form
    setFormData({
      title: '',
      description: '',
      type: 'lecture',
      priority: 'normal',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:15',
      courseCode: 'CS-301',
      courseName: 'Distributed Systems & Cloud Orchestration',
      location: 'Turing Hall • Aud-102',
      roomNumber: 'AUD-102',
      color: '#6366f1',
      isMandatory: false,
      hasAttendanceCheck: true,
      meetingUrl: '',
      connectionUser: 'user-self'
    });
  };

  // Helper to format ISO date string to YYYY-MM-DD
  const formatCellDate = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const todayString = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month/Year Title & Jump buttons */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <CalendarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {monthNames[month]} {year}
                </h2>
                <Badge variant="indigo" size="xs">
                  {filteredEvents.length} Events
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Connected academic schedules, lectures & faculty office hours
              </p>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 ml-2 border border-slate-200/60 dark:border-white/5">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* View Modes & Add Event Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 border border-slate-200/60 dark:border-white/5 text-xs font-medium">
              {(['month', 'week', 'timetable', 'agenda'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mode === 'timetable' ? 'Timetable' : mode}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus size={14} />}
            >
              Add Schedule
            </Button>
          </div>
        </div>

        {/* Filters & Connected Users Selector */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search lectures, exams, rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Connection Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Users size={12} /> Connections:
            </span>
            <select
              value={selectedConnectionType}
              onChange={(e) => setSelectedConnectionType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Connected Schedules</option>
              <option value="self">My Personal Events</option>
              <option value="instructor">My Instructors (Professors)</option>
              <option value="advisor">Academic Advisor</option>
              <option value="classmates">Classmates & Study Groups</option>
              <option value="department">Department Head Announcements</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Tag size={12} /> Type:
            </span>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Event Types</option>
              <option value="lecture">Lectures</option>
              <option value="lab">Hands-on Labs</option>
              <option value="exam">Exams & Tests</option>
              <option value="assignment">Assignment Deadlines</option>
              <option value="office_hours">Office Hours</option>
              <option value="workshop">Workshops</option>
              <option value="extracurricular">Extracurricular / Hackathons</option>
            </select>
          </div>

          {/* Mandatory Checkbox Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={mandatoryOnly}
              onChange={(e) => setMandatoryOnly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span>Mandatory Only</span>
          </label>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. MONTH VIEW CALENDAR GRID */}
      {/* ========================================== */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-zinc-800/50 text-center text-xs font-bold text-slate-500 dark:text-zinc-400 py-3">
            {daysOfWeek.map((d) => (
              <div key={d} className="uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-white/5">
            {/* Prev month placeholder days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="min-h-[110px] p-2 bg-slate-50/30 dark:bg-zinc-950/30 text-slate-400 dark:text-zinc-600 select-none opacity-50"
                >
                  <span className="text-xs font-semibold">{dayNum}</span>
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = formatCellDate(year, month, dayNum);
              const isToday = dateStr === todayString;
              const cellEvents = filteredEvents.filter((evt) => evt.startDate === dateStr);

              return (
                <div
                  key={`cur-${dayNum}`}
                  className={`min-h-[110px] p-2 transition-all group flex flex-col justify-between ${
                    isToday
                      ? 'bg-indigo-50/20 dark:bg-indigo-950/10'
                      : 'hover:bg-slate-50/60 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {cellEvents.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cellEvents.length} {cellEvents.length === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>

                  {/* Day Events stack */}
                  <div className="space-y-1.5 overflow-y-auto max-h-[85px]">
                    {cellEvents.slice(0, 3).map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className="w-full text-left p-1.5 rounded-lg text-[11px] font-medium transition-all hover:scale-[1.02] shadow-xs truncate flex items-center gap-1.5 border"
                        style={{
                          backgroundColor: `${evt.color}15`,
                          borderColor: `${evt.color}40`,
                          color: evt.color
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: evt.color }}
                        />
                        <span className="font-bold shrink-0">{evt.startTime}</span>
                        <span className="truncate text-slate-800 dark:text-zinc-200">
                          {evt.title}
                        </span>
                      </button>
                    ))}
                    {cellEvents.length > 3 && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 pl-1 block">
                        +{cellEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. TIMETABLE VIEW (Academic Periods x Days) */}
      {/* ========================================== */}
      {viewMode === 'timetable' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Weekly Academic Timetable Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Period schedule with conflict-free lecture halls and laboratory allocations
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => showToast('Exporting printable weekly schedule PDF...')}
              leftIcon={<Download size={12} />}
            >
              Export PDF Schedule
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 border-b border-slate-200 dark:border-white/10">
                  <th className="p-3 w-36 border-r border-slate-200 dark:border-white/10">Academic Period</th>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                    <th key={d} className="p-3 border-r border-slate-200 dark:border-white/10 text-center">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {timetablePeriods.map((period) => (
                  <tr key={period.periodNumber} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                    <td className="p-3 bg-slate-50/80 dark:bg-zinc-800/60 border-r border-slate-200 dark:border-white/10 font-medium">
                      <div className="font-bold text-slate-900 dark:text-white">{period.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {period.startTime} - {period.endTime}
                      </div>
                    </td>

                    {/* Weekday columns */}
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, dIdx) => {
                      // Match events occurring in this period time window
                      const slotEvents = filteredEvents.filter((evt) => {
                        const evtStart = evt.startTime;
                        return evtStart >= period.startTime && evtStart < period.endTime;
                      });

                      return (
                        <td
                          key={day}
                          className="p-2.5 border-r border-slate-200 dark:border-white/10 align-top min-h-[90px]"
                        >
                          {slotEvents.length > 0 ? (
                            <div className="space-y-1.5">
                              {slotEvents.map((evt) => (
                                <div
                                  key={evt.id}
                                  onClick={() => setSelectedEvent(evt)}
                                  className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-400 bg-white dark:bg-zinc-800 shadow-xs cursor-pointer group space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                      {evt.courseCode}
                                    </span>
                                    <Badge variant="indigo" size="xs">
                                      {evt.type}
                                    </Badge>
                                  </div>
                                  <div className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 transition-colors line-clamp-1">
                                    {evt.title}
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400">
                                    <span>{evt.roomNumber || evt.location}</span>
                                    {evt.creator?.name && (
                                      <span className="truncate max-w-[80px]">{evt.creator.name}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full min-h-[50px] flex items-center justify-center text-[11px] text-slate-300 dark:text-zinc-700 font-mono">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. AGENDA / LIST VIEW */}
      {/* ========================================== */}
      {(viewMode === 'agenda' || viewMode === 'week') && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Chronological Agenda Schedule
            </h3>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Showing {filteredEvents.length} scheduled items
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CalendarIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No calendar events match your filters</p>
              </div>
            ) : (
              filteredEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-slate-50/40 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shrink-0 font-black shadow-sm"
                      style={{ backgroundColor: evt.color || '#6366f1' }}
                    >
                      <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                        {new Date(evt.startDate).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-sm font-black leading-none">
                        {new Date(evt.startDate).getDate()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {evt.courseCode && (
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                            {evt.courseCode}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                          {evt.title}
                        </h4>
                        {evt.isMandatory && (
                          <Badge variant="rose" size="xs">Mandatory</Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-1">
                        {evt.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {evt.startTime} - {evt.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {evt.roomNumber || evt.location}
                        </span>
                        {evt.creator && (
                          <span className="flex items-center gap-1">
                            <Users size={12} /> By {evt.creator.name} ({evt.creator.connectionType})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {evt.meetingUrl && (
                      <a
                        href={evt.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Video size={13} /> Join Link
                      </a>
                    )}
                    <Button variant="outline" size="xs">
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EVENT DETAIL MODAL */}
      {/* ========================================== */}
      {selectedEvent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
          size="lg"
        >
          <div className="space-y-5">
            {/* Header badges */}
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-white/10">
              <Badge variant="indigo">{selectedEvent.type.toUpperCase()}</Badge>
              {selectedEvent.courseCode && (
                <Badge variant="blue">{selectedEvent.courseCode}</Badge>
              )}
              {selectedEvent.isMandatory && (
                <Badge variant="rose">Attendance Mandatory</Badge>
              )}
              {selectedEvent.hasAttendanceCheck && (
                <Badge variant="emerald">Live Attendance Tracked</Badge>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Overview</h4>
              <p className="text-sm text-slate-800 dark:text-zinc-200">
                {selectedEvent.description}
              </p>
            </div>

            {/* Timing & Location Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-white/5">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <Clock size={13} /> Date & Time
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {new Date(selectedEvent.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {selectedEvent.startTime} - {selectedEvent.endTime}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <MapPin size={13} /> Physical Location / Hall
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedEvent.location}
                </p>
                {selectedEvent.roomNumber && (
                  <p className="text-xs text-slate-500">Room Code: {selectedEvent.roomNumber}</p>
                )}
              </div>
            </div>

            {/* Scheduled by & Connected Users */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Event Organizer & Connected Cohort
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedEvent.creator?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80'}
                    alt={selectedEvent.creator?.name}
                    className="w-10 h-10 rounded-full object-cover border border-indigo-400"
                  />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedEvent.creator?.name}
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {selectedEvent.creator?.role} • Connected as <strong className="text-indigo-600 dark:text-indigo-400">{selectedEvent.creator?.connectionType}</strong>
                    </p>
                  </div>
                </div>
                <Badge variant="emerald" size="xs">Connected</Badge>
              </div>

              {/* Attendees List */}
              {selectedEvent.connectedUsers && selectedEvent.connectedUsers.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs text-slate-500 font-semibold block mb-2">
                    Confirmed Classmates & Faculty:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.connectedUsers.map((usr) => (
                      <span
                        key={usr.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300"
                      >
                        <UserCheck size={12} className="text-emerald-500" />
                        {usr.name} ({usr.role})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  showToast('Exported calendar event (.ics)');
                }}
                leftIcon={<Share2 size={14} />}
              >
                Sync with iCal/Google
              </Button>

              <div className="flex items-center gap-2">
                {selectedEvent.hasAttendanceCheck && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      showToast(`Attendance checked in for ${selectedEvent.title}`);
                      setSelectedEvent(null);
                    }}
                    leftIcon={<CheckCircle2 size={14} />}
                  >
                    Check In Now
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================== */}
      {/* ADD SCHEDULE / EVENT MODAL */}
      {/* ========================================== */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Schedule Academic Event & Session"
          size="lg"
        >
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CS 301: Cloud Computing Guest Lecture"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Event Category
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CalendarEventType })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Laboratory Session</option>
                  <option value="exam">Examination / Test</option>
                  <option value="assignment">Assignment Due Date</option>
                  <option value="office_hours">Faculty Office Hours</option>
                  <option value="workshop">Study Workshop</option>
                  <option value="extracurricular">Extracurricular / Club</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Share Schedule With Connections
                </label>
                <select
                  value={formData.connectionUser}
                  onChange={(e) => setFormData({ ...formData, connectionUser: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                >
                  {connectedCalendarUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Course Code & Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS-301 Distributed Systems"
                  value={formData.courseCode}
                  onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Room / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Turing Hall • Aud-102"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Virtual Video Stream Link (Optional)
              </label>
              <input
                type="url"
                placeholder="https://campus.meet/room-id"
                value={formData.meetingUrl}
                onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.isMandatory}
                  onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Mandatory Attendance</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.hasAttendanceCheck}
                  onChange={(e) => setFormData({ ...formData, hasAttendanceCheck: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Enable Automated Attendance Register</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Plus size={14} />}
              >
                Create Schedule Item
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default CustomCalendar;
