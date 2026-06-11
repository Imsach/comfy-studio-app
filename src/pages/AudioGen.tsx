import { useState, useCallback, useRef, useEffect } from 'react';
import { Music, Settings2, ChevronDown, ChevronUp, Dice5, Lightbulb, Loader2, AlertCircle, Clock, Play, Eye } from 'lucide-react';
import PromptBox from '../components/PromptBox';
import AudioPlayer from '../components/AudioPlayer';
import AudioVisualizer3D from '../components/AudioVisualizer3D';
import VisualizerControls from '../components/VisualizerControls';
import JobQueue from '../components/JobQueue';
import HistoryGallery from '../components/HistoryGallery';
import { useGeneration } from '../hooks/useGeneration';
import {
  loadWorkflowTemplate,
  injectAudioParams,
} from '../services/comfyClient';
import { generateLyrics } from '../services/aiPromptService';
import { useAppStore } from '../store/appStore';
import { getGenerations } from '../services/generationService';
import type { Generation, VisualizerSettings } from '../types';

const KEY_SCALES = [
  'C major', 'C minor', 'D major', 'D minor', 'E major', 'E minor',
  'F major', 'F minor', 'G major', 'G minor', 'A major', 'A minor',
  'B major', 'B minor',
];

const TIME_SIGNATURES = ['4', '3', '6'];

export default function AudioGen() {
  const { generate, loading, error, clearError } = useGeneration();
  const [results, setResults] = useState<Generation[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const lyricsAbortRef = useRef<AbortController | null>(null);
  const [stylePrompt, setStylePrompt] = useState('');
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const viz = settings.visualizer || { mode: 'bars' as const, speed: 1, intensity: 1, particleDensity: 'medium' as const };
  const setViz = useCallback((v: VisualizerSettings) => updateSettings({ visualizer: v }), [updateSettings]);
  const [showVizControls, setShowVizControls] = useState(false);
  const isAiConfigured = settings.aiProvider === 'openai' ? !!settings.openaiApiKey : !!settings.ollamaModel;
  const [duration, setDuration] = useState(60);
  const [bpm, setBpm] = useState(120);
  const [seed, setSeed] = useState(-1);
  const [keyscale, setKeyscale] = useState('E minor');
  const [timesignature, setTimesignature] = useState('4');
  const [language, setLanguage] = useState('en');
  const [cfgScale, setCfgScale] = useState(3.2);
  const [temperature, setTemperature] = useState(0.6);
  const [steps, setSteps] = useState(8);

  useEffect(() => {
    (async () => {
      try {
        const history = await getGenerations('audio');
        const completed = history.filter((g) => g.status === 'completed' && g.output_url);
        if (completed.length > 0) {
          setResults(completed.slice(0, 20));
        }
      } catch {
        // silently fail
      }
    })();
  }, []);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  const handleGenerateLyrics = useCallback(async () => {
    lyricsAbortRef.current?.abort();
    const controller = new AbortController();
    lyricsAbortRef.current = controller;
    setLyricsLoading(true);
    setLyricsError('');
    try {
      const result = await generateLyrics(stylePrompt, controller.signal);
      setLyrics(result);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setLyricsError((err as Error).message || 'Failed to generate lyrics');
      }
    } finally {
      setLyricsLoading(false);
    }
  }, [stylePrompt]);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      clearError();

      const buildWorkflow = async () => {
        const template = await loadWorkflowTemplate('audio_ace_step_1_5_split_4b.json');
        return injectAudioParams(template, {
          tags: prompt,
          lyrics,
          seed,
          bpm,
          duration,
          timesignature,
          language,
          keyscale,
          cfgScale,
          temperature,
          steps,
        });
      };

      const gen = await generate(
        'audio',
        prompt,
        { lyrics, duration, bpm, seed, keyscale, timesignature, language, cfgScale, temperature, steps },
        buildWorkflow
      );
      if (gen) {
        setResults((prev) => [gen, ...prev]);
        setActiveResultIndex(0);
      }
    },
    [generate, lyrics, duration, bpm, seed, keyscale, timesignature, language, cfgScale, temperature, steps, clearError]
  );

  const activeResult = results[activeResultIndex] ?? null;

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {audioPlaying && (
        <div className="fixed inset-0 z-0">
          <AudioVisualizer3D
            key={viz.mode}
            isPlaying={audioPlaying}
            colorScheme="emerald"
            mode={viz.mode}
            speed={viz.speed}
            intensity={viz.intensity}
            particleDensity={viz.particleDensity}
          />
        </div>
      )}

      <div className="relative z-10 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
            <Music size={20} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-white">Audio Generation</h1>
            <p className="text-xs sm:text-sm text-white/40">Create music using ACE Step 1.5 model</p>
          </div>
        </div>

        <PromptBox
          onSubmit={handleGenerate}
          loading={loading}
          placeholder="style: ambient electronic&#10;mood: peaceful, ethereal&#10;tempo: slow&#10;instruments: synthesizer, piano, atmospheric pads"
          showRandomSeed
          onRandomSeed={randomizeSeed}
          suggestionContext="audio"
          onPromptChange={setStylePrompt}
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-white/40">Lyrics (optional)</label>
            {isAiConfigured && (
              <button
                onClick={handleGenerateLyrics}
                disabled={lyricsLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-amber-400/70 hover:text-amber-400 transition-all duration-200 disabled:opacity-40"
                title="Generate lyrics with AI based on the style description above"
              >
                {lyricsLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Lightbulb size={12} />
                )}
                {lyricsLoading ? 'Writing...' : 'Generate Lyrics'}
              </button>
            )}
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            placeholder="[Verse 1]&#10;Enter your lyrics here...&#10;&#10;[Chorus]&#10;..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
          {lyricsError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400">
              <AlertCircle size={12} />
              <span>{lyricsError}</span>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-xs sm:text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <Settings2 size={14} />
            <span>Audio settings</span>
            {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSettings && (
            <div className="mt-3 space-y-4 p-3 sm:p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Duration (sec)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} max={600} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">BPM</label>
                  <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} min={40} max={300} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Key / Scale</label>
                  <select value={keyscale} onChange={(e) => setKeyscale(e.target.value)} className={inputClass}>
                    {KEY_SCALES.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Time Signature</label>
                  <select value={timesignature} onChange={(e) => setTimesignature(e.target.value)} className={inputClass}>
                    {TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}/4</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                    <option value="en">English</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Steps</label>
                  <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={1} max={50} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">CFG Scale</label>
                  <input type="number" value={cfgScale} onChange={(e) => setCfgScale(Number(e.target.value))} min={1} max={10} step={0.1} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Temperature</label>
                  <input type="number" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} min={0} max={2} step={0.1} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Seed</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={`${inputClass} flex-1`} />
                    <button onClick={randomizeSeed} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
                      <Dice5 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs sm:text-sm text-red-300">{error}</div>
        )}

        <JobQueue />

        {activeResult?.output_url && (
          <div className="space-y-2 animate-fade-in">
            <h2 className="text-sm font-medium text-white/60">Now Playing</h2>
            <AudioPlayer
              src={activeResult.output_url}
              title={activeResult.prompt}
              autoPlay
              onPlayStateChange={setAudioPlaying}
              onDownload={() => {
                const a = document.createElement('a');
                a.href = activeResult.output_url!;
                a.download = 'audio.mp3';
                a.click();
              }}
            />
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

        {results.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-emerald-400/60" />
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Previous Tracks</h2>
              <span className="text-[10px] text-white/20">{results.length} total</span>
            </div>
            <div className="space-y-1">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setActiveResultIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    activeResultIndex === i
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                  }`}
                >
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${
                    activeResultIndex === i ? 'bg-emerald-500/20' : 'bg-white/5'
                  }`}>
                    <Play size={10} className={activeResultIndex === i ? 'text-emerald-400' : 'text-white/30'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${activeResultIndex === i ? 'text-white/70' : 'text-white/40'}`}>
                      {r.prompt || 'Untitled track'}
                    </p>
                    <p className="text-[10px] text-white/20">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {activeResultIndex === i && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      <div className="w-1 h-2 bg-emerald-400/60 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1 h-3.5 bg-emerald-400/80 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-white/5">
          <h2 className="text-sm font-medium text-white/40 mb-3">Recent Audio</h2>
          <HistoryGallery filterType="audio" compact />
        </div>
      </div>
    </div>
  );
}
