import { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, Download, Image, Music, Box, Pencil, Loader2, CheckSquare, Square, Play } from 'lucide-react';
import { getGenerations, deleteGeneration, clearHistory } from '../services/generationService';
import { useAppStore } from '../store/appStore';
import AudioPlayer from './AudioPlayer';
import type { Generation, GenerationType } from '../types';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image size={14} />,
  edit: <Pencil size={14} />,
  audio: <Music size={14} />,
  '3d': <Box size={14} />,
};

const TYPE_COLORS: Record<string, string> = {
  image: 'text-cyan-400',
  edit: 'text-amber-400',
  audio: 'text-emerald-400',
  '3d': 'text-rose-400',
};

interface HistoryGalleryProps {
  filterType?: GenerationType;
  onRerun?: (gen: Generation) => void;
  compact?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export default function HistoryGallery({
  filterType,
  onRerun,
  compact = false,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: HistoryGalleryProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const setPage = useAppStore((s) => s.setPage);
  const setPendingEditImage = useAppStore((s) => s.setPendingEditImage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGenerations(filterType);
      setGenerations(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    await deleteGeneration(id);
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  };

  const handleClear = async () => {
    await clearHistory(filterType);
    setGenerations([]);
  };

  const handleEdit = useCallback((imageUrl: string) => {
    setPendingEditImage(imageUrl);
    setPage('image-edit');
  }, [setPendingEditImage, setPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="p-4 rounded-2xl bg-white/5 inline-block mb-3">
          <Image size={32} className="text-white/20" />
        </div>
        <p className="text-white/40 text-sm">No generations yet</p>
        <p className="text-white/20 text-xs mt-1">Your creations will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/40">{generations.length} generation{generations.length !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-1.5 text-white/30 hover:text-white/60 transition-colors" title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button onClick={handleClear} className="p-1.5 text-white/30 hover:text-red-400 transition-colors" title="Clear all">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
        {generations.map((gen) => {
          const isImageType = gen.type === 'image' || gen.type === 'edit';
          const isAudio = gen.type === 'audio';
          const isSelected = selectedIds?.has(gen.id) ?? false;

          return (
            <div
              key={gen.id}
              className={`group relative bg-white/5 border rounded-xl overflow-hidden hover:border-white/10 transition-all duration-200 ${
                isSelected ? 'border-cyan-500/40 ring-1 ring-cyan-500/20' : 'border-white/5'
              } ${selectionMode ? 'cursor-pointer' : ''}`}
              onClick={selectionMode ? () => onToggleSelect?.(gen.id) : undefined}
            >
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  {isSelected ? (
                    <CheckSquare size={18} className="text-cyan-400 drop-shadow-lg" />
                  ) : (
                    <Square size={18} className="text-white/40 drop-shadow-lg" />
                  )}
                </div>
              )}

              {gen.output_url ? (
                isAudio ? (
                  <div
                    className="h-32 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500/10 to-teal-500/10 cursor-pointer"
                    onClick={(e) => {
                      if (selectionMode) return;
                      e.stopPropagation();
                      setPlayingAudioId(playingAudioId === gen.id ? null : gen.id);
                    }}
                  >
                    {playingAudioId === gen.id ? (
                      <div className="w-full px-2" onClick={(e) => e.stopPropagation()}>
                        <AudioPlayer
                          src={gen.output_url}
                          autoPlay
                          onDownload={() => {
                            const a = document.createElement('a');
                            a.href = gen.output_url!;
                            a.download = 'audio.mp3';
                            a.click();
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="p-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 transition-transform hover:scale-110">
                          <Play size={20} className="text-emerald-400" />
                        </div>
                        <span className="text-[11px] text-emerald-400/60 font-medium">Play audio</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={gen.output_url}
                    alt={gen.prompt}
                    className="w-full h-32 object-cover"
                    loading="lazy"
                  />
                )
              ) : (
                <div className="h-32 flex items-center justify-center bg-white/[0.02]">
                  <div className={`${TYPE_COLORS[gen.type]} opacity-30`}>{TYPE_ICONS[gen.type]}</div>
                </div>
              )}
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`${TYPE_COLORS[gen.type]}`}>{TYPE_ICONS[gen.type]}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-medium ${TYPE_COLORS[gen.type]}`}>
                    {gen.type}
                  </span>
                  <span
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                      gen.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : gen.status === 'failed'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-white/5 text-white/40'
                    }`}
                  >
                    {gen.status}
                  </span>
                </div>
                <p className="text-xs text-white/60 truncate">{gen.prompt || 'No prompt'}</p>
                <p className="text-[10px] text-white/20 mt-1">
                  {new Date(gen.created_at).toLocaleDateString()}
                </p>
              </div>
              {!selectionMode && (
                <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${
                  isAudio && gen.output_url ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  {isAudio && gen.output_url && playingAudioId !== gen.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingAudioId(gen.id);
                      }}
                      className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-all"
                      title="Play audio"
                    >
                      <Play size={12} />
                    </button>
                  )}
                  {onRerun && (
                    <button
                      onClick={() => onRerun(gen)}
                      className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/60 hover:text-white border border-white/10 transition-all"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}
                  {gen.output_url && isImageType && (
                    <button
                      onClick={() => handleEdit(gen.output_url!)}
                      className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/60 hover:text-amber-400 border border-white/10 transition-all"
                      title="Edit image"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {gen.output_url && (
                    <a
                      href={gen.output_url}
                      download
                      className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/60 hover:text-cyan-400 border border-white/10 transition-all"
                    >
                      <Download size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(gen.id)}
                    className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/60 hover:text-red-400 border border-white/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
