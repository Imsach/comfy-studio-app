import type {
  ComfyWorkflow,
  ComfySubmitResult,
  ComfyHistoryEntry,
  GpuInfo,
  ServerStatus,
  ComfyServer,
  GenerationType,
  TaskRoutingConfig,
} from '../types';

function getAppSettings(): {
  comfyUrl: string;
  additionalServers: ComfyServer[];
  taskRouting: Record<string, TaskRoutingConfig>;
} {
  try {
    const stored = localStorage.getItem('comfyui-app-settings');
    if (stored) {
      const s = JSON.parse(stored)?.state?.settings;
      if (s) {
        return {
          comfyUrl: (s.comfyUrl || 'http://localhost:8188').replace(/\/+$/, ''),
          additionalServers: s.additionalServers || [],
          taskRouting: s.taskRouting || {},
        };
      }
    }
  } catch {
    // fall through
  }
  return { comfyUrl: 'http://localhost:8188', additionalServers: [], taskRouting: {} };
}

function getComfyUrl(): string {
  return getAppSettings().comfyUrl;
}

function proxyFetch(path: string, comfyUrl: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Comfy-Target', comfyUrl);
  return fetch(`/comfyui-proxy${path}`, { ...init, headers });
}

function proxyImageUrl(path: string, comfyUrl: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `/comfyui-proxy${path}${separator}_target=${encodeURIComponent(comfyUrl)}`;
}

const _activeJobs = new Map<string, number>();

export function markServerBusy(serverUrl: string) {
  _activeJobs.set(serverUrl, (_activeJobs.get(serverUrl) || 0) + 1);
}

export function markServerFree(serverUrl: string) {
  const count = (_activeJobs.get(serverUrl) || 1) - 1;
  if (count <= 0) _activeJobs.delete(serverUrl);
  else _activeJobs.set(serverUrl, count);
}

export function getActiveJobCount(serverUrl: string): number {
  return _activeJobs.get(serverUrl) || 0;
}

export async function waitForServerQueue(
  serverUrl: string,
  maxWaitMs = 120000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await proxyFetch('/queue', serverUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const running = data.queue_running?.length || 0;
        if (running === 0) return;
      }
    } catch {
      // ignore, retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export function getAllServerUrls(): { id: string; url: string; name: string }[] {
  const { comfyUrl, additionalServers } = getAppSettings();
  return [
    { id: 'primary', url: comfyUrl, name: 'Primary' },
    ...additionalServers
      .filter((s) => s.enabled)
      .map((s) => ({ id: s.id, url: s.url.replace(/\/+$/, ''), name: s.name })),
  ];
}

export function pickBestServer(
  statuses: Record<string, ServerStatus>,
  taskType?: GenerationType
): string {
  const servers = getAllServerUrls();
  const { taskRouting } = getAppSettings();
  const routing = taskType ? taskRouting[taskType] : undefined;
  const preferredIds = routing?.preferredServers?.length ? routing.preferredServers : null;
  const minVramGB = routing?.minVramGB ?? 0;
  const routingMode = routing && 'mode' in routing
    ? (routing as TaskRoutingConfig & { mode?: string }).mode
    : undefined;
  const isManual = routingMode === 'manual' && preferredIds !== null;

  let bestUrl = servers[0]?.url || getComfyUrl();
  let bestScore = -Infinity;

  const scoreServer = (server: { id: string; url: string }, checkPreferred: boolean) => {
    const status = statuses[server.id];
    if (!status?.connected) return;
    if (status.gpus.length === 0) return;
    if (checkPreferred && isManual && preferredIds && !preferredIds.includes(server.id)) return;

    const maxGpuTotalGB = status.gpus.reduce(
      (max, g) => Math.max(max, g.vramTotal / (1024 * 1024 * 1024)), 0
    );
    if (minVramGB > 0 && maxGpuTotalGB < minVramGB) return;

    const totalFreeVram = status.gpus.reduce((sum, g) => sum + g.vramFree, 0);
    const freeVramGB = totalFreeVram / (1024 * 1024 * 1024);
    const capacityBonus = maxGpuTotalGB >= minVramGB && minVramGB > 0 ? 2 : 0;
    const gpuBonus = status.gpus.length * 0.5;
    const queuePenalty = status.queueRemaining * 3;
    const inFlightPenalty = getActiveJobCount(server.url) * 10;
    const score = freeVramGB + gpuBonus + capacityBonus - queuePenalty - inFlightPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestUrl = server.url;
    }
  };

  for (const server of servers) {
    scoreServer(server, true);
  }

  if (bestScore === -Infinity) {
    for (const server of servers) {
      scoreServer(server, false);
    }
  }

  if (bestScore === -Infinity) {
    for (const server of servers) {
      const status = statuses[server.id];
      if (!status?.connected) continue;
      bestUrl = server.url;
      break;
    }
  }

  return bestUrl;
}

export async function getSystemStats(
  serverUrl?: string
): Promise<{ gpus: GpuInfo[]; queueRemaining: number }> {
  const url = serverUrl || getComfyUrl();
  const gpus: GpuInfo[] = [];
  let queueRemaining = 0;

  try {
    const [statsRes, queueRes] = await Promise.all([
      proxyFetch('/system_stats', url, { signal: AbortSignal.timeout(5000) }),
      proxyFetch('/queue', url, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (statsRes.ok) {
      const data = await statsRes.json();
      let devices: Record<string, unknown>[] = [];

      if (Array.isArray(data.devices) && data.devices.length > 0) {
        devices = data.devices;
      } else if (Array.isArray(data.system?.devices) && data.system.devices.length > 0) {
        devices = data.system.devices;
      } else if (Array.isArray(data.cuda_devices) && data.cuda_devices.length > 0) {
        devices = data.cuda_devices;
      } else if (Array.isArray(data.system?.cuda_devices) && data.system.cuda_devices.length > 0) {
        devices = data.system.cuda_devices;
      } else if (Array.isArray(data.system?.gpu_devices) && data.system.gpu_devices.length > 0) {
        devices = data.system.gpu_devices;
      } else if (data.system?.gpu && typeof data.system.gpu === 'object' && !Array.isArray(data.system.gpu)) {
        devices = [data.system.gpu];
      }

      if (devices.length === 0) {
        const findDevices = (obj: Record<string, unknown>, depth = 0): Record<string, unknown>[] => {
          if (depth > 3) return [];
          for (const val of Object.values(obj)) {
            if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object') {
              const first = val[0] as Record<string, unknown>;
              if ('vram_total' in first || 'torch_vram_total' in first || 'name' in first) {
                return val as Record<string, unknown>[];
              }
            }
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const found = findDevices(val as Record<string, unknown>, depth + 1);
              if (found.length > 0) return found;
            }
          }
          return [];
        };
        devices = findDevices(data);
      }

      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const vramTotal = (device.vram_total || device.torch_vram_total || device.total_memory || 0) as number;
        const vramFree = (device.vram_free || device.torch_vram_free || device.free_memory || 0) as number;
        if (vramTotal === 0 && vramFree === 0) continue;
        gpus.push({
          name: (device.name as string) || `GPU ${i}`,
          index: (device.index as number) ?? i,
          vramTotal,
          vramUsed: vramTotal - vramFree,
          vramFree,
          temperature: (device.temperature as number) ?? null,
          utilization: (device.utilization as number) ?? null,
        });
      }
    }

    if (queueRes.ok) {
      const qData = await queueRes.json();
      queueRemaining =
        (qData.queue_running?.length || 0) + (qData.queue_pending?.length || 0);
    }
  } catch {
    // return empty defaults
  }

  return { gpus, queueRemaining };
}

export async function checkConnectionWithUrl(url: string): Promise<boolean> {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const res = await proxyFetch('/system_stats', cleanUrl, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkConnection(): Promise<boolean> {
  return checkConnectionWithUrl(getComfyUrl());
}

export async function submitWorkflow(
  workflow: ComfyWorkflow,
  serverUrl?: string
): Promise<ComfySubmitResult> {
  const url = serverUrl || getComfyUrl();
  const res = await proxyFetch('/prompt', url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`ComfyUI rejected workflow (${url}): ${text}`);
  }

  return res.json();
}

export async function getHistory(
  promptId: string,
  serverUrl?: string
): Promise<ComfyHistoryEntry | null> {
  const url = serverUrl || getComfyUrl();
  const res = await proxyFetch(`/history/${promptId}`, url, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`History request failed: ${res.status}`);
  const data = await res.json();
  return data[promptId] || null;
}

export async function pollUntilComplete(
  promptId: string,
  onProgress?: (pct: number) => void,
  timeoutMs = 600000,
  serverUrl?: string
): Promise<ComfyHistoryEntry> {
  const start = Date.now();
  let attempts = 0;
  let consecutiveFailures = 0;

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;

    let entry: ComfyHistoryEntry | null;
    try {
      entry = await getHistory(promptId, serverUrl);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= 30) {
        throw new Error(`Lost connection to ComfyUI server while polling (${serverUrl || 'primary'})`);
      }
      const estimated = Math.min(30, attempts * 2);
      onProgress?.(estimated);
      continue;
    }

    if (entry === null) {
      const estimated = Math.min(90, attempts * 2);
      onProgress?.(estimated);
      continue;
    }

    if (entry.status?.completed) {
      onProgress?.(100);
      return entry;
    }

    if (entry.status?.status_str === 'error') {
      throw new Error(`ComfyUI reported an error during generation on ${serverUrl || 'primary'}`);
    }

    const estimated = Math.min(90, attempts * 3);
    onProgress?.(estimated);
  }

  throw new Error('Generation timed out after 10 minutes');
}

export function getImageUrl(
  filename: string,
  subfolder: string,
  type: string,
  serverUrl?: string
): string {
  const url = serverUrl || getComfyUrl();
  const path = `/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
  return proxyImageUrl(path, url);
}

export async function uploadImage(
  file: File,
  serverUrl?: string
): Promise<{ name: string; subfolder: string; type: string }> {
  const url = serverUrl || getComfyUrl();
  const formData = new FormData();
  formData.append('image', file);
  formData.append('overwrite', 'true');

  const res = await proxyFetch('/upload/image', url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Failed to upload image to ComfyUI');
  }

  return res.json();
}

export async function loadWorkflowTemplate(name: string): Promise<ComfyWorkflow> {
  const res = await fetch(`/workflows/${name}`);
  if (!res.ok) throw new Error(`Failed to load workflow: ${name}`);
  return res.json();
}

export function injectTextToImageParams(
  workflow: ComfyWorkflow,
  params: {
    prompt: string;
    negativePrompt?: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    width?: number;
    height?: number;
  }
): ComfyWorkflow {
  const w = structuredClone(workflow);

  if (w['76:67']) w['76:67'].inputs.text = params.prompt;
  if (w['76:71']) w['76:71'].inputs.text = params.negativePrompt || '';

  if (w['76:69']) {
    const sampler = w['76:69'].inputs;
    if (params.seed !== undefined && params.seed !== -1) sampler.seed = params.seed;
    else sampler.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    if (params.steps !== undefined) sampler.steps = params.steps;
    if (params.cfg !== undefined) sampler.cfg = params.cfg;
  }

  if (w['76:68']) {
    if (params.width !== undefined) w['76:68'].inputs.width = params.width;
    if (params.height !== undefined) w['76:68'].inputs.height = params.height;
  }

  return w;
}

export function injectImageEditParams(
  workflow: ComfyWorkflow,
  params: {
    prompt: string;
    imageName: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    denoise?: number;
  }
): ComfyWorkflow {
  const w = structuredClone(workflow);

  if (w['435']) w['435'].inputs.value = params.prompt;
  if (w['78']) w['78'].inputs.image = params.imageName;

  if (w['433:3']) {
    const sampler = w['433:3'].inputs;
    if (params.seed !== undefined && params.seed !== -1) sampler.seed = params.seed;
    else sampler.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    if (params.steps !== undefined) sampler.steps = params.steps;
    if (params.cfg !== undefined) sampler.cfg = params.cfg;
    if (params.denoise !== undefined) sampler.denoise = params.denoise;
  }

  return w;
}

export function injectAudioParams(
  workflow: ComfyWorkflow,
  params: {
    tags: string;
    lyrics?: string;
    seed?: number;
    bpm?: number;
    duration?: number;
    timesignature?: string;
    language?: string;
    keyscale?: string;
    cfgScale?: number;
    temperature?: number;
    steps?: number;
  }
): ComfyWorkflow {
  const w = structuredClone(workflow);

  if (w['94']) {
    const enc = w['94'].inputs;
    enc.tags = params.tags;
    if (params.lyrics !== undefined) enc.lyrics = params.lyrics;
    if (params.bpm !== undefined) enc.bpm = params.bpm;
    if (params.duration !== undefined) enc.duration = params.duration;
    if (params.timesignature !== undefined) enc.timesignature = params.timesignature;
    if (params.language !== undefined) enc.language = params.language;
    if (params.keyscale !== undefined) enc.keyscale = params.keyscale;
    if (params.cfgScale !== undefined) enc.cfg_scale = params.cfgScale;
    if (params.temperature !== undefined) enc.temperature = params.temperature;

    const seed = (params.seed !== undefined && params.seed !== -1)
      ? params.seed
      : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    enc.seed = seed;
  }

  if (w['98'] && params.duration !== undefined) {
    w['98'].inputs.seconds = params.duration;
  }

  if (w['3']) {
    const sampler = w['3'].inputs;
    sampler.seed = w['94']?.inputs?.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    if (params.steps !== undefined) sampler.steps = params.steps;
  }

  return w;
}

export function inject3DParams(
  workflow: ComfyWorkflow,
  params: {
    imageName: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    resolution?: number;
  }
): ComfyWorkflow {
  const w = structuredClone(workflow);

  if (w['2']) w['2'].inputs.image = params.imageName;

  if (w['7']) {
    const sampler = w['7'].inputs;
    if (params.seed !== undefined && params.seed !== -1) sampler.seed = params.seed;
    else sampler.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    if (params.steps !== undefined) sampler.steps = params.steps;
    if (params.cfg !== undefined) sampler.cfg = params.cfg;
  }

  if (w['4'] && params.resolution !== undefined) {
    w['4'].inputs.resolution = params.resolution;
  }

  return w;
}
