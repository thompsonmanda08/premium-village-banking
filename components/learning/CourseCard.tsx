import React from 'react';
import { 
  Star, 
  Clock, 
  BookOpen, 
  Award, 
  PlayCircle, 
  CheckCircle2, 
  Sparkles,
  Heart,
  Share2
} from 'lucide-react';
import { Course } from '../../types';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';

interface CourseCardProps {
  course: Course;
  onSelectCourse: (course: Course) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (courseId: string) => void;
  variant?: 'grid' | 'horizontal' | 'compact';
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onSelectCourse,
  isWishlisted = false,
  onToggleWishlist,
  variant = 'grid'
}) => {
  const getBadgeVariant = (badge?: string) => {
    switch (badge) {
      case 'Bestseller': return 'amber';
      case 'Highest Rated': return 'emerald';
      case 'Hot & New': return 'rose';
      default: return 'indigo';
    }
  };

  if (variant === 'horizontal') {
    return (
      <div 
        onClick={() => onSelectCourse(course)}
        className="group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer select-none"
      >
        <div className="relative w-full sm:w-56 h-36 shrink-0 rounded-xl overflow-hidden bg-slate-900">
          <img 
            src={course.thumbnail} 
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
            <span className="text-[11px] font-semibold text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1">
              <PlayCircle size={12} className="text-indigo-400" />
              {course.totalLectures} lectures
            </span>
          </div>
          {course.badge && (
            <div className="absolute top-2 left-2">
              <Badge variant={getBadgeVariant(course.badge)} size="sm">
                {course.badge}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {course.category} • {course.level}
              </span>
              {onToggleWishlist && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(course.id);
                  }}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isWishlisted 
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                      : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-500'
                  }`}
                  aria-label="Wishlist course"
                >
                  <Heart size={14} className={isWishlisted ? "fill-rose-500" : ""} />
                </button>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
              {course.title}
            </h3>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-1">
              {course.subtitle}
            </p>

            <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 font-medium flex items-center gap-1.5">
              By {course.instructor.name}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-amber-500">{course.rating.toFixed(1)}</span>
                <div className="flex items-center text-amber-400">
                  <Star size={12} className="fill-amber-400" />
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  ({course.reviewsCount.toLocaleString()})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <Clock size={11} /> {course.totalDuration}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {course.isEnrolled ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {course.progressPercentage || 0}% Complete
                </span>
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ${course.price.toFixed(2)}
                  </span>
                  {course.originalPrice && (
                    <span className="text-xs text-slate-400 line-through">
                      ${course.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => onSelectCourse(course)}
      className="group flex flex-col justify-between rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer overflow-hidden select-none"
    >
      {/* Thumbnail Banner */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        <img 
          src={course.thumbnail} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-3">
          <span className="text-[11px] font-semibold text-white bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-lg flex items-center gap-1">
            <PlayCircle size={12} className="text-indigo-400" />
            {course.totalLectures} Lessons
          </span>
          <span className="text-[11px] font-medium text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg flex items-center gap-1">
            <Clock size={11} />
            {course.totalDuration}
          </span>
        </div>

        {course.badge && (
          <div className="absolute top-2.5 left-2.5">
            <Badge variant={getBadgeVariant(course.badge)} size="sm">
              {course.badge}
            </Badge>
          </div>
        )}

        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(course.id);
            }}
            className={`absolute top-2.5 right-2.5 p-1.5 rounded-xl backdrop-blur-md transition-all ${
              isWishlisted 
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
                : 'bg-black/50 text-white/80 hover:text-white hover:bg-black/70'
            }`}
            aria-label="Wishlist course"
          >
            <Heart size={14} className={isWishlisted ? "fill-white" : ""} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
              {course.category}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              • {course.level}
            </span>
          </div>

          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
            {course.title}
          </h3>

          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
            {course.subtitle}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <img 
              src={course.instructor.avatar} 
              alt={course.instructor.name}
              className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-white/10"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
              {course.instructor.name}
            </span>
          </div>
        </div>

        {/* Bottom Metrics / Price / Progress */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
          {course.isEnrolled ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600 dark:text-zinc-400">Course Progress</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{course.progressPercentage || 0}%</span>
              </div>
              <ProgressBar value={course.progressPercentage || 0} variant="indigo" size="sm" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-500">{course.rating.toFixed(1)}</span>
                <div className="flex items-center text-amber-400">
                  <Star size={11} className="fill-amber-400" />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                  ({course.reviewsCount.toLocaleString()})
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  ${course.price.toFixed(2)}
                </span>
                {course.originalPrice && (
                  <span className="text-[11px] text-slate-400 line-through">
                    ${course.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
