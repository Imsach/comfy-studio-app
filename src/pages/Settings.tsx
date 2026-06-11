import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Wifi, WifiOff, RefreshCw, Save, Check,
  Brain, Eye, EyeOff, Loader2, AlertCircle, Server, Wand2, Route, Sparkles,
} from 'lucide-react';
import SettingsField from '../components/SettingsField';
import ServerManager from '../components/ServerManager';
import GpuMonitor from '../components/GpuMonitor';
import TaskRoutingSettings from '../components/TaskRoutingSettings';
import ContentModeSettings from '../components/ContentModeSettings';
import { useAppStore } from '../store/appStore';
import { checkConnection, checkConnectionWithUrl } from '../services/comfyClient';
import { fetchOllamaModels } from '../services/aiPromptService';
import type { AiProvider, ComfyServer, TaskRoutingConfig, AutoGenContentMode } from '../types';
import type { OllamaModel } from '../services/aiPromptService';

export default function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);

  const [comfyUrl, setComfyUrl] = useState(settings.comfyUrl);
  const [outputFolder, setOutputFolder] = useState(settings.outputFolder);
  const [defaultSteps, setDefaultSteps] = useState(settings.defaultSteps);
  const [defaultCfg, setDefaultCfg] = useState(settings.defaultCfg);
  const [defaultWidth, setDefaultWidth] = useState(settings.defaultWidth);
  const [defaultHeight, setDefaultHeight] = useState(settings.defaultHeight);
  const [defaultSampler, setDefaultSampler] = useState(settings.defaultSampler);
  const [defaultScheduler, setDefaultScheduler] = useState(settings.defaultScheduler);
  const [additionalServers, setAdditionalServers] = useState<ComfyServer[]>(settings.additionalServers || []);

  const [aiProvider, setAiProvider] = useState<AiProvider>(settings.aiProvider);
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel);
  const [showApiKey, setShowApiKey] = useState(false);

  const [autoGenInterval, setAutoGenInterval] = useState(settings.autoGenInterval || 30);
  const [autoGenTheme, setAutoGenTheme] = useState(settings.autoGenTheme || '');
  const [taskRouting, setTaskRouting] = useState<Record<string, TaskRoutingConfig>>(
    settings.taskRouting || {}
  );
  const [autoGenContentMode, setAutoGenContentMode] = useState<AutoGenContentMode>(
    settings.autoGenContentMode || 'creative'
  );
  const [autoGenCategories, setAutoGenCategories] = useState<string[]>(
    settings.autoGenCategories || []
  );

  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');

  const loadOllamaModels = async () => {
    setLoadingModels(true);
    setModelsError('');
    try {
      const models = await fetchOllamaModels();
      setOllamaModels(models);
      if (models.length > 0 && !ollamaModel) {
        setOllamaModel(models[0].name);
      }
    } catch {
      setModelsError('Could not reach Ollama. Make sure it is running.');
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (aiProvider === 'ollama') {
      loadOllamaModels();
    }
  }, [aiProvider]);

  const handleSave = () => {
    const cleanUrl = comfyUrl.replace(/\/+$/, '');
    setComfyUrl(cleanUrl);
    updateSettings({
      comfyUrl: cleanUrl,
      outputFolder,
      defaultSteps,
      defaultCfg,
      defaultWidth,
      defaultHeight,
      defaultSampler,
      defaultScheduler,
      additionalServers,
      aiProvider,
      ollamaUrl: ollamaUrl.replace(/\/+$/, ''),
      ollamaModel,
      openaiApiKey,
      openaiModel,
      autoGenInterval,
      autoGenTheme,
      taskRouting,
      autoGenContentMode,
      autoGenCategories,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    testConnection(cleanUrl);
  };

  const testConnection = async (url?: string) => {
    setChecking(true);
    setConnectionStatus('checking');
    const connected = url ? await checkConnectionWithUrl(url) : await checkConnection();
    setConnectionStatus(connected ? 'connected' : 'disconnected');
    setChecking(false);
  };

  useEffect(() => {
    testConnection();
  }, []);

  const inputClass =
    'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40 w-48';

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-white/5">
          <SettingsIcon size={20} className="text-white/60" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-white/40">Configure your ComfyUI connection and defaults</p>
        </div>
      </div>

      <div className="space-y-1 p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/70">Connection Status</h2>
          <button
            onClick={() => testConnection(comfyUrl)}
            disabled={checking}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            Test
          </button>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi size={16} className="text-emerald-400" />
          ) : connectionStatus === 'disconnected' ? (
            <WifiOff size={16} className="text-red-400" />
          ) : (
            <RefreshCw size={16} className="text-white/40 animate-spin" />
          )}
          <span className={`text-sm ${connectionStatus === 'connected' ? 'text-emerald-400' : connectionStatus === 'disconnected' ? 'text-red-400' : 'text-white/40'}`}>
            {connectionStatus === 'connected' ? 'Connected to ComfyUI' : connectionStatus === 'disconnected' ? 'Cannot reach ComfyUI' : 'Checking...'}
          </span>
        </div>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
        <SettingsField label="ComfyUI URL" description="The address of your primary ComfyUI instance">
          <input type="text" value={comfyUrl} onChange={(e) => setComfyUrl(e.target.value)} className={inputClass} />
        </SettingsField>
        <SettingsField label="Output Folder" description="Where to save generated files">
          <input type="text" value={outputFolder} onChange={(e) => setOutputFolder(e.target.value)} className={inputClass} />
        </SettingsField>
        <SettingsField label="Default Steps" description="Sampling steps for generation">
          <input type="number" value={defaultSteps} onChange={(e) => setDefaultSteps(Number(e.target.value))} min={1} max={150} className={inputClass} />
        </SettingsField>
        <SettingsField label="Default CFG Scale" description="Classifier-free guidance scale">
          <input type="number" value={defaultCfg} onChange={(e) => setDefaultCfg(Number(e.target.value))} min={1} max={30} step={0.5} className={inputClass} />
        </SettingsField>
        <SettingsField label="Default Width" description="Image width in pixels">
          <input type="number" value={defaultWidth} onChange={(e) => setDefaultWidth(Number(e.target.value))} min={64} max={2048} step={64} className={inputClass} />
        </SettingsField>
        <SettingsField label="Default Height" description="Image height in pixels">
          <input type="number" value={defaultHeight} onChange={(e) => setDefaultHeight(Number(e.target.value))} min={64} max={2048} step={64} className={inputClass} />
        </SettingsField>
        <SettingsField label="Default Sampler" description="Sampling method">
          <select value={defaultSampler} onChange={(e) => setDefaultSampler(e.target.value)} className={inputClass}>
            {['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'res_multistep'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingsField>
        <SettingsField label="Default Scheduler" description="Noise schedule type">
          <select value={defaultScheduler} onChange={(e) => setDefaultScheduler(e.target.value)} className={inputClass}>
            {['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingsField>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Server size={16} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-white/70">ComfyUI Servers</h2>
        </div>
        <p className="text-xs text-white/30 -mt-2">
          Add multiple ComfyUI servers for load balancing. Jobs route to the least busy server.
        </p>
        <ServerManager
          servers={additionalServers}
          primaryUrl={comfyUrl}
          onServersChange={setAdditionalServers}
        />
        <GpuMonitor />
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-white/70">AI Prompt Assistant</h2>
        </div>
        <p className="text-xs text-white/30 -mt-2">
          Use AI to generate creative prompt suggestions and lyrics
        </p>

        <div className="space-y-3 divide-y divide-white/5">
          <SettingsField label="Provider" description="Choose between local Ollama or OpenAI">
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setAiProvider('ollama')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${aiProvider === 'ollama' ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/60'}`}
              >
                Ollama
              </button>
              <button
                onClick={() => setAiProvider('openai')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${aiProvider === 'openai' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
              >
                OpenAI
              </button>
            </div>
          </SettingsField>

          {aiProvider === 'ollama' && (
            <SettingsField label="Ollama URL" description="Address of your Ollama server (leave empty to auto-detect)">
              <input type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://192.168.x.x:11434" className={inputClass} />
            </SettingsField>
          )}

          {aiProvider === 'ollama' && (
            <SettingsField label="Ollama Model" description="Select a model from your Ollama instance">
              <div className="flex flex-col gap-1.5 items-end">
                <div className="flex gap-1.5">
                  <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className={inputClass} disabled={loadingModels || ollamaModels.length === 0}>
                    {ollamaModels.length === 0 && !loadingModels && <option value="">No models found</option>}
                    {ollamaModels.map((m) => (
                      <option key={m.name} value={m.name}>{m.name} ({formatSize(m.size)})</option>
                    ))}
                  </select>
                  <button onClick={loadOllamaModels} disabled={loadingModels} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors" title="Refresh models">
                    {loadingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                </div>
                {modelsError && (
                  <div className="flex items-center gap-1 text-[10px] text-red-400">
                    <AlertCircle size={10} />
                    <span>{modelsError}</span>
                  </div>
                )}
              </div>
            </SettingsField>
          )}

          {aiProvider === 'openai' && (
            <>
              <SettingsField label="API Key" description="Your OpenAI API key">
                <div className="flex gap-1.5">
                  <input type={showApiKey ? 'text' : 'password'} value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="sk-..." className={inputClass} />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors">
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SettingsField>
              <SettingsField label="Model" description="OpenAI model to use for suggestions">
                <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} className={inputClass}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </SettingsField>
            </>
          )}
        </div>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 size={16} className="text-sky-400" />
          <h2 className="text-sm font-medium text-white/70">Auto Generate Defaults</h2>
        </div>
        <p className="text-xs text-white/30 -mt-2">
          Default settings for the auto-generation page
        </p>
        <div className="space-y-3 divide-y divide-white/5">
          <SettingsField label="Interval" description="Seconds between each auto-generation">
            <input type="number" value={autoGenInterval} onChange={(e) => setAutoGenInterval(Number(e.target.value))} min={5} max={600} className={inputClass} />
          </SettingsField>
          <SettingsField label="Default Theme" description="Default theme/style for auto-generated prompts">
            <input type="text" value={autoGenTheme} onChange={(e) => setAutoGenTheme(e.target.value)} placeholder="landscapes, portraits, abstract..." className={inputClass} />
          </SettingsField>
        </div>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Route size={16} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-white/70">GPU Task Routing</h2>
        </div>
        <p className="text-xs text-white/30 -mt-2">
          Assign servers to specific task types and set minimum VRAM requirements. Tasks will only route to assigned servers with enough free VRAM.
        </p>
        <TaskRoutingSettings routing={taskRouting} onChange={setTaskRouting} />
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-sky-400" />
          <h2 className="text-sm font-medium text-white/70">AI Content Mode</h2>
        </div>
        <p className="text-xs text-white/30 -mt-2">
          Control how the AI generates image prompts during auto-generation
        </p>
        <ContentModeSettings
          mode={autoGenContentMode}
          categories={autoGenCategories}
          onModeChange={setAutoGenContentMode}
          onCategoriesChange={setAutoGenCategories}
        />
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium text-sm hover:from-cyan-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-cyan-500/20"
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
