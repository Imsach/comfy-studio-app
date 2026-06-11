import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

interface MultiImageUploaderProps {
  images: UploadedImage[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  accept?: string;
  maxImages?: number;
}

export default function MultiImageUploader({
  images,
  onAdd,
  onRemove,
  selectedId,
  onSelect,
  accept = 'image/*',
  maxImages = 10,
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const valid = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      const remaining = maxImages - images.length;
      if (remaining > 0 && valid.length > 0) {
        onAdd(valid.slice(0, remaining));
      }
    },
    [onAdd, images.length, maxImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleClick = useCallback(() => inputRef.current?.click(), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const scrollStrip = useCallback((dir: 'left' | 'right') => {
    stripRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  const selected = images.find((img) => img.id === selectedId);

  if (images.length === 0) {
    return (
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} className="hidden" />
        <div className={`p-3 rounded-xl transition-colors ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/40'}`}>
          {isDragging ? <Upload size={24} /> : <ImageIcon size={24} />}
        </div>
        <div className="text-center">
          <p className="text-sm text-white/60">
            {isDragging ? 'Drop images here' : 'Click or drag images to upload'}
          </p>
          <p className="text-xs text-white/30 mt-1">PNG, JPG up to 10MB -- multiple files supported</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-2 relative"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-500/10 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 text-cyan-400">
            <Upload size={20} />
            <span className="text-sm font-medium">Drop to add images</span>
          </div>
        </div>
      )}

      {selected && (
        <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/20">
          <img src={selected.preview} alt="Selected" className="w-full h-48 object-contain" />
          <div
            role="button"
            tabIndex={0}
            onClick={() => onRemove(selected.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRemove(selected.id); }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-white hover:bg-red-500/80 transition-all duration-200 opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            <X size={14} />
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white/60">
              {images.findIndex((i) => i.id === selectedId) + 1} / {images.length}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {images.length > 4 && (
          <button onClick={() => scrollStrip('left')} className="p-1 rounded-lg bg-white/5 text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
            <ChevronLeft size={14} />
          </button>
        )}
        <div ref={stripRef} className="flex gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-thin">
          {images.map((img) => (
            <div
              key={img.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(img.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(img.id); }}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                img.id === selectedId
                  ? 'border-amber-400 ring-1 ring-amber-400/30'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove(img.id); } }}
                className="absolute -top-0.5 -right-0.5 p-0.5 rounded-full bg-red-500/80 text-white opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={8} />
              </div>
            </div>
          ))}
          {images.length < maxImages && (
            <button
              onClick={handleClick}
              className="flex-shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        {images.length > 4 && (
          <button onClick={() => scrollStrip('right')} className="p-1 rounded-lg bg-white/5 text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
            <ChevronRight size={14} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} className="hidden" />
    </div>
  );
}
