import React, { useState } from 'react';
import { 
  BookOpen, 
  FileText, 
  MessageSquare, 
  Download, 
  Award, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ThumbsUp, 
  CheckCircle2, 
  Sparkles,
  Share2,
  Clock,
  User,
  Star,
  Search
} from 'lucide-react';
import { Course, CourseLesson, CourseNote, CourseDiscussion } from '../../types';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input, { Textarea } from '../ui/Input';

interface CourseTabsProps {
  course: Course;
  activeLesson: CourseLesson;
  currentVideoTimeFormatted?: string;
  currentVideoTimeSeconds?: number;
  onSeekToTimestamp?: (seconds: number) => void;
  isCourseCompleted: boolean;
  learnerName: string;
  showToast: (msg: string) => void;
}

export const CourseTabs: React.FC<CourseTabsProps> = ({
  course,
  activeLesson,
  currentVideoTimeFormatted = '00:00',
  currentVideoTimeSeconds = 0,
  onSeekToTimestamp,
  isCourseCompleted,
  learnerName,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'qa' | 'resources' | 'certificate'>('overview');

  // Notes state
  const [notes, setNotes] = useState<CourseNote[]>([
    {
      id: 'n-1',
      lessonId: 'l-1',
      lessonTitle: '1. Welcome & Course Blueprint Overview',
      timestamp: '02:15',
      timestampSeconds: 135,
      text: 'Remember to clone repository and check the environment variables in .env.example before booting the dev server.',
      createdAt: '2 days ago'
    },
    {
      id: 'n-2',
      lessonId: 'l-2',
      lessonTitle: '2. React 19 Compiler, Server Actions, & Hook Paradigms',
      timestamp: '08:40',
      timestampSeconds: 520,
      text: 'React 19 compiler automatically memoizes values and functions — no need for excessive useMemo and useCallback.',
      createdAt: 'Yesterday'
    }
  ]);
  const [newNoteText, setNewNoteText] = useState('');

  // Q&A state
  const [discussions, setDiscussions] = useState<CourseDiscussion[]>([
    {
      id: 'qa-1',
      lessonId: 'l-2',
      userName: 'Michael Zhang',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      userRole: 'Student',
      title: 'How does the compiler handle custom hooks with external subscriptions?',
      content: 'When we create a custom useSyncExternalStore hook, does the React 19 compiler attempt to inline the selector or does it preserve reference identity?',
      timestamp: '3 hours ago',
      upvotes: 14,
      repliesCount: 2,
      hasInstructorReply: true
    },
    {
      id: 'qa-2',
      lessonId: 'l-3',
      userName: 'Sophia Martinez',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      userRole: 'Student',
      title: 'Difference between Discriminated Union and Polymorphic Props?',
      content: 'Is there a performance difference at build time when TypeScript compiles deeply nested union types?',
      timestamp: '1 day ago',
      upvotes: 8,
      repliesCount: 1,
      hasInstructorReply: false
    }
  ]);
  const [qaSearch, setQaSearch] = useState('');
  const [newQaTitle, setNewQaTitle] = useState('');
  const [newQaContent, setNewQaContent] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote: CourseNote = {
      id: `note-${Date.now()}`,
      lessonId: activeLesson.id,
      lessonTitle: activeLesson.title,
      timestamp: currentVideoTimeFormatted,
      timestampSeconds: currentVideoTimeSeconds,
      text: newNoteText.trim(),
      createdAt: 'Just now'
    };

    setNotes([newNote, ...notes]);
    setNewNoteText('');
    showToast(`Note saved at ${currentVideoTimeFormatted}!`);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    showToast('Note removed');
  };

  const handleUpvoteQa = (id: string) => {
    setDiscussions(discussions.map(q => q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q));
    showToast('Upvoted question');
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQaTitle.trim() || !newQaContent.trim()) return;

    const newQ: CourseDiscussion = {
      id: `qa-${Date.now()}`,
      lessonId: activeLesson.id,
      userName: learnerName || 'You',
      userRole: 'Student',
      title: newQaTitle.trim(),
      content: newQaContent.trim(),
      timestamp: 'Just now',
      upvotes: 1,
      repliesCount: 0,
      hasInstructorReply: false
    };

    setDiscussions([newQ, ...discussions]);
    setNewQaTitle('');
    setNewQaContent('');
    setIsAskingQuestion(false);
    showToast('Your question was posted to the instructor and students!');
  };

  const filteredDiscussions = discussions.filter(d => 
    d.title.toLowerCase().includes(qaSearch.toLowerCase()) || 
    d.content.toLowerCase().includes(qaSearch.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
      {/* Tabs Header Navigation */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-950/40 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-white/10'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen size={14} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'notes'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-white/10'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText size={14} />
          <span>Notes & Bookmarks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300">
            {notes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('qa')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'qa'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-white/10'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare size={14} />
          <span>Q&A / Discussion</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300">
            {discussions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'resources'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-white/10'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Download size={14} />
          <span>Resources & Code</span>
        </button>

        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'certificate'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-white/10'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award size={14} className={isCourseCompleted ? "text-amber-500" : ""} />
          <span>Certificate</span>
          {isCourseCompleted && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
              Unlocked
            </span>
          )}
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="p-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                About this course
              </h2>
              <p className="text-sm text-slate-600 dark:text-zinc-300 mt-2 leading-relaxed">
                {course.description}
              </p>
            </div>

            {/* What you'll learn checklist */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                What you'll learn in this masterclass
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {course.whatYouWillLearn.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium leading-normal">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                Requirements & Prerequisites
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-zinc-400">
                {course.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>

            {/* Instructor Profile */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Your Instructor
              </h3>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/10">
                <img 
                  src={course.instructor.avatar} 
                  alt={course.instructor.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-white/10 shadow-md"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {course.instructor.name}
                    </h4>
                    <Badge variant="indigo" size="sm">Instructor</Badge>
                  </div>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                    {course.instructor.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    {course.instructor.bio}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Star size={13} className="text-amber-400 fill-amber-400" />
                      <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{course.instructor.rating}</strong> Instructor Rating
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{course.instructor.studentsCount.toLocaleString()}</strong> Students
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTES & BOOKMARKS TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* Create new note box */}
            <form onSubmit={handleAddNote} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-600 dark:text-indigo-400" />
                  Capture Note at <strong className="text-indigo-600 dark:text-indigo-400">{currentVideoTimeFormatted}</strong> in "{activeLesson.title}"
                </span>
              </div>

              <Textarea 
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Type your key takeaway, code reminder, or architectural note here..."
                rows={2}
              />

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={!newNoteText.trim()}
                  icon={<Plus size={14} />}
                >
                  Save Timestamped Note
                </Button>
              </div>
            </form>

            {/* Notes List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                All Saved Notes ({notes.length})
              </h3>

              {notes.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-white/10">
                  <FileText size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                    No notes saved yet. Capture your thoughts as you watch the course!
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <div 
                    key={note.id}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-start justify-between gap-4 group hover:border-indigo-500/40 transition-all"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        {onSeekToTimestamp ? (
                          <button
                            type="button"
                            onClick={() => onSeekToTimestamp(note.timestampSeconds)}
                            className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white font-mono font-bold text-xs transition-colors flex items-center gap-1"
                            title="Jump to video timestamp"
                          >
                            <Clock size={11} /> {note.timestamp}
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs">
                            {note.timestamp}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-xs">
                          {note.lessonTitle}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          • {note.createdAt}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-normal">
                        {note.text}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Q&A / DISCUSSIONS TAB */}
        {activeTab === 'qa' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={qaSearch}
                  onChange={(e) => setQaSearch(e.target.value)}
                  placeholder="Search questions & discussions..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <Button
                variant={isAskingQuestion ? "secondary" : "primary"}
                size="sm"
                onClick={() => setIsAskingQuestion(!isAskingQuestion)}
                icon={isAskingQuestion ? undefined : <Plus size={14} />}
              >
                {isAskingQuestion ? "Cancel" : "Ask a New Question"}
              </Button>
            </div>

            {/* Ask Question Form */}
            {isAskingQuestion && (
              <form onSubmit={handleCreateQuestion} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Post question for "{activeLesson.title}"
                </h4>
                <Input 
                  value={newQaTitle}
                  onChange={(e) => setNewQaTitle(e.target.value)}
                  placeholder="Title or summary of your question..."
                />
                <Textarea 
                  value={newQaContent}
                  onChange={(e) => setNewQaContent(e.target.value)}
                  placeholder="Provide context, code snippets, or error trace..."
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAskingQuestion(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Publish Question
                  </Button>
                </div>
              </form>
            )}

            {/* Question List */}
            <div className="space-y-3">
              {filteredDiscussions.map((qa) => (
                <div 
                  key={qa.id}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 space-y-2 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-[10px] flex items-center justify-center">
                        {qa.userName[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {qa.userName}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {qa.timestamp}
                      </span>
                      {qa.hasInstructorReply && (
                        <Badge variant="emerald" size="sm">
                          Instructor Answered
                        </Badge>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpvoteQa(qa.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-zinc-300 text-xs font-semibold transition-colors"
                      title="Upvote question"
                    >
                      <ThumbsUp size={12} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{qa.upvotes}</span>
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {qa.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {qa.content}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-white/5">
                    <span>{qa.repliesCount} replies</span>
                    <button 
                      onClick={() => showToast("Opening discussion thread...")}
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Reply to Thread
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESOURCES TAB */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Course Resources & Source Code
              </h3>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                All attachments verified clean
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Full Course GitHub Repository', type: 'code', meta: 'GitHub Starter & Solution branches', icon: ExternalLink, action: () => window.open('https://github.com', '_blank') },
                { title: 'React 19 & Cloud Architecture PDF Roadmap', type: 'pdf', meta: '24 pages • High-Res Diagram Guide', icon: Download, action: () => showToast('Downloading Roadmap PDF (2.4 MB)...') },
                { title: 'Docker & Kubernetes Cheat Sheet', type: 'pdf', meta: 'YAML configurations & CLI reference', icon: Download, action: () => showToast('Downloading Docker Cheat Sheet (1.1 MB)...') },
                { title: 'Exercise Workspaces & Starter Assets ZIP', type: 'zip', meta: '14 hands-on lab sandboxes (18 MB)', icon: Download, action: () => showToast('Downloading Exercise ZIP (18.2 MB)...') }
              ].map((res, idx) => (
                <div 
                  key={idx}
                  onClick={res.action}
                  className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 hover:border-indigo-500/50 hover:bg-indigo-50/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <res.icon size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {res.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        {res.meta}
                      </p>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Download size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CERTIFICATE TAB */}
        {activeTab === 'certificate' && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
                <Award size={26} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Certificate of Masterclass Completion
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Issued upon 100% completion of all video lectures, hands-on lab exercises, and knowledge checks.
              </p>
            </div>

            {/* Certificate Preview Card */}
            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-zinc-900 text-white border-4 border-amber-500/40 shadow-2xl overflow-hidden max-w-2xl mx-auto">
              {/* Decorative background watermark */}
              <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                <Award size={240} />
              </div>

              <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-widest text-xs">
                  <Sparkles size={14} /> Official Certification of Mastery <Sparkles size={14} />
                </div>

                <div>
                  <p className="text-xs text-indigo-200">This is proudly presented to</p>
                  <h3 className="text-2xl font-extrabold text-white mt-1 tracking-tight font-serif">
                    {learnerName || 'Thompson Manda'}
                  </h3>
                </div>

                <div className="max-w-md">
                  <p className="text-xs text-zinc-300">
                    for successfully demonstrating mastery in full-stack architecture, deployment microservices, and reactive design patterns in
                  </p>
                  <p className="text-sm font-bold text-amber-300 mt-1">
                    {course.title}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10 w-full flex items-center justify-between text-[10px] text-zinc-400">
                  <div className="text-left">
                    <p className="font-semibold text-white">{course.instructor.name}</p>
                    <p>Principal Instructor</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">August 2026</p>
                    <p>ID: CERT-MOD-{course.id.toUpperCase()}-984</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-3">
              <Button
                variant="primary"
                icon={<Download size={14} />}
                onClick={() => showToast('Certificate PDF downloaded successfully!')}
              >
                Download PDF Certificate
              </Button>
              <Button
                variant="secondary"
                icon={<Share2 size={14} />}
                onClick={() => showToast('Certificate verification link copied to clipboard!')}
              >
                Share on LinkedIn
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CourseTabs;
