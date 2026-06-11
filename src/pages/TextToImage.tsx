import { useState, useCallback } from 'react';
import { Image, Settings2, Dice5, ChevronDown, ChevronUp } from 'lucide-react';
import PromptBox from '../components/PromptBox';
import JobQueue from '../components/JobQueue';
import HistoryGallery from '../components/HistoryGallery';
import { useGeneration } from '../hooks/useGeneration';
import { useAppStore } from '../store/appStore';
import {
  loadWorkflowTemplate,
  injectTextToImageParams,
} from '../services/comfyClient';
import type { Generation } from '../types';

export default function TextToImage() {
  const { generate, loading, error, clearError } = useGeneration();
  const settings = useAppStore((s) => s.settings);
  const [result, setResult] = useState<Generation | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(settings.defaultSteps);
  const [cfg, setCfg] = useState(settings.defaultCfg);
  const [seed, setSeed] = useState(-1);
  const [width, setWidth] = useState(settings.defaultWidth);
  const [height, setHeight] = useState(settings.defaultHeight);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  const handleGenerate = useCallback(
    async (prompt: string) => {
      clearError();
      const buildWorkflow = async () => {
        const template = await loadWorkflowTemplate('image_z_image.json');
        return injectTextToImageParams(template, {
          prompt,
          negativePrompt,
          seed,
          steps,
          cfg,
          width,
          height,
        });
      };
      const gen = await generate('image', prompt, { steps, cfg, seed, width, height, negativePrompt }, buildWorkflow);
      if (gen) setResult(gen);
    },
    [generate, negativePrompt, steps, cfg, seed, width, height, clearError]
  );

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <Image size={20} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Text to Image</h1>
          <p className="text-sm text-white/40">Generate images using Z-Image Turbo model</p>
        </div>
      </div>

      <PromptBox
        onSubmit={handleGenerate}
        loading={loading}
        placeholder="A cyberpunk cityscape at dawn, neon lights reflecting on wet streets..."
        showRandomSeed
        onRandomSeed={randomizeSeed}
        suggestionContext="image"
      />

      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <Settings2 size={14} />
          <span>Generation settings</span>
          {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Negative Prompt</label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                placeholder="blurry, low quality, distorted..."
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Steps</label>
                <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={1} max={150} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">CFG</label>
                <input type="number" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} min={1} max={30} step={0.5} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Width</label>
                <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={256} max={2048} step={64} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Height</label>
                <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={256} max={2048} step={64} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Seed</label>
              <div className="flex gap-2">
                <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={`${inputClass} flex-1`} />
                <button onClick={randomizeSeed} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white/80 transition-colors" title="Random">
                  <Dice5 size={16} />
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1">Use -1 for random seed each time</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">{error}</div>
      )}

      <JobQueue />

      {result?.output_url && (
        <div className="space-y-3 animate-fade-in">
          <h2 className="text-sm font-medium text-white/60">Result</h2>
          <div className="relative group rounded-xl overflow-hidden border border-white/10">
            <img
              src={result.output_url}
              alt={result.prompt}
              className="w-full max-h-[512px] object-contain bg-black/30"
            />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white/70 truncate">{result.prompt}</p>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-white/5">
        <h2 className="text-sm font-medium text-white/40 mb-3">Recent Images</h2>
        <HistoryGallery filterType="image" compact />
      </div>
    </div>
  );
}
