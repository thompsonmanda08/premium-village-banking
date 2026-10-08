import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  BookOpen, 
  PlayCircle, 
  ArrowLeft, 
  Award, 
  Clock, 
  CheckCircle2, 
  Share2, 
  Heart,
  ChevronRight,
  SlidersHorizontal,
  GraduationCap
} from 'lucide-react';
import { Course, CourseLesson, CourseSection } from '../../types';
import { sampleCourses } from '../../data/learningAndEcommerceData';
import CourseCard from '../learning/CourseCard';
import VideoPlayer from '../learning/VideoPlayer';
import CurriculumAccordion from '../learning/CurriculumAccordion';
import CourseTabs from '../learning/CourseTabs';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';

interface LearningCoursesViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
  userName?: string;
}

export const LearningCoursesView: React.FC<LearningCoursesViewProps> = ({
  theme,
  showToast,
  userName = 'Thompson Manda',
}) => {
  const [courses, setCourses] = useState<Course[]>(sampleCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string>('l-1');
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set(['l-1', 'l-2', 'l-3', 'l-4', 'l-5', 'l-6']));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [wishlistedCourseIds, setWishlistedCourseIds] = useState<Set<string>>(new Set(['course-2']));
  const [currentVideoTimestamp, setCurrentVideoTimestamp] = useState<{ seconds: number; formatted: string }>({ seconds: 0, formatted: '00:00' });

  // Get active course object
  const activeCourse = courses.find(c => c.id === selectedCourseId) || null;

  // Flattened lessons for active course
  const allLessons = activeCourse 
    ? activeCourse.sections.flatMap(sec => sec.lessons)
    : [];

  const activeLesson = allLessons.find(l => l.id === activeLessonId) || allLessons[0] || null;
  const activeLessonIndex = allLessons.findIndex(l => l.id === activeLessonId);

  const categories = ['All', 'Web Development', 'AI & Machine Learning', 'UI/UX Design', 'Backend & Cloud'];

  const handleSelectCourse = (course: Course) => {
    setSelectedCourseId(course.id);
    // Find first uncompleted lesson or first lesson
    const firstLesson = course.sections[0]?.lessons[0];
    if (firstLesson) {
      setActiveLessonId(firstLesson.id);
    }
    showToast(`Loaded "${course.title}" classroom`);
  };

  const handleBackToCatalog = () => {
    setSelectedCourseId(null);
  };

  const handleToggleWishlist = (courseId: string) => {
    setWishlistedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
        showToast('Removed from wishlist');
      } else {
        next.add(courseId);
        showToast('Added to your wishlist!');
      }
      return next;
    });
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    setCompletedLessonIds(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
        showToast('Lesson marked as incomplete');
      } else {
        next.add(lessonId);
        showToast('Lesson marked as completed! 🎉');
      }
      return next;
    });
  };

  const handleSelectLesson = (lesson: CourseLesson) => {
    setActiveLessonId(lesson.id);
  };

  const handleNextLesson = () => {
    if (activeLessonIndex < allLessons.length - 1) {
      const nextL = allLessons[activeLessonIndex + 1];
      setActiveLessonId(nextL.id);
      showToast(`Now playing: ${nextL.title}`);
    }
  };

  const handlePrevLesson = () => {
    if (activeLessonIndex > 0) {
      const prevL = allLessons[activeLessonIndex - 1];
      setActiveLessonId(prevL.id);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.instructor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesLevel = selectedLevel === 'All' || course.level === selectedLevel;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  // Calculate course completion
  const totalCourseLessonsCount = allLessons.length;
  const totalCompletedCount = allLessons.filter(l => completedLessonIds.has(l.id)).length;
  const isCourseFullyCompleted = totalCourseLessonsCount > 0 && totalCompletedCount === totalCourseLessonsCount;

  // ==========================================
  // VIEW 1: UDEMY-LIKE CLASSROOM VIDEO PLAYER
  // ==========================================
  if (activeCourse && activeLesson) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        
        {/* Top Classroom Navigation Bar */}
        <div className="rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 p-4 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToCatalog}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft size={16} />
              <span>Back to Courses</span>
            </button>

            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {activeCourse.category}
                </span>
                <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-white truncate">
                  {activeCourse.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Instructor: {activeCourse.instructor.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              variant="ghost"
              size="sm"
              icon={<Share2 size={14} />}
              onClick={() => showToast('Course link copied to clipboard')}
            >
              Share
            </Button>
            <Button
              variant={isCourseFullyCompleted ? "success" : "secondary"}
              size="sm"
              icon={<Award size={14} />}
              onClick={() => showToast(isCourseFullyCompleted ? 'Viewing Certificate of Completion' : 'Complete all lessons to claim Certificate!')}
            >
              {isCourseFullyCompleted ? 'Certificate Ready' : `${Math.round((totalCompletedCount / Math.max(1, totalCourseLessonsCount)) * 100)}% Complete`}
            </Button>
          </div>
        </div>

        {/* Classroom 2-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Main Column: Video Player & Tabs */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Interactive Video Player */}
            <VideoPlayer
              lesson={activeLesson}
              onLessonComplete={handleToggleLessonComplete}
              onNextLesson={handleNextLesson}
              onPrevLesson={handlePrevLesson}
              hasNextLesson={activeLessonIndex < allLessons.length - 1}
              hasPrevLesson={activeLessonIndex > 0}
              onAddNoteAtTimestamp={(sec, fmt) => {
                setCurrentVideoTimestamp({ seconds: sec, formatted: fmt });
                showToast(`Note timestamp set to ${fmt}`);
              }}
            />

            {/* Course Tabs (Overview, Notes, Q&A, Resources, Certificate) */}
            <CourseTabs
              course={activeCourse}
              activeLesson={activeLesson}
              currentVideoTimeFormatted={currentVideoTimestamp.formatted}
              currentVideoTimeSeconds={currentVideoTimestamp.seconds}
              isCourseCompleted={isCourseFullyCompleted}
              learnerName={userName}
              showToast={showToast}
            />
          </div>

          {/* Right Column: Sticky Curriculum Accordion Syllabus */}
          <div className="lg:col-span-4 sticky top-4">
            <CurriculumAccordion
              course={activeCourse}
              activeLessonId={activeLesson.id}
              onSelectLesson={handleSelectLesson}
              onToggleLessonComplete={handleToggleLessonComplete}
              completedLessonIds={completedLessonIds}
            />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: COURSE CATALOG & LEARNING HUB
  // ==========================================
  const enrolledCourses = courses.filter(c => c.isEnrolled);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Featured Learning Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 md:p-8 border border-indigo-500/30 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200 text-xs font-semibold">
            <Sparkles size={12} className="text-amber-300" />
            <span>Interactive Video Classroom Platform</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Level Up Your Engineering & Architecture Skills
          </h1>

          <p className="text-xs md:text-sm text-indigo-100/90 leading-relaxed">
            Hands-on masterclasses with high-resolution video streams, code sandboxes, timestamped note-taking, and peer discussions.
          </p>

          {/* Quick Stats Banner */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-indigo-200">
            <span className="flex items-center gap-1.5">
              <GraduationCap size={15} className="text-amber-300" /> 4 Masterclasses Available
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <PlayCircle size={15} className="text-emerald-300" /> 114+ Video Lectures
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Award size={15} className="text-purple-300" /> Verifiable Certificates
            </span>
          </div>
        </div>
      </div>

      {/* Continue Learning / Enrolled Courses Section */}
      {enrolledCourses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <PlayCircle size={16} />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Continue Learning
              </h2>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {enrolledCourses.length} Course in Progress
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {enrolledCourses.map((c) => (
              <div 
                key={c.id}
                onClick={() => handleSelectCourse(c)}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-500/30 dark:border-indigo-500/20 shadow-md shadow-indigo-500/5 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-28 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-900">
                    <img 
                      src={c.thumbnail} 
                      alt={c.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <PlayCircle size={18} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Current Masterclass
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Next up: <strong>Lesson 7: Building a Custom Reactive Event Bus</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {c.progressPercentage}% Complete
                    </span>
                    <div className="w-32 mt-1">
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.progressPercentage}%` }} />
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="primary" 
                    size="sm"
                    icon={<PlayCircle size={14} />}
                  >
                    Resume Course
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Search, Filters & Course Grid */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Explore All Masterclasses
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Select any course to immediately enter the interactive video classroom
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, skills, instructor..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
        </div>

        {/* Category Pills & Level Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <SlidersHorizontal size={12} /> Level:
            </span>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelectCourse={handleSelectCourse}
              isWishlisted={wishlistedCourseIds.has(course.id)}
              onToggleWishlist={handleToggleWishlist}
            />
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="p-12 text-center border border-dashed rounded-3xl border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/20">
            <BookOpen size={36} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No matching courses found
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Try adjusting your search terms or category filters.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedLevel('All');
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningCoursesView;
