import { useState } from 'react';
import {
  FileText,
  BookOpen,
  Layers,
  GitBranch,
  AlertTriangle,
  Code2,
  ChevronRight,
} from 'lucide-react';

type DocSection = 'usage' | 'architecture' | 'workflow' | 'developer' | 'troubleshoot';

interface SectionData {
  id: DocSection;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-black/40 border border-white/5 rounded-lg p-3 text-xs text-cyan-300/80 overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-white mt-6 mb-2">{children}</h3>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-medium text-white/70 mt-4 mb-1.5">{children}</h4>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/50 leading-relaxed mb-2">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-white/50 leading-relaxed flex gap-2">
      <span className="text-cyan-500/60 mt-1 flex-shrink-0">-</span>
      <span>{children}</span>
    </li>
  );
}

const SECTIONS: SectionData[] = [
  {
    id: 'usage',
    title: 'Usage Guide',
    icon: <BookOpen size={16} />,
    content: (
      <div>
        <Heading>Getting Started</Heading>
        <P>
          This application provides a web interface for ComfyUI, allowing you to generate images,
          edit photos, create audio, and produce 3D models all from your browser.
        </P>

        <Heading>Prerequisites</Heading>
        <div className="space-y-1">
          <Li>ComfyUI installed and running locally on port 8188 (configurable in Settings)</Li>
          <Li>Appropriate models downloaded for each generation type</Li>
          <Li>Node.js 18+ for running this application</Li>
        </div>

        <Heading>Text to Image</Heading>
        <P>Navigate to the Text to Image page from the sidebar. Enter a descriptive prompt and click Generate.</P>
        <SubHeading>Available Settings</SubHeading>
        <div className="space-y-1">
          <Li>Steps: Number of sampling steps (higher = more detail, slower)</Li>
          <Li>CFG Scale: How closely to follow the prompt (7-12 recommended)</Li>
          <Li>Seed: Use -1 for random, or set a specific value for reproducible results</Li>
          <Li>Width/Height: Output resolution in pixels (multiples of 64)</Li>
        </div>

        <Heading>Image Editing</Heading>
        <P>Upload an image via drag-and-drop or click to browse. Enter an edit prompt describing the changes you want.</P>
        <SubHeading>Tips</SubHeading>
        <div className="space-y-1">
          <Li>Use lower denoise values (0.3-0.5) for subtle edits</Li>
          <Li>Use higher denoise values (0.7-1.0) for dramatic changes</Li>
          <Li>The before/after comparison slider lets you see changes</Li>
          <Li>AI-powered suggestions can recommend edits based on the uploaded image</Li>
        </div>

        <Heading>Audio Generation</Heading>
        <P>Select a musical style, set duration and BPM, then describe the audio you want. Optionally add lyrics. Use the AI lyrics generator to create lyrics based on your style/mood description.</P>

        <Heading>3D Generation</Heading>
        <P>Upload a reference image and select quality level. The system will generate a 3D mesh that you can preview and download as GLB.</P>

        <Heading>Auto Generate</Heading>
        <P>The Auto Generate page creates images continuously using AI-generated prompts. Set a theme/style direction, press Start, and watch as new images appear automatically. Each image can be viewed fullscreen, downloaded, or sent to the Image Edit page for further modification.</P>

        <Heading>History</Heading>
        <P>All generations are saved automatically. Browse, filter, re-run, or delete past generations from the History page.</P>
      </div>
    ),
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: <Layers size={16} />,
    content: (
      <div>
        <Heading>System Architecture</Heading>
        <P>The application follows a local-first architecture with the following components:</P>

        <CodeBlock>{`
Browser (React + Vite)
  |
  +-- Zustand Stores
  |     +-- appStore (settings, navigation, connection)
  |     +-- jobStore (active generation jobs)
  |     +-- serverStore (multi-server status, GPU info)
  |
  +-- SQLite via sql.js (local database, history persistence)
  |
  +-- Vite Proxy Plugin
  |     +-- /comfyui-proxy/* -> X-Comfy-Target header routing
  |
  +-- ComfyUI Server(s)
        +-- REST API (job submission, status, results)
        +-- /system_stats (GPU VRAM monitoring)
        +-- /queue (queue depth for load balancing)
`}</CodeBlock>

        <Heading>Frontend Stack</Heading>
        <div className="space-y-1">
          <Li>React 18 with TypeScript for UI components</Li>
          <Li>Tailwind CSS for styling with dark mode glass UI</Li>
          <Li>Zustand for lightweight state management with persistence</Li>
          <Li>Three.js for 3D model viewing</Li>
          <Li>Lucide React for consistent iconography</Li>
        </div>

        <Heading>Data Layer</Heading>
        <div className="space-y-1">
          <Li>SQLite (sql.js) with IndexedDB for persistent local storage of generation history</Li>
          <Li>Device-based isolation for multi-browser support</Li>
          <Li>localStorage for app settings and device identification</Li>
        </div>

        <Heading>Multi-Server Architecture</Heading>
        <P>The system supports multiple ComfyUI servers for load balancing:</P>
        <div className="space-y-1">
          <Li>Primary server configured in Settings (comfyUrl)</Li>
          <Li>Additional servers added via the Server Manager component</Li>
          <Li>All requests routed through the Vite proxy plugin with X-Comfy-Target header</Li>
          <Li>pickBestServer() selects the server with the lowest queue depth</Li>
          <Li>Server health polled every 10 seconds from App.tsx</Li>
          <Li>GPU VRAM and queue depth tracked in serverStore</Li>
        </div>

        <Heading>File Structure</Heading>
        <CodeBlock>{`src/
  components/   # Reusable UI components
    AudioPlayer, FullscreenViewer, GpuMonitor,
    HistoryGallery, ImageCompare, ImageUploader,
    JobQueue, PromptBox, PromptSuggestions,
    ServerManager, SettingsField, Sidebar, ThreeViewer
  pages/        # Page-level components
    AudioGen, AutoGen, Docs, History,
    ImageEdit, Settings, TextToImage, ThreeDGen
  services/     # API clients and business logic
    aiPromptService, comfyClient, generationService
  store/        # Zustand state stores
    appStore, jobStore, serverStore
  hooks/        # Custom React hooks
    useGeneration
  lib/          # Database, utilities
    database, deviceId
  types/        # TypeScript type definitions
public/
  workflows/    # ComfyUI workflow JSON templates`}</CodeBlock>
      </div>
    ),
  },
  {
    id: 'workflow',
    title: 'Workflow Guide',
    icon: <GitBranch size={16} />,
    content: (
      <div>
        <Heading>ComfyUI Workflows</Heading>
        <P>
          Workflows define the node graph that ComfyUI executes. Each workflow is a JSON object
          where keys are node IDs and values describe the node type and its inputs.
        </P>

        <Heading>Workflow Format</Heading>
        <CodeBlock>{`{
  "node_id": {
    "inputs": {
      "param_name": "value",
      "connection": ["other_node_id", output_index]
    },
    "class_type": "NodeClassName",
    "_meta": { "title": "Display Name" }
  }
}`}</CodeBlock>

        <Heading>Text to Image Workflow</Heading>
        <P>The default text-to-image workflow includes these nodes:</P>
        <div className="space-y-1">
          <Li>CheckpointLoaderSimple - Loads the Stable Diffusion model</Li>
          <Li>CLIPTextEncode (x2) - Encodes positive and negative prompts</Li>
          <Li>EmptyLatentImage - Creates the initial latent space</Li>
          <Li>KSampler - Performs the diffusion sampling</Li>
          <Li>VAEDecode - Decodes the latent to a pixel image</Li>
          <Li>SaveImage - Saves the output</Li>
        </div>

        <Heading>Custom Workflows</Heading>
        <P>You can export workflows from the ComfyUI web interface:</P>
        <div className="space-y-1">
          <Li>Open ComfyUI at localhost:8188</Li>
          <Li>Build your workflow visually</Li>
          <Li>Click "Save (API Format)" to export JSON</Li>
          <Li>Place the JSON file in the public/workflows/ directory</Li>
        </div>

        <Heading>Workflow Templates</Heading>
        <P>Default templates are stored in public/workflows/:</P>
        <div className="space-y-1">
          <Li>image_z_image.json - Text-to-image using Z-Image Turbo model</Li>
          <Li>image_qwen_image_edit_2509.json - Image editing using Qwen model</Li>
          <Li>audio_ace_step_1_5_split_4b.json - Audio generation</Li>
          <Li>3d_hunyuan3d-v2.1.json - Image to 3D mesh conversion</Li>
        </div>

        <Heading>Modifying Workflows</Heading>
        <P>
          The app dynamically injects user parameters (prompt, steps, CFG, seed) into the
          workflow before submission. Key injection points are the KSampler node for generation
          settings and CLIPTextEncode for prompts.
        </P>
      </div>
    ),
  },
  {
    id: 'developer',
    title: 'Developer',
    icon: <Code2 size={16} />,
    content: (
      <div>
        <Heading>State Management</Heading>
        <P>The app uses three Zustand stores:</P>
        <SubHeading>appStore</SubHeading>
        <div className="space-y-1">
          <Li>Persisted to localStorage under 'comfyui-app-settings'</Li>
          <Li>Holds current page, sidebar state, connection status, and all user settings</Li>
          <Li>pendingEditImageUrl: transient state for passing an image URL from AutoGen to ImageEdit</Li>
        </div>
        <SubHeading>jobStore</SubHeading>
        <div className="space-y-1">
          <Li>Ephemeral - tracks active generation jobs and their progress</Li>
          <Li>Updated by useGeneration hook as jobs move through pending/processing/completed/failed</Li>
        </div>
        <SubHeading>serverStore</SubHeading>
        <div className="space-y-1">
          <Li>Ephemeral - holds server status records polled every 10 seconds</Li>
          <Li>Each entry contains: connected state, GPU info (name, VRAM used/free), queue depth</Li>
          <Li>Used by pickBestServer() for load balancing decisions</Li>
        </div>

        <Heading>Generation Lifecycle</Heading>
        <CodeBlock>{`1. User submits prompt on a page (TextToImage, ImageEdit, etc.)
2. Page calls useGeneration().generate(type, prompt, settings, buildWorkflow)
3. Hook creates DB record via generationService
4. Hook selects best server via pickBestServer(serverStore.statuses)
5. buildWorkflow() loads template + injects params
6. submitWorkflow() sends to ComfyUI via proxy
7. pollUntilComplete() checks /history endpoint every 1.5s
8. On completion, output URL extracted and DB record updated
9. Job state flows through jobStore for UI updates`}</CodeBlock>

        <Heading>Proxy System</Heading>
        <P>All ComfyUI API calls go through a Vite dev server plugin that proxies requests:</P>
        <CodeBlock>{`Request: GET /comfyui-proxy/system_stats
Header:  X-Comfy-Target: http://192.168.1.100:8188
Result:  Proxied to http://192.168.1.100:8188/system_stats

For image URLs (no custom headers possible in <img src>):
/comfyui-proxy/view?filename=img.png&_target=http://...`}</CodeBlock>
        <P>This avoids CORS issues when the ComfyUI server is on a different host/port.</P>

        <Heading>AI Prompt Service</Heading>
        <P>The aiPromptService supports two providers:</P>
        <SubHeading>Ollama (local)</SubHeading>
        <div className="space-y-1">
          <Li>Auto-discovers at common IPs (localhost, 192.168.x.x) or uses configured URL</Li>
          <Li>Calls /api/generate with the selected model</Li>
          <Li>fetchOllamaModels() lists available models via /api/tags</Li>
          <Li>generateLyrics() creates song lyrics from style/mood descriptions</Li>
        </div>
        <SubHeading>OpenAI</SubHeading>
        <div className="space-y-1">
          <Li>Calls chat completions API with configured model and API key</Li>
          <Li>Same prompt format as Ollama for consistency</Li>
        </div>

        <Heading>Database Schema</Heading>
        <CodeBlock>{`TABLE generations:
  id             TEXT PRIMARY KEY
  device_id      TEXT NOT NULL
  type           TEXT NOT NULL  (image|edit|audio|3d)
  prompt         TEXT NOT NULL
  settings_json  TEXT
  status         TEXT NOT NULL  (pending|processing|completed|failed)
  output_url     TEXT
  thumbnail_url  TEXT
  error_message  TEXT
  comfy_job_id   TEXT
  progress       INTEGER DEFAULT 0
  created_at     TEXT NOT NULL
  completed_at   TEXT`}</CodeBlock>
        <P>Uses sql.js (SQLite compiled to WASM) with IndexedDB persistence. The database file is device-specific to avoid conflicts across browsers.</P>

        <Heading>Key Type Definitions</Heading>
        <CodeBlock>{`PageId: text-to-image | image-edit | audio | 3d | auto-gen
        | history | settings | docs

GenerationType: image | edit | audio | 3d

ComfyServer: { id, name, url, enabled }

ServerStatus: { serverId, url, connected, gpus[], queueRemaining }

GpuInfo: { name, index, vramTotal, vramUsed, vramFree }`}</CodeBlock>

        <Heading>Adding a New Generation Type</Heading>
        <div className="space-y-1">
          <Li>Add workflow JSON to public/workflows/</Li>
          <Li>Add inject function in comfyClient.ts (e.g., injectNewTypeParams)</Li>
          <Li>Create page component in src/pages/</Li>
          <Li>Add route in App.tsx PageContent switch</Li>
          <Li>Add nav item in Sidebar.tsx NAV_ITEMS</Li>
          <Li>Add PageId variant in types/index.ts</Li>
        </div>
      </div>
    ),
  },
  {
    id: 'troubleshoot',
    title: 'Troubleshooting',
    icon: <AlertTriangle size={16} />,
    content: (
      <div>
        <Heading>Connection Issues</Heading>
        <SubHeading>Cannot reach ComfyUI</SubHeading>
        <div className="space-y-1">
          <Li>Verify ComfyUI is running: open http://localhost:8188 in your browser</Li>
          <Li>Check Settings page for the correct URL</Li>
          <Li>Ensure no firewall is blocking localhost connections</Li>
          <Li>If using a custom port, update the URL in Settings</Li>
          <Li>ComfyUI must be started with --listen 0.0.0.0 if accessing from another device</Li>
        </div>

        <SubHeading>Multi-server not connecting</SubHeading>
        <div className="space-y-1">
          <Li>Verify each server URL in Settings is correct and reachable</Li>
          <Li>Check the GPU Status panel for per-server connection status</Li>
          <Li>Ensure all servers have --listen 0.0.0.0 enabled</Li>
          <Li>The toggle switch must be enabled for each additional server</Li>
        </div>

        <Heading>Generation Failures</Heading>
        <SubHeading>Model not found</SubHeading>
        <div className="space-y-1">
          <Li>Download the required model and place it in ComfyUI/models/checkpoints/</Li>
          <Li>Default model: v1-5-pruned-emaonly.safetensors</Li>
          <Li>Restart ComfyUI after adding models</Li>
        </div>

        <SubHeading>Out of VRAM</SubHeading>
        <div className="space-y-1">
          <Li>Check the GPU Status panel to see current VRAM usage</Li>
          <Li>Reduce resolution (try 512x512)</Li>
          <Li>Lower the batch size</Li>
          <Li>Close other GPU-intensive applications</Li>
          <Li>Start ComfyUI with --lowvram or --cpu flag</Li>
          <Li>With multi-server setup, jobs auto-route to the least busy server</Li>
        </div>

        <SubHeading>Generation timeout</SubHeading>
        <div className="space-y-1">
          <Li>Default timeout is 10 minutes</Li>
          <Li>Complex workflows or high-res images may take longer</Li>
          <Li>Check ComfyUI console for error messages</Li>
        </div>

        <Heading>AI Assistant Issues</Heading>
        <SubHeading>Ollama not connecting</SubHeading>
        <div className="space-y-1">
          <Li>Ensure Ollama is running (ollama serve)</Li>
          <Li>If on a different machine, set the Ollama URL in Settings</Li>
          <Li>Click the refresh button next to the model dropdown to re-scan</Li>
          <Li>Ollama needs OLLAMA_ORIGINS=* environment variable for cross-origin requests</Li>
        </div>

        <Heading>Database Issues</Heading>
        <SubHeading>History not loading</SubHeading>
        <div className="space-y-1">
          <Li>Check browser console for database errors</Li>
          <Li>Try clearing IndexedDB storage in browser dev tools</Li>
          <Li>Try clearing localStorage and refreshing</Li>
        </div>

        <Heading>Performance Tips</Heading>
        <div className="space-y-1">
          <Li>Use a GPU with at least 6GB VRAM for best results</Li>
          <Li>Add multiple ComfyUI servers to distribute load across GPUs</Li>
          <Li>Keep ComfyUI and its dependencies updated</Li>
          <Li>Clear generation history periodically to keep the database lean</Li>
          <Li>Use lower step counts (15-20) for quick previews, higher (30-50) for final output</Li>
        </div>
      </div>
    ),
  },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState<DocSection>('usage');
  const section = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-white/5">
          <FileText size={20} className="text-white/60" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Documentation</h1>
          <p className="text-sm text-white/40">Guides for usage, architecture, workflows, and troubleshooting</p>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg w-fit flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
              activeSection === s.id
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {s.icon}
            {s.title}
          </button>
        ))}
      </div>

      <div className="p-6 bg-white/[0.03] border border-white/5 rounded-xl min-h-[400px]">
        <div className="flex items-center gap-2 mb-4 text-white/30 text-xs">
          <FileText size={12} />
          <span>docs</span>
          <ChevronRight size={12} />
          <span className="text-white/50">{section.title}</span>
        </div>
        {section.content}
      </div>
    </div>
  );
}
