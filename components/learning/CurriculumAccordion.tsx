import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  FileText, 
  HelpCircle, 
  Code, 
  CheckCircle2, 
  Circle, 
  Lock, 
  Clock,
  Download,
  Sparkles,
  Volume2
} from 'lucide-react';
import { Course, CourseSection, CourseLesson } from '../../types';
import ProgressBar from '../ui/ProgressBar';

interface CurriculumAccordionProps {
  course: Course;
  activeLessonId: string;
  onSelectLesson: (lesson: CourseLesson, section: CourseSection) => void;
  onToggleLessonComplete: (lessonId: string) => void;
  completedLessonIds: Set<string>;
}

export const CurriculumAccordion: React.FC<CurriculumAccordionProps> = ({
  course,
  activeLessonId,
  onSelectLesson,
  onToggleLessonComplete,
  completedLessonIds,
}) => {
  // By default, expand the section containing the active lesson
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    course.sections.forEach((sec, idx) => {
      // expand first 2 or section with active lesson
      const hasActive = sec.lessons.some(l => l.id === activeLessonId);
      initial[sec.id] = hasActive || idx === 0;
    });
    return initial;
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    course.sections.forEach(s => { all[s.id] = true; });
    setExpandedSections(all);
  };

  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    course.sections.forEach(s => { none[s.id] = false; });
    setExpandedSections(none);
  };

  // Calculate totals
  const totalLessons = course.sections.reduce((acc, sec) => acc + sec.lessons.length, 0);
  const completedCount = course.sections.reduce((acc, sec) => {
    return acc + sec.lessons.filter(l => completedLessonIds.has(l.id) || l.isCompleted).length;
  }, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const getLessonIcon = (type: string, isActive: boolean) => {
    switch (type) {
      case 'quiz':
        return <HelpCircle size={14} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500"} />;
      case 'article':
        return <FileText size={14} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-blue-500"} />;
      case 'exercise':
        return <Code size={14} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-500"} />;
      case 'video':
      default:
        return <PlayCircle size={14} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-400"} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Top Header & Course Progress */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-950/40">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Course Content
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Expand all
            </button>
            <span className="text-slate-300 dark:text-zinc-700">•</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 hover:underline"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-zinc-400">
              {completedCount} of {totalLessons} completed ({progressPct}%)
            </span>
            {progressPct === 100 && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles size={11} /> Ready for Certificate!
              </span>
            )}
          </div>
          <ProgressBar value={progressPct} variant={progressPct === 100 ? "emerald" : "indigo"} size="sm" />
        </div>
      </div>

      {/* Sections Accordion List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
        {course.sections.map((section, sIndex) => {
          const isExpanded = !!expandedSections[section.id];
          const sectionCompletedCount = section.lessons.filter(
            l => completedLessonIds.has(l.id) || l.isCompleted
          ).length;
          const sectionTotalMinutes = section.lessons.reduce((acc, l) => acc + Math.round(l.durationSeconds / 60), 0);

          return (
            <div key={section.id} className="transition-colors">
              {/* Section Header Accordion Trigger */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                  isExpanded 
                    ? 'bg-slate-50 dark:bg-zinc-800/40' 
                    : 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/20'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                      {section.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                    <span>{sectionCompletedCount}/{section.lessons.length} completed</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {sectionTotalMinutes} mins</span>
                  </div>
                </div>

                <div className="text-slate-400 dark:text-zinc-500 mt-1">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Section Lessons List */}
              {isExpanded && (
                <div className="bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-white/5">
                  {section.lessons.map((lesson) => {
                    const isActive = lesson.id === activeLessonId;
                    const isDone = completedLessonIds.has(lesson.id) || !!lesson.isCompleted;

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => onSelectLesson(lesson, section)}
                        className={`group px-3.5 py-3 flex items-start gap-3 cursor-pointer transition-all select-none ${
                          isActive 
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-indigo-600 dark:border-indigo-400 pl-2.5' 
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800/30'
                        }`}
                      >
                        {/* Interactive Completion Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLessonComplete(lesson.id);
                          }}
                          className={`mt-0.5 shrink-0 transition-transform active:scale-90 ${
                            isDone 
                              ? 'text-emerald-500 hover:text-emerald-600' 
                              : 'text-slate-300 dark:text-zinc-600 hover:text-slate-400'
                          }`}
                          aria-label={isDone ? "Mark lesson incomplete" : "Mark lesson complete"}
                        >
                          {isDone ? <CheckCircle2 size={16} className="fill-emerald-500/20" /> : <Circle size={16} />}
                        </button>

                        {/* Title & Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {getLessonIcon(lesson.type, isActive)}
                            <span className={`text-xs leading-snug line-clamp-2 ${
                              isActive 
                                ? 'font-bold text-indigo-900 dark:text-indigo-300' 
                                : isDone 
                                  ? 'text-slate-600 dark:text-zinc-400 font-medium' 
                                  : 'text-slate-800 dark:text-zinc-200 font-medium'
                            }`}>
                              {lesson.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              {lesson.duration}
                            </span>

                            {lesson.resources && lesson.resources.length > 0 && (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                                <Download size={9} /> {lesson.resources.length} resource{lesson.resources.length > 1 ? 's' : ''}
                              </span>
                            )}

                            {lesson.isFreePreview && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                Preview
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Playing Wave Indicator if Active */}
                        {isActive && (
                          <div className="shrink-0 flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 mt-1">
                            <span className="w-1 h-3 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
                            <span className="w-1 h-4 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse delay-150" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CurriculumAccordion;
