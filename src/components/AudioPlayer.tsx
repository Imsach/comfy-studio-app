import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  onDownload?: () => void;
  onPlayStateChange?: (playing: boolean) => void;
}

export default function AudioPlayer({ src, title, autoPlay = false, onDownload, onPlayStateChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const autoPlayRef = useRef(autoPlay);
  const playStateCbRef = useRef(onPlayStateChange);

  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => { playStateCbRef.current = onPlayStateChange; }, [onPlayStateChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnd = () => {
      setIsPlaying(false);
      playStateCbRef.current?.(false);
    };
    const handlePlay = () => {
      setIsPlaying(true);
      playStateCbRef.current?.(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      playStateCbRef.current?.(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    if (autoPlayRef.current) {
      const onReady = () => {
        audio.play().catch(() => {});
      };
      if (audio.readyState >= 3) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.load();
        return () => audio.removeEventListener('canplaythrough', onReady);
      }
    }
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
      <audio ref={audioRef} src={src} preload="metadata" />
      {title && <p className="text-sm text-white/60 mb-3 truncate">{title}</p>}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={togglePlay}
          className="p-2 sm:p-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-cyan-500/20 flex-shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xs text-white/40 w-8 sm:w-10 text-right tabular-nums flex-shrink-0">{formatTime(currentTime)}</span>
          <div className="relative flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-0">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-xs text-white/40 w-8 sm:w-10 tabular-nums flex-shrink-0">{formatTime(duration)}</span>
        </div>
        <button onClick={toggleMute} className="p-1.5 text-white/40 hover:text-white transition-colors hidden sm:block">
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {onDownload && (
          <button onClick={onDownload} className="p-1.5 text-white/40 hover:text-cyan-400 transition-colors flex-shrink-0">
            <Download size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
