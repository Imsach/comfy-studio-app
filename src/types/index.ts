export type GenerationType = 'image' | 'edit' | 'audio' | '3d';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PageId =
  | 'text-to-image'
  | 'image-edit'
  | 'audio'
  | '3d'
  | 'auto-gen'
  | 'history'
  | 'settings'
  | 'docs';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

export interface Generation {
  id: string;
  device_id: string;
  type: GenerationType;
  prompt: string;
  settings_json: Record<string, unknown>;
  status: GenerationStatus;
  output_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  comfy_job_id: string | null;
  progress: number;
  created_at: string;
  completed_at: string | null;
}

export type ComfyWorkflow = Record<string, ComfyNode>;

export interface ComfyNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title: string };
}

export interface ComfySubmitResult {
  prompt_id: string;
  number: number;
}

export interface ComfyHistoryEntry {
  outputs: Record<string, ComfyNodeOutput>;
  status: { completed: boolean; status_str: string };
}

export interface ComfyNodeOutput {
  images?: ComfyOutputFile[];
  audio?: ComfyOutputFile[];
  mesh?: ComfyOutputFile[];
  gltfFiles?: ComfyOutputFile[];
}

export interface ComfyOutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

export type AiProvider = 'ollama' | 'openai';

export interface GpuInfo {
  name: string;
  index: number;
  vramTotal: number;
  vramUsed: number;
  vramFree: number;
  temperature: number | null;
  utilization: number | null;
}

export interface ComfyServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ServerStatus {
  serverId: string;
  url: string;
  connected: boolean;
  gpus: GpuInfo[];
  queueRemaining: number;
  lastChecked: number;
}

export type VisualizerMode = 'bars' | 'wave' | 'spiral' | 'galaxy' | 'nebula' | 'aurora' | 'rings';
export type ParticleDensity = 'low' | 'medium' | 'high';

export interface VisualizerSettings {
  mode: VisualizerMode;
  speed: number;
  intensity: number;
  particleDensity: ParticleDensity;
}

export type SlideshowTransition = 'crossfade' | 'slide' | 'zoom' | 'kenburns';

export interface AutoGenDisplaySettings {
  slideshowEnabled: boolean;
  slideshowInterval: number;
  transition: SlideshowTransition;
  showPromptOverlay: boolean;
  showCounterOverlay: boolean;
  showAnimatedBg: boolean;
  presentationMode: boolean;
  overlayPosition: 'bottom' | 'top';
  newImageHoldSeconds: number;
}

export type AutoGenContentMode = 'creative' | 'trending' | 'news' | 'categories';

export type TaskRoutingMode = 'auto' | 'manual';

export interface TaskRoutingConfig {
  mode: TaskRoutingMode;
  preferredServers: string[];
  minVramGB: number;
}

export interface AppSettings {
  comfyUrl: string;
  outputFolder: string;
  defaultSteps: number;
  defaultCfg: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultSampler: string;
  defaultScheduler: string;
  aiProvider: AiProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey: string;
  openaiModel: string;
  additionalServers: ComfyServer[];
  autoGenInterval: number;
  autoGenTheme: string;
  visualizer: VisualizerSettings;
  taskRouting: Record<string, TaskRoutingConfig>;
  autoGenContentMode: AutoGenContentMode;
  autoGenCategories: string[];
  autoGenDisplay: AutoGenDisplaySettings;
}
