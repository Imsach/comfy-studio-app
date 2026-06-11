import { useState, useCallback } from 'react';
import { Clock, Image, Pencil, Music, Box, Download, CheckSquare, X, Loader2 } from 'lucide-react';
import HistoryGallery from '../components/HistoryGallery';
import { getGenerations } from '../services/generationService';
import type { GenerationType } from '../types';

const FILTERS: { id: GenerationType | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'all', label: 'All', icon: <Clock size={14} />, color: 'text-white/60' },
  { id: 'image', label: 'Images', icon: <Image size={14} />, color: 'text-cyan-400' },
  { id: 'edit', label: 'Edits', icon: <Pencil size={14} />, color: 'text-amber-400' },
  { id: 'audio', label: 'Audio', icon: <Music size={14} />, color: 'text-emerald-400' },
  { id: '3d', label: '3D', icon: <Box size={14} />, color: 'text-rose-400' },
];

export default function History() {
  const [filter, setFilter] = useState<GenerationType | 'all'>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(async () => {
    const gens = await getGenerations(filter === 'all' ? undefined : filter);
    const withOutput = gens.filter((g) => g.output_url);
    setSelectedIds(new Set(withOutput.map((g) => g.id)));
  }, [filter]);

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const gens = await getGenerations(filter === 'all' ? undefined : filter);
      const selected = gens.filter((g) => selectedIds.has(g.id) && g.output_url);

      for (let i = 0; i < selected.length; i++) {
        const gen = selected[i];
        const a = document.createElement('a');
        a.href = gen.output_url!;
        const ext = gen.type === 'audio' ? 'mp3' : gen.type === '3d' ? 'glb' : 'png';
        a.download = `${gen.type}-${gen.id.slice(0, 8)}.${ext}`;
        a.click();
        if (i < selected.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } finally {
      setDownloading(false);
    }
  }, [selectedIds, filter]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-white/5">
          <Clock size={20} className="text-white/60" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-white">History</h1>
          <p className="text-xs sm:text-sm text-white/40">Browse all your past generations</p>
        </div>
        <button
          onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectionMode
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-white/5 text-white/40 hover:text-white/60 border border-white/10'
          }`}
        >
          {selectionMode ? <X size={12} /> : <CheckSquare size={12} />}
          <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg w-fit overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs rounded-md transition-all duration-200 flex-shrink-0 ${
                filter === f.id
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <span className={filter === f.id ? f.color : ''}>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {selectionMode && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={selectAll}
              className="px-2.5 py-1.5 text-xs text-white/40 hover:text-white/60 bg-white/5 rounded-lg border border-white/10 transition-all"
            >
              Select all
            </button>
            <span className="text-xs text-white/30">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkDownload}
              disabled={selectedIds.size === 0 || downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-500 to-teal-500 text-white disabled:opacity-40 hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/20"
            >
              {downloading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              Download{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </button>
          </div>
        )}
      </div>

      <HistoryGallery
        filterType={filter === 'all' ? undefined : filter}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />
    </div>
  );
}
