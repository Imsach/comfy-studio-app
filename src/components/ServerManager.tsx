import { useState } from 'react';
import { Plus, Trash2, Server, Wifi, WifiOff } from 'lucide-react';
import { useServerStore } from '../store/serverStore';
import type { ComfyServer } from '../types';

interface ServerManagerProps {
  servers: ComfyServer[];
  primaryUrl: string;
  onServersChange: (servers: ComfyServer[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export default function ServerManager({ servers, primaryUrl, onServersChange }: ServerManagerProps) {
  const statuses = useServerStore((s) => s.statuses);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const server: ComfyServer = {
      id: generateId(),
      name: newName.trim() || `Server ${servers.length + 2}`,
      url: newUrl.trim().replace(/\/+$/, ''),
      enabled: true,
    };
    onServersChange([...servers, server]);
    setNewName('');
    setNewUrl('');
  };

  const handleRemove = (id: string) => {
    onServersChange(servers.filter((s) => s.id !== id));
  };

  const handleToggle = (id: string) => {
    onServersChange(servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const inputClass =
    'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40';
  const primaryStatus = statuses['primary'];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">
        <Server size={14} className="text-cyan-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">Primary</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">default</span>
          </div>
          <p className="text-xs text-white/30 truncate">{primaryUrl}</p>
        </div>
        {primaryStatus && (
          primaryStatus.connected
            ? <Wifi size={14} className="text-emerald-400 flex-shrink-0" />
            : <WifiOff size={14} className="text-red-400 flex-shrink-0" />
        )}
      </div>

      {servers.map((server) => {
        const status = statuses[server.id];
        return (
          <div key={server.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">
            <button
              onClick={() => handleToggle(server.id)}
              className={`w-8 h-4 rounded-full flex-shrink-0 transition-colors relative ${
                server.enabled ? 'bg-emerald-500/30' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                  server.enabled ? 'left-4 bg-emerald-400' : 'left-0.5 bg-white/30'
                }`}
              />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white/70">{server.name}</span>
              <p className="text-xs text-white/30 truncate">{server.url}</p>
            </div>
            {status && (
              status.connected
                ? <Wifi size={14} className="text-emerald-400 flex-shrink-0" />
                : <WifiOff size={14} className="text-red-400 flex-shrink-0" />
            )}
            <button
              onClick={() => handleRemove(server.id)}
              className="p-1 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className={`${inputClass} w-28`}
        />
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="http://192.168.x.x:8188"
          className={`${inputClass} flex-1`}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newUrl.trim()}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
