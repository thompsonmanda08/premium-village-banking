import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Plus,
  Video,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { CalendarEvent } from '../../types';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface CalendarWidgetProps {
  events: CalendarEvent[];
  onOpenFullCalendar?: () => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onAddEvent?: () => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  events,
  onOpenFullCalendar,
  onSelectEvent,
  onAddEvent
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  // Today and next 4 days for the quick day selector
  const days = [0, 1, 2, 3, 4].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      offset,
      dayName: offset === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      fullDate: d.toISOString().split('T')[0]
    };
  });

  const activeDateString = days[selectedDayOffset].fullDate;

  // Filter events for the selected day
  const dayEvents = events.filter((e) => e.startDate === activeDateString);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <CalendarIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Academic Calendar</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Classes, exams & connected peers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAddEvent && (
            <Button
              variant="outline"
              size="xs"
              onClick={onAddEvent}
              leftIcon={<Plus size={12} />}
            >
              Add
            </Button>
          )}
          {onOpenFullCalendar && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onOpenFullCalendar}
              rightIcon={<ChevronRight size={14} />}
            >
              View Full
            </Button>
          )}
        </div>
      </div>

      {/* Mini Day Strip */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {days.map((day) => {
          const isSelected = selectedDayOffset === day.offset;
          const dayEventCount = events.filter((e) => e.startDate === day.fullDate).length;

          return (
            <button
              key={day.offset}
              onClick={() => setSelectedDayOffset(day.offset)}
              className={`p-2 rounded-xl text-center transition-all flex flex-col items-center gap-1 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                  : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-100 dark:border-white/5'
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-zinc-400'}`}>
                {day.dayName}
              </span>
              <span className="text-sm font-black">{day.dateNum}</span>
              <div className="flex gap-0.5 mt-0.5">
                {dayEventCount > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                )}
                {dayEventCount > 1 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-200' : 'bg-emerald-500'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Events List for Selected Day */}
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        {dayEvents.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-slate-200 dark:border-white/5">
            <Clock size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">No scheduled sessions</p>
            <p className="text-[11px] text-slate-400">Enjoy your free time or schedule a study block</p>
          </div>
        ) : (
          dayEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onSelectEvent?.(evt)}
              className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-slate-50/40 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800 transition-all cursor-pointer group space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: evt.color || '#6366f1' }}
                    />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {evt.title}
                    </h4>
                  </div>
                  {evt.courseCode && (
                    <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400 pl-4.5 block">
                      {evt.courseCode}
                    </span>
                  )}
                </div>
                <Badge
                  variant={
                    evt.type === 'exam'
                      ? 'rose'
                      : evt.type === 'lab'
                      ? 'blue'
                      : evt.type === 'lecture'
                      ? 'indigo'
                      : 'emerald'
                  }
                  size="xs"
                >
                  {evt.type}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400" />
                  <span>
                    {evt.startTime} - {evt.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" />
                  <span className="truncate max-w-[120px]">{evt.roomNumber || evt.location}</span>
                </div>
              </div>

              {/* Connected User attribution */}
              {evt.creator && evt.creator.connectionType !== 'Self' && (
                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  <img
                    src={evt.creator.avatar}
                    alt={evt.creator.name}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>Scheduled by <strong className="text-slate-700 dark:text-zinc-300">{evt.creator.name}</strong> ({evt.creator.connectionType})</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CalendarWidget;
