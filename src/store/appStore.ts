import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PageId, ConnectionStatus, AppSettings } from '../types';

interface AppState {
  currentPage: PageId;
  sidebarCollapsed: boolean;
  connectionStatus: ConnectionStatus;
  settings: AppSettings;
  pendingEditImageUrl: string | null;
  setPage: (page: PageId) => void;
  toggleSidebar: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setPendingEditImage: (url: string | null) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  comfyUrl: 'http://localhost:8188',
  outputFolder: './output',
  defaultSteps: 41,
  defaultCfg: 5,
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultSampler: 'res_multistep',
  defaultScheduler: 'simple',
  aiProvider: 'ollama',
  ollamaUrl: '',
  ollamaModel: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  additionalServers: [],
  autoGenInterval: 30,
  autoGenTheme: '',
  visualizer: { mode: 'bars', speed: 1, intensity: 1, particleDensity: 'medium' },
  taskRouting: {
    image: { mode: 'auto', preferredServers: [], minVramGB: 4 },
    edit: { mode: 'auto', preferredServers: [], minVramGB: 4 },
    audio: { mode: 'auto', preferredServers: [], minVramGB: 6 },
    '3d': { mode: 'auto', preferredServers: [], minVramGB: 8 },
  },
  autoGenContentMode: 'creative',
  autoGenCategories: [],
  autoGenDisplay: {
    slideshowEnabled: true,
    slideshowInterval: 4,
    transition: 'crossfade',
    showPromptOverlay: true,
    showCounterOverlay: true,
    showAnimatedBg: true,
    presentationMode: false,
    overlayPosition: 'bottom',
    newImageHoldSeconds: 5,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'text-to-image',
      sidebarCollapsed: false,
      connectionStatus: 'checking',
      settings: DEFAULT_SETTINGS,
      pendingEditImageUrl: null,
      setPage: (page) => set({ currentPage: page }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),
      setPendingEditImage: (url) => set({ pendingEditImageUrl: url }),
    }),
    {
      name: 'comfyui-app-settings',
      partialize: (state) => ({
        currentPage: state.currentPage,
        sidebarCollapsed: state.sidebarCollapsed,
        settings: state.settings,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>;
        const merged = { ...current, ...p };
        if (p.settings) {
          merged.settings = { ...DEFAULT_SETTINGS, ...p.settings };
        }
        return merged;
      },
    }
  )
);
