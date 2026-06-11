import { useState, useRef, useCallback } from 'react';

interface ImageCompareProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function ImageCompare({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: ImageCompareProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handleMouseDown = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current) handleMove(e.clientX);
    },
    [handleMove]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden border border-white/10 select-none cursor-col-resize"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      <img src={after} alt={afterLabel} className="w-full h-64 object-cover" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img src={before} alt={beforeLabel} className="w-full h-64 object-cover" />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-gray-600 rounded-full" />
            <div className="w-0.5 h-3 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>
      <span className="absolute top-2 left-2 text-xs bg-black/60 backdrop-blur-sm text-white/80 px-2 py-1 rounded">
        {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 text-xs bg-black/60 backdrop-blur-sm text-white/80 px-2 py-1 rounded">
        {afterLabel}
      </span>
    </div>
  );
}
