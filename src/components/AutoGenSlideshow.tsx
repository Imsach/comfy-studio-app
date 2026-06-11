import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Pencil, Maximize2 } from 'lucide-react';
import type { SlideshowTransition } from '../types';

interface SlideshowImage {
  url: string;
  prompt: string;
}

interface AutoGenSlideshowProps {
  images: SlideshowImage[];
  isWaiting: boolean;
  isGenerating: boolean;
  newImageUrl: string | null;
  transition: SlideshowTransition;
  intervalSeconds: number;
  showPrompt: boolean;
  showCounter: boolean;
  showAnimatedBg: boolean;
  overlayPosition: 'top' | 'bottom';
  presentationMode: boolean;
  generationCount: number;
  newImageHoldSeconds: number;
  onFullscreen: (url: string) => void;
  onDownload: (url: string, prompt: string) => void;
  onEdit: (url: string) => void;
}

export default function AutoGenSlideshow({
  images,
  isWaiting,
  isGenerating,
  newImageUrl,
  transition,
  intervalSeconds,
  showPrompt,
  showCounter,
  showAnimatedBg,
  overlayPosition,
  presentationMode,
  generationCount,
  newImageHoldSeconds,
  onFullscreen,
  onDownload,
  onEdit,
}: AutoGenSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(-1);
  const [animPhase, setAnimPhase] = useState<'idle' | 'transitioning' | 'new-reveal'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevNewImageRef = useRef<string | null>(null);

  const startSlideshow = useCallback(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % images.length;
        setPrevIndex(prev);
        setAnimPhase('transitioning');
        setTimeout(() => {
          setPrevIndex(-1);
          setAnimPhase('idle');
        }, 800);
        return next;
      });
    }, intervalSeconds * 1000);
  }, [images.length, intervalSeconds]);

  const stopSlideshow = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(holdTimerRef.current);
  }, []);

  useEffect(() => {
    if (newImageUrl && newImageUrl !== prevNewImageRef.current) {
      prevNewImageRef.current = newImageUrl;
      stopSlideshow();
      setActiveIndex(0);
      setPrevIndex(-1);
      setAnimPhase('new-reveal');
      holdTimerRef.current = setTimeout(() => {
        setAnimPhase('idle');
        if (isWaiting && images.length > 1) {
          startSlideshow();
        }
      }, newImageHoldSeconds * 1000);
    }
  }, [newImageUrl, newImageHoldSeconds, isWaiting, images.length, startSlideshow, stopSlideshow]);

  useEffect(() => {
    if (isWaiting && animPhase === 'idle' && images.length > 1) {
      startSlideshow();
      return stopSlideshow;
    }
    if (!isWaiting) {
      stopSlideshow();
    }
    return stopSlideshow;
  }, [isWaiting, animPhase, images.length, startSlideshow, stopSlideshow]);

  useEffect(() => {
    if (activeIndex >= images.length && images.length > 0) {
      setActiveIndex(0);
    }
  }, [images.length, activeIndex]);

  if (images.length === 0) return null;

  const current = images[activeIndex];
  const prev = prevIndex >= 0 && prevIndex < images.length ? images[prevIndex] : null;

  const getTransitionStyle = (isEntering: boolean): React.CSSProperties => {
    if (transition === 'crossfade') {
      return {
        opacity: isEntering ? 1 : 0,
        transition: 'opacity 0.8s ease-in-out',
      };
    }
    if (transition === 'slide') {
      return {
        transform: isEntering ? 'translateX(0)' : 'translateX(-100%)',
        opacity: isEntering ? 1 : 0,
        transition: 'transform 0.8s ease-in-out, opacity 0.5s ease-in-out',
      };
    }
    if (transition === 'zoom') {
      return {
        transform: isEntering ? 'scale(1)' : 'scale(1.15)',
        opacity: isEntering ? 1 : 0,
        transition: 'transform 0.8s ease-in-out, opacity 0.6s ease-in-out',
      };
    }
    return {
      animation: isEntering ? 'kenburns-in 8s ease-out forwards' : undefined,
      opacity: isEntering ? 1 : 0,
      transition: 'opacity 0.8s ease-in-out',
    };
  };

  const revealStyle: React.CSSProperties = animPhase === 'new-reveal'
    ? { animation: 'reveal-scale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }
    : {};

  const containerClass = presentationMode
    ? 'relative w-full h-[70vh] sm:h-[80vh] rounded-xl overflow-hidden bg-black group'
    : 'relative w-full min-h-[250px] sm:min-h-[400px] rounded-xl overflow-hidden border border-white/10 bg-black/40 group';

  return (
    <>
      <style>{`
        @keyframes kenburns-in {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        @keyframes reveal-scale {
          0% { transform: scale(0.95); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer-bg {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <div className={containerClass}>
        {showAnimatedBg && isGenerating && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.08) 25%, rgba(6,182,212,0.12) 50%, rgba(14,165,233,0.08) 75%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-bg 2s linear infinite',
              }}
            />
            <div className="absolute inset-0 border-2 border-sky-500/20 rounded-xl" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
          </div>
        )}

        {prev && animPhase === 'transitioning' && (
          <div className="absolute inset-0 z-[1]" style={getTransitionStyle(false)}>
            <img src={prev.url} alt="" className="w-full h-full object-contain" />
          </div>
        )}

        <div
          className="absolute inset-0 z-[2] flex items-center justify-center cursor-pointer"
          style={{ ...getTransitionStyle(true), ...revealStyle }}
          onClick={() => current && onFullscreen(current.url)}
        >
          <img
            src={current.url}
            alt={current.prompt}
            className={`max-w-full max-h-full object-contain ${presentationMode ? '' : 'sm:max-h-[600px]'}`}
          />
        </div>

        {showPrompt && current && (
          <div
            className={`absolute left-0 right-0 z-20 p-3 sm:p-4 ${
              overlayPosition === 'bottom'
                ? 'bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent'
                : 'top-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent'
            }`}
          >
            <p className="text-[10px] sm:text-xs text-white/70 leading-relaxed line-clamp-2">{current.prompt}</p>
          </div>
        )}

        {showCounter && (
          <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-white/50">
            {generationCount} generated
          </div>
        )}

        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-20 flex gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {current && (
            <>
              <button onClick={() => onFullscreen(current.url)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white border border-white/10 transition-all" title="Fullscreen">
                <Maximize2 size={14} />
              </button>
              <button onClick={() => onDownload(current.url, current.prompt)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-cyan-400 border border-white/10 transition-all" title="Download">
                <Download size={14} />
              </button>
              <button onClick={() => onEdit(current.url)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-amber-400 border border-white/10 transition-all" title="Edit">
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        {isWaiting && images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
            {images.slice(0, Math.min(images.length, 12)).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'bg-white/80 scale-125' : 'bg-white/20'
                }`}
              />
            ))}
            {images.length > 12 && <span className="text-[8px] text-white/30 ml-1">+{images.length - 12}</span>}
          </div>
        )}
      </div>
    </>
  );
}
