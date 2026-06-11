import { useEffect, useCallback } from 'react';
import { X, Download, Pencil } from 'lucide-react';

interface FullscreenViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
}

export default function FullscreenViewer({ src, alt, onClose, onDownload, onEdit }: FullscreenViewerProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt || 'Fullscreen view'}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-amber-400 border border-white/10 transition-all hover:scale-105"
              title="Edit this image"
            >
              <Pencil size={18} />
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-cyan-400 border border-white/10 transition-all hover:scale-105"
              title="Download"
            >
              <Download size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white border border-white/10 transition-all hover:scale-105"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
