import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  preview?: string | null;
  onClear?: () => void;
  accept?: string;
}

export default function ImageUploader({
  onUpload,
  preview = null,
  onClear,
  accept = 'image/*',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file && file.type.startsWith('image/')) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleClick = useCallback(() => inputRef.current?.click(), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (preview) {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/5">
        <img src={preview} alt="Uploaded" className="w-full h-48 object-contain bg-black/20" />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-white hover:bg-red-500/80 transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
        isDragging
          ? 'border-cyan-400 bg-cyan-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      <div className={`p-3 rounded-xl transition-colors ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/40'}`}>
        {isDragging ? <Upload size={24} /> : <ImageIcon size={24} />}
      </div>
      <div className="text-center">
        <p className="text-sm text-white/60">
          {isDragging ? 'Drop image here' : 'Click or drag image to upload'}
        </p>
        <p className="text-xs text-white/30 mt-1">PNG, JPG up to 10MB</p>
      </div>
    </div>
  );
}
