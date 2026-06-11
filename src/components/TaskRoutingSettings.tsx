import { useState, useEffect } from 'react';
import { Server, Cpu, AlertTriangle, Zap, SlidersHorizontal } from 'lucide-react';
import { useServerStore } from '../store/serverStore';
import { getAllServerUrls } from '../services/comfyClient';
import type { TaskRoutingConfig, TaskRoutingMode, GenerationType } from '../types';

const TASK_TYPES: { type: GenerationType; label: string; color: string; defaultVram: number }[] = [
  { type: 'image', label: 'Text-to-Image', color: 'text-cyan-400', defaultVram: 4 },
  { type: 'edit', label: 'Image Editing', color: 'text-amber-400', defaultVram: 4 },
  { type: 'audio', label: 'Audio Generation', color: 'text-emerald-400', defaultVram: 6 },
  { type: '3d', label: '3D Generation', color: 'text-rose-400', defaultVram: 8 },
];

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

interface TaskRoutingSettingsProps {
  routing: Record<string, TaskRoutingConfig>;
  onChange: (routing: Record<string, TaskRoutingConfig>) => void;
}

export default function TaskRoutingSettings({ routing, onChange }: TaskRoutingSettingsProps) {
  const statuses = useServerStore((s) => s.statuses);
  const [servers, setServers] = useState<{ id: string; url: string; name: string }[]>([]);

  useEffect(() => {
    setServers(getAllServerUrls());
  }, []);

  const getRouting = (type: string): TaskRoutingConfig => {
    const defaults = TASK_TYPES.find((t) => t.type === type);
    return routing[type] || { mode: 'auto', preferredServers: [], minVramGB: defaults?.defaultVram ?? 4 };
  };

  const updateRouting = (type: string, updates: Partial<TaskRoutingConfig>) => {
    const current = getRouting(type);
    onChange({ ...routing, [type]: { ...current, ...updates } });
  };

  const toggleServer = (type: string, serverId: string) => {
    const current = getRouting(type);
    const preferred = current.preferredServers.includes(serverId)
      ? current.preferredServers.filter((id) => id !== serverId)
      : [...current.preferredServers, serverId];
    updateRouting(type, { preferredServers: preferred });
  };

  const gpuServers = servers.filter((s) => {
    const status = statuses[s.id];
    return status?.connected && status.gpus.length > 0;
  });

  const noGpuServers = servers.filter((s) => {
    const status = statuses[s.id];
    return status?.connected && status.gpus.length === 0;
  });

  return (
    <div className="space-y-4">
      {servers.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
          <AlertTriangle size={14} />
          <span>No servers configured. Add ComfyUI servers above first.</span>
        </div>
      )}

      {noGpuServers.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[10px] text-amber-300/60">
          <AlertTriangle size={12} />
          <span>
            {noGpuServers.map((s) => s.name).join(', ')} - no GPU detected, excluded from routing
          </span>
        </div>
      )}

      {TASK_TYPES.map(({ type, label, color }) => {
        const config = getRouting(type);
        const mode: TaskRoutingMode = config.mode || 'auto';
        const isManual = mode === 'manual';

        return (
          <div key={type} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Cpu size={12} className={color} />
                <span className={`text-xs font-medium ${color}`}>{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-white/[0.03] rounded-md p-0.5">
                  <button
                    onClick={() => updateRouting(type, { mode: 'auto' })}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all ${
                      !isManual
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    <Zap size={8} />
                    Auto
                  </button>
                  <button
                    onClick={() => updateRouting(type, { mode: 'manual' })}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all ${
                      isManual
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    <SlidersHorizontal size={8} />
                    Manual
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-white/30">Min VRAM</label>
                  <input
                    type="number"
                    value={config.minVramGB}
                    onChange={(e) => updateRouting(type, { minVramGB: Number(e.target.value) })}
                    min={0}
                    max={48}
                    step={0.5}
                    className="w-16 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                  />
                  <span className="text-[10px] text-white/30">GB</span>
                </div>
              </div>
            </div>

            {!isManual && (
              <p className="text-[10px] text-sky-400/40">
                Automatically selects the best server based on free VRAM, queue depth, and capacity
              </p>
            )}

            {isManual && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {gpuServers.map((server) => {
                    const status = statuses[server.id];
                    const isSelected = config.preferredServers.includes(server.id);
                    const totalVram = status?.gpus.reduce((s, g) => s + g.vramTotal, 0) ?? 0;
                    const gpuName = status?.gpus[0]?.name?.replace('NVIDIA ', '').replace('GeForce ', '') ?? '';

                    return (
                      <button
                        key={server.id}
                        onClick={() => toggleServer(type, server.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/50 hover:border-white/10'
                        }`}
                      >
                        <Server size={9} />
                        <span className="font-medium">{server.name}</span>
                        {gpuName && (
                          <span className="text-white/20">
                            ({gpuName}{totalVram > 0 ? ` ${formatBytes(totalVram)}` : ''})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {config.preferredServers.length === 0 && (
                  <p className="text-[10px] text-amber-400/50">
                    No servers selected - will fall back to any available GPU server
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
