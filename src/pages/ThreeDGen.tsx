import { useState, useCallback, useEffect } from 'react';
import { Box, Settings2, ChevronDown, ChevronUp, Dice5, Download } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import ThreeViewer from '../components/ThreeViewer';
import JobQueue from '../components/JobQueue';
import { useGeneration } from '../hooks/useGeneration';
import { getGenerations } from '../services/generationService';
import {
  loadWorkflowTemplate,
  inject3DParams,
  uploadImage,
} from '../services/comfyClient';
import type { Generation } from '../types';

export default function ThreeDGen() {
  const { generate, loading, error, clearError } = useGeneration();
  const [result, setResult] = useState<Generation | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(5);
  const [seed, setSeed] = useState(-1);
  const [resolution, setResolution] = useState(4096);
  const [previousModels, setPreviousModels] = useState<Generation[]>([]);
  const [activeModelUrl, setActiveModelUrl] = useState<string | undefined>();

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  const loadPreviousModels = useCallback(async () => {
    try {
      const gens = await getGenerations('3d');
      setPreviousModels(gens.filter((g) => g.status === 'completed' && g.output_url));
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadPreviousModels();
  }, [loadPreviousModels]);

  const handleImageUpload = useCallback((file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleClearImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }, [imagePreview]);

  const handleGenerate = useCallback(async () => {
    if (!imageFile) return;
    clearError();

    const buildWorkflow = async () => {
      const uploaded = await uploadImage(imageFile);
      const template = await loadWorkflowTemplate('3d_hunyuan3d-v2.1.json');
      return inject3DParams(template, {
        imageName: uploaded.name,
        seed,
        steps,
        cfg,
        resolution,
      });
    };

    const gen = await generate('3d', imageFile.name, { steps, cfg, seed, resolution }, buildWorkflow);
    if (gen) {
      setResult(gen);
      setActiveModelUrl(gen.output_url ?? undefined);
      loadPreviousModels();
    }
  }, [generate, imageFile, steps, cfg, seed, resolution, clearError, loadPreviousModels]);

  const handleSelectModel = useCallback((gen: Generation) => {
    setResult(gen);
    setActiveModelUrl(gen.output_url ?? undefined);
  }, []);

  const displayUrl = activeModelUrl ?? result?.output_url ?? undefined;

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500/40';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-rose-500/10">
          <Box size={20} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">3D Generation</h1>
          <p className="text-sm text-white/40">Generate 3D meshes using Hunyuan3D v2.1</p>
        </div>
      </div>

      <ImageUploader onUpload={handleImageUpload} preview={imagePreview} onClear={handleClearImage} />

      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!imageFile || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:from-rose-400 hover:to-pink-400 transition-all duration-200 shadow-lg shadow-rose-500/20"
        >
          <Box size={16} />
          {loading ? 'Generating...' : 'Generate 3D'}
        </button>
        {!imageFile && (
          <p className="text-xs text-white/30">Upload a reference image first</p>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <Settings2 size={14} />
          <span>3D settings</span>
          {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Steps</label>
                <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={1} max={100} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">CFG</label>
                <input type="number" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} min={1} max={30} step={0.5} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Resolution</label>
                <select value={resolution} onChange={(e) => setResolution(Number(e.target.value))} className={inputClass}>
                  <option value={2048}>2048 (Fast)</option>
                  <option value={4096}>4096 (Standard)</option>
                  <option value={8192}>8192 (High)</option>
                </select>
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
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">{error}</div>
      )}

      <JobQueue />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-white/60">3D Viewer</h2>
        <ThreeViewer
          modelUrl={displayUrl}
          onDownload={
            displayUrl
              ? () => {
                  const a = document.createElement('a');
                  a.href = displayUrl;
                  a.download = 'model.glb';
                  a.click();
                }
              : undefined
          }
        />
      </div>

      {previousModels.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h2 className="text-sm font-medium text-white/40">Previous 3D Models</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {previousModels.map((gen) => {
              const isActive = activeModelUrl === gen.output_url;
              return (
                <button
                  key={gen.id}
                  onClick={() => handleSelectModel(gen)}
                  className={`group relative bg-white/5 border rounded-xl overflow-hidden text-left transition-all duration-200 ${
                    isActive
                      ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="h-24 flex items-center justify-center bg-gradient-to-br from-rose-500/5 to-pink-500/5">
                    <Box size={28} className={`${isActive ? 'text-rose-400' : 'text-rose-400/30'} transition-colors`} />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-white/60 truncate">{gen.prompt || 'Untitled'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-white/20">
                        {new Date(gen.created_at).toLocaleDateString()}
                      </p>
                      {gen.output_url && (
                        <a
                          href={gen.output_url}
                          download="model.glb"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-white/20 hover:text-cyan-400 transition-colors"
                        >
                          <Download size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-medium">Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
