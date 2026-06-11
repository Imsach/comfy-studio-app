import { create } from 'zustand';
import type { ServerStatus } from '../types';

interface ServerState {
  statuses: Record<string, ServerStatus>;
  setStatus: (serverId: string, status: ServerStatus) => void;
  clearStatuses: () => void;
}

export const useServerStore = create<ServerState>((set) => ({
  statuses: {},
  setStatus: (serverId, status) =>
    set((s) => ({
      statuses: { ...s.statuses, [serverId]: status },
    })),
  clearStatuses: () => set({ statuses: {} }),
}));
