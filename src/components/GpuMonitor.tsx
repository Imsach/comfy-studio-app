import { Cpu, Server, Wifi, WifiOff, Thermometer } from 'lucide-react';
import { useServerStore } from '../store/serverStore';
import type { ServerStatus, GpuInfo } from '../types';

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function GpuBar({ gpu }: { gpu: GpuInfo }) {
  const usedPct = gpu.vramTotal > 0 ? (gpu.vramUsed / gpu.vramTotal) * 100 : 0;
  const color =
    usedPct > 90
      ? 'from-red-500 to-red-400'
      : usedPct > 70
      ? 'from-amber-500 to-amber-400'
      : 'from-emerald-500 to-teal-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white/30 flex-shrink-0">#{gpu.index}</span>
          <span className="text-white/50 truncate">{gpu.name}</span>
          {gpu.temperature !== null && (
            <span className="flex items-center gap-0.5 text-white/30 flex-shrink-0">
              <Thermometer size={8} />
              {gpu.temperature}C
            </span>
          )}
        </div>
        <span className="text-white/30 flex-shrink-0">
          {formatBytes(gpu.vramUsed)} / {formatBytes(gpu.vramTotal)}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

function ServerCard({ status }: { status: ServerStatus }) {
  const totalVram = status.gpus.reduce((s, g) => s + g.vramTotal, 0);
  const totalFree = status.gpus.reduce((s, g) => s + g.vramFree, 0);

  return (
    <div className="p-3 bg-white/[0.03] border border-white/5 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-xs text-white/50 truncate">{status.url}</span>
          {status.gpus.length > 0 && (
            <span className="text-[10px] text-white/20 flex-shrink-0">
              {status.gpus.length} GPU{status.gpus.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status.connected ? (
            <Wifi size={10} className="text-emerald-400" />
          ) : (
            <WifiOff size={10} className="text-red-400" />
          )}
          <span className={`text-[10px] ${status.connected ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            {status.connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      {status.connected && status.gpus.length > 0 && (
        <div className="space-y-2">
          {status.gpus.map((gpu, i) => (
            <GpuBar key={i} gpu={gpu} />
          ))}
          <div className="flex items-center justify-between text-[10px] text-white/20">
            <span>Queue: {status.queueRemaining} job{status.queueRemaining !== 1 ? 's' : ''}</span>
            {totalVram > 0 && (
              <span>{formatBytes(totalFree)} free / {formatBytes(totalVram)} total</span>
            )}
          </div>
        </div>
      )}
      {status.connected && status.gpus.length === 0 && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-amber-400/60">No GPU detected - jobs will not be routed here</span>
          <span className="text-white/20">Queue: {status.queueRemaining}</span>
        </div>
      )}
    </div>
  );
}

export default function GpuMonitor() {
  const statuses = useServerStore((s) => s.statuses);
  const statusList = Object.values(statuses);

  if (statusList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Cpu size={12} className="text-white/30" />
        <h3 className="text-[10px] font-medium text-white/30 uppercase tracking-wider">GPU Status</h3>
      </div>
      <div className="space-y-1.5">
        {statusList.map((status) => (
          <ServerCard key={status.serverId} status={status} />
        ))}
      </div>
    </div>
  );
}
