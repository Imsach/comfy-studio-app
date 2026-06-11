import { Activity, Waves, Orbit, Sparkles, Gauge, Zap, Layers, CloudFog, Sun, Circle } from 'lucide-react';
import type { VisualizerSettings, VisualizerMode, ParticleDensity } from '../types';

interface VisualizerControlsProps {
  settings: VisualizerSettings;
  onChange: (settings: VisualizerSettings) => void;
}

const MODES: { value: VisualizerMode; label: string; icon: React.ReactNode }[] = [
  { value: 'bars', label: 'Bars', icon: <Activity size={12} /> },
  { value: 'wave', label: 'Wave', icon: <Waves size={12} /> },
  { value: 'spiral', label: 'Spiral', icon: <Orbit size={12} /> },
  { value: 'galaxy', label: 'Galaxy', icon: <Sparkles size={12} /> },
  { value: 'nebula', label: 'Nebula', icon: <CloudFog size={12} /> },
  { value: 'aurora', label: 'Aurora', icon: <Sun size={12} /> },
  { value: 'rings', label: 'Rings', icon: <Circle size={12} /> },
];

const DENSITIES: { value: ParticleDensity; label: string }[] = [
  { value: 'low', label: 'L' },
  { value: 'medium', label: 'M' },
  { value: 'high', label: 'H' },
];

export default function VisualizerControls({ settings, onChange }: VisualizerControlsProps) {
  const update = (patch: Partial<VisualizerSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white/[0.03] border border-white/5 rounded-lg">
      <div className="flex items-center gap-1 p-0.5 bg-white/[0.03] rounded-md">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => update({ mode: m.value })}
            title={m.label}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
              settings.mode === m.value
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/30 hover:text-white/50'
            }`}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Gauge size={10} className="text-white/25" />
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.1}
          value={settings.speed}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-14 sm:w-20 h-1 accent-cyan-500 cursor-pointer"
        />
        <span className="text-[10px] text-white/20 w-6 tabular-nums">{settings.speed.toFixed(1)}x</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Zap size={10} className="text-white/25" />
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.1}
          value={settings.intensity}
          onChange={(e) => update({ intensity: parseFloat(e.target.value) })}
          className="w-14 sm:w-20 h-1 accent-cyan-500 cursor-pointer"
        />
        <span className="text-[10px] text-white/20 w-6 tabular-nums">{settings.intensity.toFixed(1)}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Layers size={10} className="text-white/25" />
        <div className="flex gap-0.5 p-0.5 bg-white/[0.03] rounded">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              onClick={() => update({ particleDensity: d.value })}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                settings.particleDensity === d.value
                  ? 'bg-white/10 text-white'
                  : 'text-white/25 hover:text-white/40'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
