import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Settings, 
  CheckCircle2, 
  SkipForward, 
  Bookmark, 
  Sparkles,
  Subtitles,
  Gauge
} from 'lucide-react';
import { CourseLesson } from '../../types';

interface VideoPlayerProps {
  lesson: CourseLesson;
  onLessonComplete: (lessonId: string) => void;
  onNextLesson?: () => void;
  onPrevLesson?: () => void;
  hasNextLesson?: boolean;
  hasPrevLesson?: boolean;
  onAddNoteAtTimestamp?: (timestampSeconds: number, formatted: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  lesson,
  onLessonComplete,
  onNextLesson,
  onPrevLesson,
  hasNextLesson = false,
  hasPrevLesson = false,
  onAddNoteAtTimestamp,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(lesson.durationSeconds || 300);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('1080p HD');
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [videoError, setVideoError] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Sync state when lesson changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoError(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked by browser policy without user interaction
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [lesson.id]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Auto complete if watched over 90%
      if (
        videoRef.current.duration > 0 && 
        videoRef.current.currentTime / videoRef.current.duration > 0.9 &&
        !lesson.isCompleted
      ) {
        onLessonComplete(lesson.id);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || lesson.durationSeconds);
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.playbackRate = playbackRate;
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    onLessonComplete(lesson.id);
    if (hasNextLesson && onNextLesson) {
      onNextLesson();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setIsSpeedMenuOpen(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsSpeedMenuOpen(false);
        setIsQualityMenuOpen(false);
      }
    }, 3000);
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-black/40 group select-none flex items-center justify-center"
    >
      {/* Real Video Element */}
      <video
        ref={videoRef}
        src={lesson.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onError={() => setVideoError(true)}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Simulated Captions Display */}
      {captionsEnabled && isPlaying && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs md:text-sm font-medium text-center pointer-events-none transition-all">
          <span>{lesson.title} — Architectural walkthrough & live demonstration</span>
        </div>
      )}

      {/* Large Center Play / Pause Indicator on Click */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute z-20 w-16 h-16 md:w-20 md:h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/50 hover:scale-110 active:scale-95 transition-all backdrop-blur-md border border-white/20"
          aria-label="Play video"
        >
          <Play size={32} className="ml-1 fill-white" />
        </button>
      )}

      {/* Top Bar inside Video Player */}
      <div className={`absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
        showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2.5 max-w-[70%]">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/20 px-2 py-0.5 rounded">
            {lesson.type.toUpperCase()}
          </span>
          <h2 className="text-sm md:text-base font-bold text-white truncate drop-shadow">
            {lesson.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onAddNoteAtTimestamp && (
            <button
              onClick={() => onAddNoteAtTimestamp(currentTime, formatTime(currentTime))}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-xs font-semibold transition-all"
              title="Add note at current timestamp"
            >
              <Bookmark size={13} className="text-amber-400" />
              <span>Add Note at {formatTime(currentTime)}</span>
            </button>
          )}

          <button
            onClick={() => onLessonComplete(lesson.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl backdrop-blur-md border text-xs font-semibold transition-all ${
              lesson.isCompleted
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-white/10 border-white/20 text-white/80 hover:text-white'
            }`}
          >
            <CheckCircle2 size={13} className={lesson.isCompleted ? 'text-emerald-400' : ''} />
            <span>{lesson.isCompleted ? 'Completed' : 'Mark Done'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 p-3 md:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-2 transition-opacity duration-300 ${
        showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Timeline Scrubber */}
        <div 
          className="relative group/scrubber cursor-pointer py-1"
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Timestamp Hover Tooltip */}
          {hoverTime !== null && (
            <div 
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-900 border border-white/20 text-white text-[10px] font-mono font-semibold pointer-events-none shadow-lg"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Background Track */}
          <div className="h-1.5 group-hover/scrubber:h-2.5 w-full bg-white/20 rounded-full overflow-hidden transition-all relative">
            {/* Progress Fill */}
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Real Input Range Scrubber (Invisible overlay for drag) */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Seek video timeline"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Left Controls: Play, Skip, Time, Volume */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={togglePlay}
              className="p-2 text-white hover:text-indigo-400 transition-colors"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
            </button>

            <button
              onClick={() => skipTime(-10)}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
              title="Rewind 10 seconds"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={16} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 text-white/80 hover:text-white transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 md:w-20 h-1 bg-white/20 rounded-lg accent-indigo-500 cursor-pointer"
                aria-label="Adjust volume"
              />
            </div>

            {/* Time Stamp */}
            <span className="text-xs font-mono font-medium text-white/90">
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Speed, Quality, Captions, Next Lesson, Fullscreen */}
          <div className="flex items-center gap-1.5 md:gap-2">
            
            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsSpeedMenuOpen(!isSpeedMenuOpen);
                  setIsQualityMenuOpen(false);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  playbackRate !== 1 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              {isSpeedMenuOpen && (
                <div className="absolute bottom-9 right-0 w-28 bg-zinc-900/95 border border-white/15 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-30 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase">Speed</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg flex items-center justify-between ${
                        playbackRate === rate 
                          ? 'bg-indigo-600 text-white font-bold' 
                          : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <span className="text-[10px]">Active</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsQualityMenuOpen(!isQualityMenuOpen);
                  setIsSpeedMenuOpen(false);
                }}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Quality settings"
                aria-label="Quality settings"
              >
                <Settings size={16} />
              </button>

              {isQualityMenuOpen && (
                <div className="absolute bottom-9 right-0 w-32 bg-zinc-900/95 border border-white/15 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-30 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase">Resolution</div>
                  {['1080p HD', '720p', '480p', 'Auto'].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setSelectedQuality(q);
                        setIsQualityMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg flex items-center justify-between ${
                        selectedQuality === q 
                          ? 'bg-indigo-600 text-white font-bold' 
                          : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{q}</span>
                      {selectedQuality === q && <span className="text-[10px]">Active</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Captions Toggle */}
            <button
              onClick={() => setCaptionsEnabled(!captionsEnabled)}
              className={`p-1.5 rounded-lg transition-colors ${
                captionsEnabled 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Closed Captions (CC)"
              aria-label="Closed Captions"
            >
              <Subtitles size={16} />
            </button>

            {/* Next Lesson Button */}
            {hasNextLesson && onNextLesson && (
              <button
                onClick={onNextLesson}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10"
                title="Next lesson"
              >
                <span className="hidden sm:inline">Next</span>
                <SkipForward size={14} />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
