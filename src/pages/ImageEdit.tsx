import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Pencil, Settings2, ChevronDown, ChevronUp, Dice5,
  Maximize2, Layers, Loader2, CheckCircle2, XCircle, Image as ImageIcon,
} from 'lucide-react';
import PromptBox from '../components/PromptBox';
import MultiImageUploader from '../components/MultiImageUploader';
import type { UploadedImage } from '../components/MultiImageUploader';
import ImageCompare from '../components/ImageCompare';
import FullscreenViewer from '../components/FullscreenViewer';
import JobQueue from '../components/JobQueue';
import HistoryGallery from '../components/HistoryGallery';
import { useGeneration } from '../hooks/useGeneration';
import { useAppStore } from '../store/appStore';
import {
  loadWorkflowTemplate,
  injectImageEditParams,
  uploadImage,
} from '../services/comfyClient';
import type { Generation } from '../types';

let _imgCounter = 0;

type BatchStatus = 'idle' | 'running' | 'done';

interface BatchProgress {
  total: number;
  completed: number;
  currentName: string;
  failed: string[];
}

export default function ImageEdit() {
  const { generate, loading, error, clearError } = useGeneration();
  const [results, setResults] = useState<Map<string, Generation>>(new Map());
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  const [steps, setSteps] = useState(4);
  const [cfg, setCfg] = useState(1);
  const [seed, setSeed] = useState(-1);
  const [denoise, setDenoise] = useState(1);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    total: 0, completed: 0, currentName: '', failed: [],
  });
  const batchAbortRef = useRef(false);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const pendingEditImage = useAppStore((s) => s.pendingEditImageUrl);
  const setPendingEditImage = useAppStore((s) => s.setPendingEditImage);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  const handleAddImages = useCallback((files: File[]) => {
    const newImages: UploadedImage[] = files.map((file) => ({
      id: `img-${++_imgCounter}-${Date.now()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => {
      const updated = [...prev, ...newImages];
      return updated;
    });
    setSelectedId((prev) => {
      if (prev && imagesRef.current.find((i) => i.id === prev)) return prev;
      return newImages[0].id;
    });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      const updated = prev.filter((i) => i.id !== id);
      if (id === selectedIdRef.current) {
        const newIdx = Math.min(idx, updated.length - 1);
        setSelectedId(updated[newIdx]?.id ?? null);
      }
      return updated;
    });
    setResults((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (pendingEditImage) {
      const url = pendingEditImage;
      setPendingEditImage(null);
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], 'edit-image.png', { type: blob.type || 'image/png' });
          handleAddImages([file]);
        })
        .catch(() => {});
    }
  }, [pendingEditImage, setPendingEditImage, handleAddImages]);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      const selected = imagesRef.current.find((i) => i.id === selectedIdRef.current);
      if (!selected) return;
      clearError();

      const buildWorkflow = async () => {
        const uploaded = await uploadImage(selected.file);
        const template = await loadWorkflowTemplate('image_qwen_image_edit_2509.json');
        return injectImageEditParams(template, {
          prompt,
          imageName: uploaded.name,
          seed,
          steps,
          cfg,
          denoise,
        });
      };

      const gen = await generate('edit', prompt, { steps, cfg, seed, denoise }, buildWorkflow);
      if (gen && selectedIdRef.current) {
        setResults((prev) => new Map(prev).set(selectedIdRef.current!, gen));
      }
    },
    [generate, steps, cfg, seed, denoise, clearError]
  );

  const handleBatchGenerate = useCallback(
    async (prompt: string) => {
      const allImages = imagesRef.current;
      if (allImages.length === 0) return;
      clearError();
      batchAbortRef.current = false;
      setBatchStatus('running');
      setBatchProgress({ total: allImages.length, completed: 0, currentName: '', failed: [] });

      const failed: string[] = [];

      for (let i = 0; i < allImages.length; i++) {
        if (batchAbortRef.current) break;
        const img = allImages[i];
        setBatchProgress((p) => ({
          ...p,
          completed: i,
          currentName: img.file.name || `Image ${i + 1}`,
        }));

        try {
          const buildWorkflow = async () => {
            const uploaded = await uploadImage(img.file);
            const template = await loadWorkflowTemplate('image_qwen_image_edit_2509.json');
            return injectImageEditParams(template, {
              prompt,
              imageName: uploaded.name,
              seed: seed === -1 ? -1 : seed + i,
              steps,
              cfg,
              denoise,
            });
          };

          const gen = await generate('edit', prompt, { steps, cfg, seed: seed === -1 ? -1 : seed + i, denoise }, buildWorkflow);
          if (gen) {
            setResults((prev) => new Map(prev).set(img.id, gen));
          } else {
            failed.push(img.file.name || `Image ${i + 1}`);
          }
        } catch {
          failed.push(img.file.name || `Image ${i + 1}`);
        }
      }

      setBatchProgress((p) => ({
        ...p,
        completed: allImages.length,
        currentName: '',
        failed,
      }));
      setBatchStatus('done');
      setShowBatchResults(true);
    },
    [generate, steps, cfg, seed, denoise, clearError]
  );

  const handleCancelBatch = useCallback(() => {
    batchAbortRef.current = true;
  }, []);

  const selectedImage = images.find((i) => i.id === selectedId);
  const currentResult = selectedId ? results.get(selectedId) ?? null : null;
  const completedResults = images
    .map((img) => ({ img, gen: results.get(img.id) }))
    .filter((r) => r.gen?.output_url);

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Pencil size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Image Edit</h1>
          <p className="text-sm text-white/40">Edit images using Qwen Image Edit model</p>
        </div>
      </div>

      <MultiImageUploader
        images={images}
        onAdd={handleAddImages}
        onRemove={handleRemoveImage}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <PromptBox
        onSubmit={handleGenerate}
        loading={loading}
        disabled={!selectedImage || batchStatus === 'running'}
        placeholder="Replace the background with a sunset beach scene..."
        suggestionContext="edit"
        onPromptChange={setCurrentPrompt}
      />

      {images.length > 1 && (
        <div className="flex items-center gap-3 -mt-2">
          {batchStatus !== 'running' ? (
            <button
              onClick={() => {
                if (currentPrompt.trim()) handleBatchGenerate(currentPrompt.trim());
              }}
              disabled={loading || images.length === 0 || !currentPrompt.trim()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-all disabled:opacity-40"
            >
              <Layers size={13} />
              Apply to All {images.length} Images
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <Loader2 size={12} className="animate-spin" />
                <span>
                  Processing {batchProgress.completed + 1} of {batchProgress.total}
                  {batchProgress.currentName && <span className="text-white/30 ml-1">({batchProgress.currentName})</span>}
                </span>
              </div>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
                />
              </div>
              <button
                onClick={handleCancelBatch}
                className="px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
              >
                Cancel
              </button>
            </div>
          )}
          {batchStatus === 'done' && batchProgress.failed.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={12} />
              <span>All images processed</span>
            </div>
          )}
          {batchStatus === 'done' && batchProgress.failed.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-300">
              <XCircle size={12} />
              <span>{batchProgress.failed.length} failed</span>
            </div>
          )}
        </div>
      )}

      {!selectedImage && images.length === 0 && (
        <p className="text-xs text-white/30 -mt-2">Upload one or more images above before generating</p>
      )}

      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <Settings2 size={14} />
          <span>Edit settings</span>
          {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Steps</label>
                <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={1} max={50} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">CFG</label>
                <input type="number" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} min={1} max={30} step={0.5} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Denoise</label>
                <input type="number" value={denoise} onChange={(e) => setDenoise(Number(e.target.value))} min={0} max={1} step={0.05} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Seed</label>
                <div className="flex gap-1.5">
                  <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={`${inputClass} flex-1`} />
                  <button onClick={randomizeSeed} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors">
                    <Dice5 size={14} />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-white/20">Batch mode: each image gets seed + image_index when seed is set. Use -1 for random seeds.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">{error}</div>
      )}

      <JobQueue />

      {currentResult?.output_url && selectedImage && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/60">Before / After</h2>
            <button
              onClick={() => setFullscreenSrc(currentResult.output_url)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <Maximize2 size={12} />
              Fullscreen
            </button>
          </div>
          <ImageCompare before={selectedImage.preview} after={currentResult.output_url} />
        </div>
      )}

      {completedResults.length > 1 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowBatchResults(!showBatchResults)}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <ImageIcon size={14} />
            <span>All Edited Images ({completedResults.length})</span>
            {showBatchResults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showBatchResults && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in">
              {completedResults.map(({ img, gen }) => (
                <div
                  key={img.id}
                  className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer ${
                    img.id === selectedId
                      ? 'border-amber-400/50 ring-1 ring-amber-400/20'
                      : 'border-white/5 hover:border-white/15'
                  }`}
                  onClick={() => {
                    setSelectedId(img.id);
                    if (gen?.output_url) setFullscreenSrc(gen.output_url);
                  }}
                >
                  <div className="relative">
                    <img
                      src={gen!.output_url!}
                      alt="Edited"
                      className="w-full h-28 sm:h-36 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-white/60 truncate">{img.file.name}</span>
                        <Maximize2 size={10} className="text-white/50" />
                      </div>
                    </div>
                    <div className="absolute top-1.5 left-1.5">
                      <div className="w-5 h-5 rounded overflow-hidden border border-white/20 shadow-sm">
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {fullscreenSrc && (
        <FullscreenViewer
          src={fullscreenSrc}
          alt="Edited image"
          onClose={() => setFullscreenSrc(null)}
          onDownload={() => {
            const a = document.createElement('a');
            a.href = fullscreenSrc;
            a.download = 'edited-image.png';
            a.click();
          }}
        />
      )}

      <div className="pt-4 border-t border-white/5">
        <h2 className="text-sm font-medium text-white/40 mb-3">Recent Edits</h2>
        <HistoryGallery filterType="edit" compact />
      </div>
    </div>
  );
}
