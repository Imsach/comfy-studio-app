import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play, Square, Wand2, Download, Pencil, Maximize2,
  Settings2, ChevronDown, ChevronUp, Loader2, AlertCircle,
  Monitor, LayoutGrid, Sparkles, Music, Timer, SkipForward,
  Eye, Tv, Image as ImageIcon,
} from 'lucide-react';
import FullscreenViewer from '../components/FullscreenViewer';
import GpuMonitor from '../components/GpuMonitor';
import JobQueue from '../components/JobQueue';
import AudioPlayer from '../components/AudioPlayer';
import AudioVisualizer3D from '../components/AudioVisualizer3D';
import VisualizerControls from '../components/VisualizerControls';
import AutoGenSlideshow from '../components/AutoGenSlideshow';
import { useGeneration } from '../hooks/useGeneration';
import { useAppStore } from '../store/appStore';
import { generateAutoGenPrompt, improvePrompt, generateAutoGenAudioPrompt, generateAutoGenLyrics } from '../services/aiPromptService';
import {
  loadWorkflowTemplate,
  injectTextToImageParams,
  injectAudioParams,
} from '../services/comfyClient';
import type { Generation, VisualizerSettings, AutoGenDisplaySettings, SlideshowTransition } from '../types';

type ViewMode = 'gallery' | 'theater';
type LofiMode = 'off' | 'once' | 'loop';
type VocalMode = 'instrumental' | 'with-lyrics';
type LyricsSource = 'genre' | 'image-prompt' | 'custom';

const MUSIC_GENRES = [
  'Lofi Hip Hop', 'Ambient', 'Jazz', 'Classical Piano', 'Synthwave',
  'Chillwave', 'Acoustic Folk', 'Dream Pop', 'Downtempo', 'Trip Hop',
  'Bossa Nova', 'Minimal Techno', 'Post-Rock', 'Shoegaze', 'Neo-Soul',
  'Cinematic Orchestral', 'R&B', 'Indie Rock', 'Electronic', 'Blues',
];

interface AutoGenResult {
  gen: Generation;
  prompt: string;
}

const KEY_SCALES = [
  'C major', 'C minor', 'D major', 'D minor', 'E major', 'E minor',
  'F major', 'F minor', 'G major', 'G minor', 'A major', 'A minor',
  'B major', 'B minor',
];

const LOFI_MODES: { value: LofiMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'once', label: 'Generate once' },
  { value: 'loop', label: 'Auto-regenerate' },
];

function useCountdown(running: boolean) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const targetRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const start = useCallback((seconds: number) => {
    targetRef.current = Date.now() + seconds * 1000;
    setCountdown(seconds * 1000);
  }, []);

  const stop = useCallback(() => {
    setCountdown(null);
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (countdown === null || !running) return;
    const tick = () => {
      const remaining = targetRef.current - Date.now();
      if (remaining <= 0 || !running) {
        setCountdown(null);
        return;
      }
      setCountdown(remaining);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [countdown !== null, running]);

  const formatted = countdown !== null && countdown > 0
    ? `${Math.floor(countdown / 1000)}.${String(Math.floor((countdown % 1000) / 10)).padStart(2, '0')}s`
    : null;

  return { countdown, formatted, start, stop };
}

export default function AutoGen() {
  const { generate, loading } = useGeneration();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setPage = useAppStore((s) => s.setPage);
  const setPendingEditImage = useAppStore((s) => s.setPendingEditImage);

  const viz = settings.visualizer || { mode: 'bars' as const, speed: 1, intensity: 1, particleDensity: 'medium' as const };
  const setViz = useCallback((v: VisualizerSettings) => updateSettings({ visualizer: v }), [updateSettings]);
  const display = settings.autoGenDisplay || {
    slideshowEnabled: true, slideshowInterval: 4, transition: 'crossfade' as const,
    showPromptOverlay: true, showCounterOverlay: true, showAnimatedBg: true,
    presentationMode: false, overlayPosition: 'bottom' as const, newImageHoldSeconds: 5,
  };
  const setDisplay = useCallback((d: AutoGenDisplaySettings) => updateSettings({ autoGenDisplay: d }), [updateSettings]);
  const updateDisplay = useCallback((patch: Partial<AutoGenDisplaySettings>) => setDisplay({ ...display, ...patch }), [display, setDisplay]);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AutoGenResult[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVizControls, setShowVizControls] = useState(false);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('theater');
  const [generationCount, setGenerationCount] = useState(0);
  const [improvingTheme, setImprovingTheme] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const [lofiMode, setLofiMode] = useState<LofiMode>('off');
  const [lofiResults, setLofiResults] = useState<Generation[]>([]);
  const [activeLofiIndex, setActiveLofiIndex] = useState(0);
  const [lofiStatus, setLofiStatus] = useState('');
  const [lofiGenerating, setLofiGenerating] = useState(false);
  const [lofiInterval, setLofiInterval] = useState(180);

  const [theme, setTheme] = useState(settings.autoGenTheme || '');
  const [genInterval, setGenInterval] = useState(settings.autoGenInterval || 30);
  const [width, setWidth] = useState(settings.defaultWidth);
  const [height, setHeight] = useState(settings.defaultHeight);
  const [steps, setSteps] = useState(settings.defaultSteps);
  const [cfg, setCfg] = useState(settings.defaultCfg);

  const [lofiBpm, setLofiBpm] = useState(75);
  const [lofiDuration, setLofiDuration] = useState(60);
  const [lofiKeyscale, setLofiKeyscale] = useState('E minor');
  const [lofiCfgScale, setLofiCfgScale] = useState(3.2);
  const [lofiTemperature, setLofiTemperature] = useState(0.6);

  const [vocalMode, setVocalMode] = useState<VocalMode>('instrumental');
  const [musicGenre, setMusicGenre] = useState('Lofi Hip Hop');
  const [lofiLyrics, setLofiLyrics] = useState('');
  const [lyricsSource, setLyricsSource] = useState<LyricsSource>('genre');
  const [lyricsGenerating, setLyricsGenerating] = useState(false);

  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lofiModeRef = useRef(lofiMode);
  const lofiGeneratingRef = useRef(false);
  const lastLofiTimeRef = useRef(0);
  const lofiResultsRef = useRef(lofiResults);
  const lofiIntervalRef = useRef(lofiInterval);
  const generateLofiTrackRef = useRef<(prompt: string) => Promise<void>>();
  const latestPromptRef = useRef('');

  const { formatted: countdownDisplay, start: startCountdown, stop: stopCountdown } = useCountdown(running);
  const { formatted: lofiCountdownDisplay, start: startLofiCountdown, stop: stopLofiCountdown } = useCountdown(running);

  useEffect(() => { lofiModeRef.current = lofiMode; }, [lofiMode]);
  useEffect(() => { lofiResultsRef.current = lofiResults; }, [lofiResults]);
  useEffect(() => { lofiIntervalRef.current = lofiInterval; }, [lofiInterval]);

  const isAiConfigured =
    settings.aiProvider === 'openai' ? !!settings.openaiApiKey : !!settings.ollamaModel;

  const generateLofiTrack = useCallback(async (imagePrompt: string) => {
    if (lofiGeneratingRef.current) return;
    lofiGeneratingRef.current = true;
    setLofiGenerating(true);
    setLofiStatus('Generating audio prompt...');
    try {
      let lofiTags: string;
      try {
        lofiTags = await generateAutoGenAudioPrompt(imagePrompt);
      } catch {
        lofiTags = `style: ${musicGenre.toLowerCase()}\nmood: relaxed, dreamy\ntempo: slow\ninstruments: piano, vinyl crackle, soft drums\ninspiration: ${imagePrompt.slice(0, 100)}`;
      }

      lofiTags = `genre: ${musicGenre.toLowerCase()}\n${lofiTags}`;

      let trackLyrics = '';
      if (vocalMode === 'with-lyrics') {
        if (lyricsSource === 'custom' && lofiLyrics.trim()) {
          trackLyrics = lofiLyrics;
        } else {
          setLofiStatus('Writing lyrics...');
          try {
            const ctx = lyricsSource === 'image-prompt' ? imagePrompt : musicGenre;
            trackLyrics = await generateAutoGenLyrics(ctx, lyricsSource === 'image-prompt' ? 'image-prompt' : 'genre');
          } catch {
            trackLyrics = '';
          }
        }
      }

      setLofiStatus('Creating track...');
      const buildAudioWorkflow = async () => {
        const template = await loadWorkflowTemplate('audio_ace_step_1_5_split_4b.json');
        return injectAudioParams(template, {
          tags: lofiTags,
          lyrics: trackLyrics,
          seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
          bpm: lofiBpm,
          duration: lofiDuration,
          timesignature: '4',
          language: 'en',
          keyscale: lofiKeyscale,
          cfgScale: lofiCfgScale,
          temperature: lofiTemperature,
          steps: 8,
        });
      };
      const gen = await generate('audio', lofiTags, { duration: lofiDuration, bpm: lofiBpm, genre: musicGenre, vocalMode }, buildAudioWorkflow);
      if (gen?.output_url) {
        setLofiResults((prev) => [gen, ...prev]);
        setActiveLofiIndex(0);
        lastLofiTimeRef.current = Date.now();
      }
      setLofiStatus('');
    } catch {
      setLofiStatus('');
    } finally {
      lofiGeneratingRef.current = false;
      setLofiGenerating(false);
    }
  }, [generate, lofiBpm, lofiDuration, lofiKeyscale, lofiCfgScale, lofiTemperature, vocalMode, musicGenre, lyricsSource, lofiLyrics]);

  useEffect(() => { generateLofiTrackRef.current = generateLofiTrack; }, [generateLofiTrack]);

  useEffect(() => {
    if (!running || lofiModeRef.current !== 'loop') return;
    const interval = setInterval(() => {
      if (!runningRef.current || lofiModeRef.current !== 'loop') return;
      if (lofiGeneratingRef.current) return;
      const elapsed = (Date.now() - lastLofiTimeRef.current) / 1000;
      if (elapsed >= lofiIntervalRef.current) {
        const prompt = latestPromptRef.current || 'lofi ambient';
        generateLofiTrackRef.current?.(prompt);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running || lofiModeRef.current !== 'loop' || lofiGenerating) return;
    if (lastLofiTimeRef.current === 0) return;
    const elapsed = (Date.now() - lastLofiTimeRef.current) / 1000;
    const remaining = Math.max(0, lofiInterval - elapsed);
    if (remaining > 0) {
      startLofiCountdown(remaining);
    }
    return () => stopLofiCountdown();
  }, [running, lofiInterval, lofiGenerating, startLofiCountdown, stopLofiCountdown, lofiResults]);

  const startLoop = useCallback(async () => {
    runningRef.current = true;
    setRunning(true);
    setError('');
    let lofiInitialTriggered = false;

    while (runningRef.current) {
      try {
        setStatusText('Generating prompt with AI...');
        abortRef.current = new AbortController();

        const prompt = await generateAutoGenPrompt(
          theme || 'creative, diverse, artistic',
          abortRef.current.signal,
          settings.autoGenContentMode,
          settings.autoGenCategories
        );
        setCurrentPrompt(prompt);
        latestPromptRef.current = prompt;
        setStatusText('Creating image...');

        const genParams = { steps, cfg, width, height };
        const buildWorkflow = async () => {
          const template = await loadWorkflowTemplate('image_z_image.json');
          return injectTextToImageParams(template, {
            prompt,
            seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            ...genParams,
          });
        };

        const gen = await generate('image', prompt, genParams, buildWorkflow);

        if (gen?.output_url) {
          setResults((prev) => [{ gen, prompt }, ...prev]);
          setGenerationCount((c) => c + 1);

          const currentMode = lofiModeRef.current;
          if (currentMode !== 'off' && !lofiGeneratingRef.current) {
            if (!lofiInitialTriggered) {
              generateLofiTrackRef.current?.(prompt);
              lofiInitialTriggered = true;
              lastLofiTimeRef.current = Date.now();
            } else if (currentMode === 'loop') {
              const elapsed = (Date.now() - lastLofiTimeRef.current) / 1000;
              if (elapsed >= lofiIntervalRef.current) {
                generateLofiTrackRef.current?.(prompt);
              }
            }
          }
        }

        setStatusText('');
        setError('');
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') break;
        setError((err as Error).message || 'Generation failed');
        setStatusText('');
      }

      if (runningRef.current) {
        startCountdown(genInterval);
        setStatusText('waiting');
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, genInterval * 1000);
          const check = setInterval(() => {
            if (!runningRef.current) {
              clearTimeout(timeout);
              clearInterval(check);
              resolve();
            }
          }, 200);
        });
        stopCountdown();
        setStatusText('');
      }
    }

    setRunning(false);
    setStatusText('');
    stopCountdown();
    stopLofiCountdown();
  }, [theme, genInterval, steps, cfg, width, height, generate, startCountdown, stopCountdown, stopLofiCountdown]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    abortRef.current?.abort();
    setRunning(false);
    setStatusText('');
    stopCountdown();
    stopLofiCountdown();
  }, [stopCountdown, stopLofiCountdown]);

  const handleEdit = useCallback(
    (imageUrl: string) => {
      setPendingEditImage(imageUrl);
      setPage('image-edit');
    },
    [setPendingEditImage, setPage]
  );

  const handleDownload = useCallback((url: string, prompt: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `autogen-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    a.click();
  }, []);

  const handleImproveTheme = useCallback(async () => {
    if (!theme.trim() || improvingTheme) return;
    setImprovingTheme(true);
    try {
      const improved = await improvePrompt(theme);
      setTheme(improved);
    } catch {
      // silently fail
    } finally {
      setImprovingTheme(false);
    }
  }, [theme, improvingTheme]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const activeLofi = lofiResults[activeLofiIndex] ?? null;
  const latestResult = results[0];
  const previousResults = results.slice(1);
  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/40';

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {(audioPlaying || lofiResults.length > 0) && (
        <div className="fixed inset-0 z-0">
          <AudioVisualizer3D
            key={viz.mode}
            isPlaying={audioPlaying}
            colorScheme="sky"
            mode={viz.mode}
            speed={viz.speed}
            intensity={viz.intensity}
            particleDensity={viz.particleDensity}
          />
        </div>
      )}

      <div className="relative z-10 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-sky-500/10 flex-shrink-0">
            <Wand2 size={20} className="text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-white">Auto Generate</h1>
            <p className="text-xs sm:text-sm text-white/40 truncate">Continuously create images with AI-generated prompts</p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode('theater')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'theater' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
              title="Theater mode"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'gallery' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
              title="Gallery mode"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {!isAiConfigured && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs sm:text-sm text-amber-300">
            Configure an AI provider (Ollama or OpenAI) in Settings to use auto-generation.
          </div>
        )}

        <div className="relative">
          <label className="text-xs text-white/40 mb-1 block">Theme / Style Direction</label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            rows={2}
            placeholder="cyberpunk cities, nature landscapes, abstract art, surrealist paintings..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-3 pr-12 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            disabled={running}
          />
          {isAiConfigured && theme.trim() && !running && (
            <button
              onClick={handleImproveTheme}
              disabled={improvingTheme}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-amber-400 transition-all disabled:opacity-40"
              title="Improve theme with AI"
            >
              {improvingTheme ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {!running ? (
            <button
              onClick={startLoop}
              disabled={!isAiConfigured || loading}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-medium text-sm disabled:opacity-40 hover:from-sky-400 hover:to-cyan-400 transition-all duration-200 shadow-lg shadow-sky-500/20"
            >
              <Play size={16} />
              Start
            </button>
          ) : (
            <button
              onClick={stopLoop}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium text-sm hover:from-red-400 hover:to-rose-400 transition-all duration-200 shadow-lg shadow-red-500/20"
            >
              <Square size={16} />
              Stop
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <Settings2 size={14} />
            <span className="hidden sm:inline">Settings</span>
            {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {statusText && statusText !== 'waiting' && (
            <div className="flex items-center gap-2 text-xs text-sky-400/70">
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden sm:inline">{statusText}</span>
            </div>
          )}

          {countdownDisplay && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Timer size={12} className="text-sky-400/60" />
              <span className="text-sky-400/80 tabular-nums">{countdownDisplay}</span>
            </div>
          )}

          {results.length > 0 && (
            <span className="ml-auto text-xs text-white/30">{generationCount} generated</span>
          )}
        </div>

        {showSettings && (
          <div className="p-3 sm:p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Interval (sec)</label>
                <input type="number" value={genInterval} onChange={(e) => setGenInterval(Number(e.target.value))} min={5} max={600} className={inputClass} disabled={running} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Width</label>
                <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={256} max={2048} step={64} className={inputClass} disabled={running} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Height</label>
                <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={256} max={2048} step={64} className={inputClass} disabled={running} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Steps</label>
                <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={1} max={150} className={inputClass} disabled={running} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">CFG</label>
                <input type="number" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} min={1} max={30} step={0.5} className={inputClass} disabled={running} />
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Music size={14} className="text-emerald-400" />
                <span className="text-xs text-white/60 font-medium">Background Music</span>
              </div>
              <div className="flex gap-1.5 p-0.5 bg-white/[0.03] rounded-lg w-fit">
                {LOFI_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setLofiMode(m.value)}
                    disabled={running}
                    className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                      lofiMode === m.value
                        ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                        : 'text-white/30 hover:text-white/50'
                    } disabled:opacity-60`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {lofiMode !== 'off' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Genre</label>
                      <select
                        value={musicGenre}
                        onChange={(e) => setMusicGenre(e.target.value)}
                        className={inputClass}
                        disabled={running}
                      >
                        {MUSIC_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Vocal Mode</label>
                      <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg">
                        <button
                          onClick={() => setVocalMode('instrumental')}
                          disabled={running}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
                            vocalMode === 'instrumental'
                              ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                              : 'text-white/30 hover:text-white/50'
                          } disabled:opacity-60`}
                        >
                          Instrumental
                        </button>
                        <button
                          onClick={() => setVocalMode('with-lyrics')}
                          disabled={running}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
                            vocalMode === 'with-lyrics'
                              ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                              : 'text-white/30 hover:text-white/50'
                          } disabled:opacity-60`}
                        >
                          With Lyrics
                        </button>
                      </div>
                    </div>
                  </div>

                  {vocalMode === 'with-lyrics' && (
                    <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg animate-fade-in">
                      <label className="text-xs text-white/30 block">Lyrics Source</label>
                      <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg w-fit">
                        {([
                          { value: 'genre' as const, label: 'Auto from Genre' },
                          { value: 'image-prompt' as const, label: 'Auto from Image' },
                          { value: 'custom' as const, label: 'Custom' },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setLyricsSource(opt.value)}
                            disabled={running}
                            className={`px-2.5 py-1.5 text-xs rounded-md transition-all ${
                              lyricsSource === opt.value
                                ? 'bg-amber-500/20 text-amber-300 font-medium'
                                : 'text-white/30 hover:text-white/50'
                            } disabled:opacity-60`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/20">
                        {lyricsSource === 'genre' && 'AI will write lyrics matching the selected genre before each track.'}
                        {lyricsSource === 'image-prompt' && 'AI will write lyrics inspired by the current image prompt.'}
                        {lyricsSource === 'custom' && 'Use your own lyrics for every generated track.'}
                      </p>
                      {lyricsSource === 'custom' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-white/30">Lyrics</label>
                            {isAiConfigured && (
                              <button
                                onClick={async () => {
                                  setLyricsGenerating(true);
                                  try {
                                    const result = await generateAutoGenLyrics(musicGenre, 'genre');
                                    setLofiLyrics(result);
                                  } catch { /* silently fail */ }
                                  finally { setLyricsGenerating(false); }
                                }}
                                disabled={lyricsGenerating || running}
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/10 text-amber-400/70 hover:text-amber-400 transition-all disabled:opacity-40"
                              >
                                {lyricsGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                Generate
                              </button>
                            )}
                          </div>
                          <textarea
                            value={lofiLyrics}
                            onChange={(e) => setLofiLyrics(e.target.value)}
                            rows={4}
                            placeholder="[Verse 1]&#10;Your lyrics here...&#10;&#10;[Chorus]&#10;..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/15 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            disabled={running}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {lofiMode === 'loop' && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-white/30">Regenerate every</label>
                      <input
                        type="number"
                        value={lofiInterval}
                        onChange={(e) => setLofiInterval(Number(e.target.value))}
                        min={30}
                        max={1800}
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        disabled={running}
                      />
                      <span className="text-xs text-white/30">seconds</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAudioSettings(!showAudioSettings)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400/60 hover:text-emerald-400 transition-colors"
                  >
                    <Settings2 size={10} />
                    <span>Advanced audio</span>
                    {showAudioSettings ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {showAudioSettings && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 p-3 bg-white/[0.03] rounded-lg animate-fade-in">
                      <div>
                        <label className="text-xs text-white/30 mb-1 block">BPM</label>
                        <input type="number" value={lofiBpm} onChange={(e) => setLofiBpm(Number(e.target.value))} min={40} max={200} className={inputClass} disabled={running} />
                      </div>
                      <div>
                        <label className="text-xs text-white/30 mb-1 block">Duration (sec)</label>
                        <input type="number" value={lofiDuration} onChange={(e) => setLofiDuration(Number(e.target.value))} min={10} max={300} className={inputClass} disabled={running} />
                      </div>
                      <div>
                        <label className="text-xs text-white/30 mb-1 block">Key / Scale</label>
                        <select value={lofiKeyscale} onChange={(e) => setLofiKeyscale(e.target.value)} className={inputClass} disabled={running}>
                          {KEY_SCALES.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/30 mb-1 block">CFG Scale</label>
                        <input type="number" value={lofiCfgScale} onChange={(e) => setLofiCfgScale(Number(e.target.value))} min={1} max={10} step={0.1} className={inputClass} disabled={running} />
                      </div>
                      <div>
                        <label className="text-xs text-white/30 mb-1 block">Temperature</label>
                        <input type="number" value={lofiTemperature} onChange={(e) => setLofiTemperature(Number(e.target.value))} min={0} max={2} step={0.1} className={inputClass} disabled={running} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5 space-y-3">
              <button
                type="button"
                onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                className="flex items-center gap-2 text-xs text-white/60 font-medium hover:text-white/80 transition-colors"
              >
                <Tv size={14} className="text-sky-400" />
                <span>Display / Streaming</span>
                {showDisplaySettings ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>

              {showDisplaySettings && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Presentation Mode</label>
                    <button
                      onClick={() => updateDisplay({ presentationMode: !display.presentationMode })}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        display.presentationMode ? 'bg-sky-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
                    </button>
                  </div>
                  <p className="text-[10px] text-white/20 -mt-1">Maximize display area, hide controls -- ideal for streaming and TikTok Live</p>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Slideshow During Wait</label>
                    <button
                      onClick={() => updateDisplay({ slideshowEnabled: !display.slideshowEnabled })}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        display.slideshowEnabled ? 'bg-sky-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Animated Generating Effect</label>
                    <button
                      onClick={() => updateDisplay({ showAnimatedBg: !display.showAnimatedBg })}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        display.showAnimatedBg ? 'bg-sky-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Show Prompt Overlay</label>
                    <button
                      onClick={() => updateDisplay({ showPromptOverlay: !display.showPromptOverlay })}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        display.showPromptOverlay ? 'bg-sky-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Show Generation Counter</label>
                    <button
                      onClick={() => updateDisplay({ showCounterOverlay: !display.showCounterOverlay })}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        display.showCounterOverlay ? 'bg-sky-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Transition</label>
                      <select
                        value={display.transition}
                        onChange={(e) => updateDisplay({ transition: e.target.value as SlideshowTransition })}
                        className={inputClass}
                      >
                        <option value="crossfade">Crossfade</option>
                        <option value="slide">Slide</option>
                        <option value="zoom">Zoom</option>
                        <option value="kenburns">Ken Burns</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Overlay Position</label>
                      <select
                        value={display.overlayPosition}
                        onChange={(e) => updateDisplay({ overlayPosition: e.target.value as 'top' | 'bottom' })}
                        className={inputClass}
                      >
                        <option value="bottom">Bottom</option>
                        <option value="top">Top</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Slide Duration (s)</label>
                      <input type="number" value={display.slideshowInterval} onChange={(e) => updateDisplay({ slideshowInterval: Number(e.target.value) })} min={1} max={30} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">New Image Hold (s)</label>
                      <input type="number" value={display.newImageHoldSeconds} onChange={(e) => updateDisplay({ newImageHoldSeconds: Number(e.target.value) })} min={1} max={30} className={inputClass} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs sm:text-sm text-red-300">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span className="min-w-0 truncate">{error}</span>
          </div>
        )}

        {viewMode === 'theater' ? (
          <TheaterView
            latestResult={latestResult}
            previousResults={previousResults}
            currentPrompt={currentPrompt}
            statusText={statusText}
            running={running}
            generationCount={generationCount}
            countdownDisplay={countdownDisplay}
            display={display}
            onFullscreen={setFullscreenSrc}
            onDownload={handleDownload}
            onEdit={handleEdit}
          />
        ) : (
          <GalleryView
            latestResult={latestResult}
            previousResults={previousResults}
            currentPrompt={currentPrompt}
            running={running}
            onFullscreen={setFullscreenSrc}
            onDownload={handleDownload}
            onEdit={handleEdit}
          />
        )}

        {(lofiMode !== 'off' && (lofiResults.length > 0 || lofiStatus)) && (
          <div className="space-y-3 p-3 sm:p-4 bg-white/[0.03] border border-white/5 rounded-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Music size={14} className="text-emerald-400" />
              <h3 className="text-xs text-white/40 uppercase tracking-wider">Lofi Background</h3>
              {lofiGenerating && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400/60">
                  <Loader2 size={10} className="animate-spin" />
                  <span>{lofiStatus}</span>
                </div>
              )}
              {lofiMode === 'loop' && lofiCountdownDisplay && !lofiGenerating && (
                <div className="flex items-center gap-1.5 text-xs font-mono ml-auto">
                  <SkipForward size={10} className="text-emerald-400/50" />
                  <span className="text-emerald-400/70 tabular-nums">next: {lofiCountdownDisplay}</span>
                </div>
              )}
              {lofiResults.length > 1 && (
                <span className="text-[10px] text-white/20 ml-auto">{lofiResults.length} tracks</span>
              )}
            </div>

            {activeLofi?.output_url && (
              <AudioPlayer
                src={activeLofi.output_url}
                title={`Track ${lofiResults.length - activeLofiIndex}`}
                autoPlay
                onPlayStateChange={setAudioPlaying}
                onDownload={() => {
                  const a = document.createElement('a');
                  a.href = activeLofi.output_url!;
                  a.download = `lofi-track-${lofiResults.length - activeLofiIndex}.mp3`;
                  a.click();
                }}
              />
            )}

            {lofiResults.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {lofiResults.map((lr, i) => (
                  <button
                    key={lr.id}
                    onClick={() => setActiveLofiIndex(i)}
                    className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      activeLofiIndex === i
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-white/30 hover:text-white/50 border border-white/5 hover:border-white/10'
                    }`}
                  >
                    Track {lofiResults.length - i}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={() => setShowVizControls(!showVizControls)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <Eye size={12} />
            <span>Visualizer settings</span>
            {showVizControls ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {showVizControls && <VisualizerControls settings={viz} onChange={setViz} />}
        </div>

        <GpuMonitor />
        <JobQueue />

        {fullscreenSrc && (
          <FullscreenViewer
            src={fullscreenSrc}
            onClose={() => setFullscreenSrc(null)}
            onDownload={() => {
              const a = document.createElement('a');
              a.href = fullscreenSrc;
              a.download = 'autogen-image.png';
              a.click();
            }}
            onEdit={() => {
              handleEdit(fullscreenSrc);
              setFullscreenSrc(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

interface TheaterViewProps {
  latestResult?: AutoGenResult;
  previousResults: AutoGenResult[];
  currentPrompt: string;
  statusText: string;
  running: boolean;
  generationCount: number;
  countdownDisplay: string | null;
  display: AutoGenDisplaySettings;
  onFullscreen: (src: string) => void;
  onDownload: (url: string, prompt: string) => void;
  onEdit: (url: string) => void;
}

function TheaterView({
  latestResult,
  previousResults,
  currentPrompt,
  statusText,
  running,
  generationCount,
  countdownDisplay,
  display,
  onFullscreen,
  onDownload,
  onEdit,
}: TheaterViewProps) {
  const allResults = latestResult ? [latestResult, ...previousResults] : previousResults;
  const slideshowImages = allResults
    .filter((r) => r.gen.output_url)
    .map((r) => ({ url: r.gen.output_url!, prompt: r.prompt }));

  const isWaiting = statusText === 'waiting';
  const isGenerating = running && statusText !== '' && statusText !== 'waiting';
  const useSlideshow = display.slideshowEnabled && slideshowImages.length > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {running && !display.presentationMode && (
        <div className="flex items-center gap-2 sm:gap-4 p-2.5 sm:p-3 bg-white/[0.02] border border-white/5 rounded-xl overflow-x-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs text-white/50 font-medium">LIVE</span>
          </div>
          <div className="h-3 w-px bg-white/10 flex-shrink-0" />
          <span className="text-xs text-white/30 flex-shrink-0">{generationCount} completed</span>
          {statusText && statusText !== 'waiting' && (
            <>
              <div className="h-3 w-px bg-white/10 flex-shrink-0" />
              <span className="text-xs text-sky-400/60 truncate">{statusText}</span>
            </>
          )}
          {countdownDisplay && (
            <>
              <div className="h-3 w-px bg-white/10 flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Timer size={10} className="text-sky-400/50" />
                <span className="text-xs font-mono text-sky-400/70 tabular-nums">{countdownDisplay}</span>
              </div>
            </>
          )}
        </div>
      )}

      {currentPrompt && running && !display.presentationMode && (
        <div className="p-2.5 sm:p-3 bg-sky-500/5 border border-sky-500/10 rounded-xl">
          <p className="text-[10px] text-sky-400/60 uppercase tracking-wider mb-1">Current Prompt</p>
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{currentPrompt}</p>
        </div>
      )}

      {useSlideshow ? (
        <AutoGenSlideshow
          images={slideshowImages}
          isWaiting={isWaiting}
          isGenerating={isGenerating}
          newImageUrl={latestResult?.gen.output_url ?? null}
          transition={display.transition}
          intervalSeconds={display.slideshowInterval}
          showPrompt={display.showPromptOverlay}
          showCounter={display.showCounterOverlay}
          showAnimatedBg={display.showAnimatedBg}
          overlayPosition={display.overlayPosition}
          presentationMode={display.presentationMode}
          generationCount={generationCount}
          newImageHoldSeconds={display.newImageHoldSeconds}
          onFullscreen={onFullscreen}
          onDownload={onDownload}
          onEdit={onEdit}
        />
      ) : (
        <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 min-h-[250px] sm:min-h-[400px] flex items-center justify-center">
          {latestResult?.gen.output_url ? (
            <>
              <img
                src={latestResult.gen.output_url}
                alt={latestResult.prompt}
                className="w-full max-h-[400px] sm:max-h-[600px] object-contain cursor-pointer transition-transform duration-300"
                onClick={() => onFullscreen(latestResult.gen.output_url!)}
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <p className="text-[10px] sm:text-xs text-white/70 leading-relaxed line-clamp-2">{latestResult.prompt}</p>
              </div>
              <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={() => onFullscreen(latestResult.gen.output_url!)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white border border-white/10 transition-all" title="Fullscreen">
                  <Maximize2 size={14} />
                </button>
                <button onClick={() => onDownload(latestResult.gen.output_url!, latestResult.prompt)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-cyan-400 border border-white/10 transition-all" title="Download">
                  <Download size={14} />
                </button>
                <button onClick={() => onEdit(latestResult.gen.output_url!)} className="p-1.5 sm:p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-amber-400 border border-white/10 transition-all" title="Edit">
                  <Pencil size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 sm:py-16">
              <Wand2 size={28} className="text-white/10 mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-white/20">
                {running ? 'Generating first image...' : 'Press Start to begin auto generation'}
              </p>
            </div>
          )}
        </div>
      )}

      {!display.presentationMode && previousResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-white/30 uppercase tracking-wider">Previous Generations</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
            {previousResults.map((r) =>
              r.gen.output_url && (
                <div
                  key={r.gen.id}
                  className="group/thumb relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => onFullscreen(r.gen.output_url!)}
                >
                  <img src={r.gen.output_url} alt={r.prompt} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDownload(r.gen.output_url!, r.prompt); }}
                      className="p-1 rounded bg-black/60 text-white/60 hover:text-cyan-400"
                    >
                      <Download size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(r.gen.output_url!); }}
                      className="p-1 rounded bg-black/60 text-white/60 hover:text-amber-400"
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface GalleryViewProps {
  latestResult?: AutoGenResult;
  previousResults: AutoGenResult[];
  currentPrompt: string;
  running: boolean;
  onFullscreen: (src: string) => void;
  onDownload: (url: string, prompt: string) => void;
  onEdit: (url: string) => void;
}

function GalleryView({
  latestResult,
  previousResults,
  currentPrompt,
  running,
  onFullscreen,
  onDownload,
  onEdit,
}: GalleryViewProps) {
  const allResults = latestResult ? [latestResult, ...previousResults] : previousResults;

  return (
    <div className="space-y-3 sm:space-y-4">
      {currentPrompt && running && (
        <div className="p-2.5 sm:p-3 bg-sky-500/5 border border-sky-500/10 rounded-xl">
          <p className="text-[10px] text-sky-400/60 uppercase tracking-wider mb-1">Current Prompt</p>
          <p className="text-xs sm:text-sm text-white/60">{currentPrompt}</p>
        </div>
      )}

      {allResults.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <Wand2 size={28} className="text-white/10 mx-auto mb-3" />
          <p className="text-xs sm:text-sm text-white/20">
            {running ? 'Generating first image...' : 'Press Start to begin auto generation'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {allResults.map(
            (r) =>
              r.gen.output_url && (
                <div
                  key={r.gen.id}
                  className="group relative rounded-xl overflow-hidden border border-white/5 hover:border-white/15 transition-all cursor-pointer"
                  onClick={() => onFullscreen(r.gen.output_url!)}
                >
                  <img src={r.gen.output_url} alt={r.prompt} className="w-full h-28 sm:h-36 object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] text-white/70 line-clamp-2">{r.prompt}</p>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onDownload(r.gen.output_url!, r.prompt); }} className="p-1.5 rounded-md bg-black/60 text-white/60 hover:text-cyan-400 border border-white/10 transition-all">
                        <Download size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onEdit(r.gen.output_url!); }} className="p-1.5 rounded-md bg-black/60 text-white/60 hover:text-amber-400 border border-white/10 transition-all">
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
