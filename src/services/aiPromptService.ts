import type { AiProvider, AutoGenContentMode } from '../types';

function getSettings(): {
  comfyUrl: string;
  aiProvider: AiProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey: string;
  openaiModel: string;
} {
  try {
    const stored = localStorage.getItem('comfyui-app-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      const s = parsed?.state?.settings;
      if (s) {
        return {
          comfyUrl: (s.comfyUrl || 'http://localhost:8188').replace(/\/+$/, ''),
          aiProvider: s.aiProvider || 'ollama',
          ollamaUrl: (s.ollamaUrl || '').replace(/\/+$/, ''),
          ollamaModel: s.ollamaModel || '',
          openaiApiKey: s.openaiApiKey || '',
          openaiModel: s.openaiModel || 'gpt-4o-mini',
        };
      }
    }
  } catch {
    // fall through
  }
  return {
    comfyUrl: 'http://localhost:8188',
    aiProvider: 'ollama',
    ollamaUrl: '',
    ollamaModel: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
  };
}

function getOllamaBaseUrl(): string {
  const { ollamaUrl, comfyUrl } = getSettings();
  if (ollamaUrl) return ollamaUrl;
  try {
    const parsed = new URL(comfyUrl);
    return `${parsed.protocol}//${parsed.hostname}:11434`;
  } catch {
    return 'http://localhost:11434';
  }
}

function proxyFetch(path: string, targetUrl: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Comfy-Target', targetUrl);
  return fetch(`/comfyui-proxy${path}`, { ...init, headers });
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  const baseUrl = getOllamaBaseUrl();
  const res = await proxyFetch('/api/tags', baseUrl, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Failed to fetch Ollama models');
  const data = await res.json();
  return data.models || [];
}

const SYSTEM_PROMPTS: Record<string, string> = {
  image: `You are a creative prompt engineer for AI image generation. Given a user's rough idea or topic, generate 4 diverse, detailed text-to-image prompts. Each prompt should be vivid, specific, and describe visual elements like style, lighting, composition, colors, and mood. Return ONLY a JSON array of 4 strings, no other text.`,
  edit: `You are a creative image editing expert. Given a user's rough idea or no input, generate 4 diverse, specific image editing prompts. Each prompt should describe a clear transformation: background changes, style modifications, object additions/removals, color grading, or artistic effects. Return ONLY a JSON array of 4 strings, no other text.`,
  audio: `You are a creative prompt engineer for AI music generation. Given a user's rough idea or topic, generate 4 diverse music description prompts. Each prompt should include style/genre, mood, tempo, instruments, and atmosphere. Return ONLY a JSON array of 4 strings, no other text.`,
};

const LYRICS_SYSTEM_PROMPT = `You are a talented songwriter. Given the music style description (genre, mood, tempo, instruments, atmosphere), write song lyrics that match the vibe perfectly. Include verse/chorus structure using [Verse], [Chorus], [Bridge] markers. The lyrics should be creative, emotionally resonant, and fit the described musical style. Return ONLY the lyrics text, no explanation.`;

const AUTOGEN_SYSTEM_PROMPT = `You are a creative prompt engineer for AI image generation. Generate exactly ONE detailed text-to-image prompt. The prompt should be vivid, specific, and describe visual elements like style, lighting, composition, colors, and mood. Return ONLY the raw descriptive prompt text. Do NOT include any prefix like "Title:", "Prompt:", "Image:", "Description:", or "Here is". Do NOT return JSON, arrays, objects, or multiple prompts. Do NOT wrap in quotes. Do NOT add labels, headings, or numbering. Just output one single descriptive prompt and nothing else.`;

const IMPROVE_SYSTEM_PROMPT = `You are a prompt engineering expert. Take the given prompt and improve it by making it more detailed, vivid, and specific. Add visual details like lighting, composition, textures, colors, mood, and artistic style. Keep the core idea the same but enhance it significantly. Return ONLY the improved prompt as plain text. Do NOT return JSON, do NOT wrap in quotes, do NOT add explanations.`;

const AUDIO_AUTOGEN_SYSTEM_PROMPT = `You are a creative music prompt engineer. Given an image description, generate a short music description with tags for AI music generation. Be creative and varied - do NOT always use the same genre. Pick from diverse genres like: lofi hip hop, ambient, jazz, classical piano, synthwave, chillwave, acoustic folk, dream pop, downtempo, trip hop, bossa nova, minimal techno, post-rock, shoegaze, neo-soul, cinematic orchestral. Match the mood and atmosphere of the image. Format as tag lines: style, mood, tempo, instruments. Return ONLY the tags, no explanations. Keep it under 200 characters.`;

export async function generateSuggestions(
  context: 'image' | 'edit' | 'audio',
  userInput: string,
  signal?: AbortSignal
): Promise<string[]> {
  const settings = getSettings();
  const systemPrompt = SYSTEM_PROMPTS[context];
  const userPrompt = userInput.trim()
    ? `Generate 4 creative prompts inspired by: "${userInput}"`
    : `Generate 4 creative and diverse ${context === 'image' ? 'text-to-image' : context === 'edit' ? 'image editing' : 'music generation'} prompts on random interesting topics`;

  if (settings.aiProvider === 'openai') {
    return generateOpenAI(systemPrompt, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  }
  return generateOllama(systemPrompt, userPrompt, settings.ollamaModel, signal);
}

const TRENDING_SYSTEM_PROMPT = `You are a creative prompt engineer who follows current art trends, viral aesthetics, and popular visual styles. Generate exactly ONE detailed text-to-image prompt based on what is currently trending in digital art, social media aesthetics, and visual culture. Think about styles like: trending AI art styles, popular photography aesthetics, viral visual trends, contemporary art movements. Return ONLY the raw descriptive prompt text. Do NOT include any prefix like "Title:", "Prompt:", "Image:", or "Description:". Do NOT return JSON, arrays, or wrap in quotes. No labels or headings.`;

const NEWS_SYSTEM_PROMPT = `You are a creative prompt engineer who transforms current events and news topics into beautiful art. Generate exactly ONE detailed text-to-image prompt inspired by recent world events, scientific discoveries, cultural moments, or seasonal topics. Transform news into visually compelling art concepts. Return ONLY the raw descriptive prompt text. Do NOT include any prefix like "Title:", "Prompt:", "Image:", or "Description:". Do NOT return JSON, arrays, or wrap in quotes. No labels or headings.`;

const CATEGORY_SYSTEM_PROMPT = `You are a creative prompt engineer specializing in diverse visual categories. Generate exactly ONE detailed text-to-image prompt for the given category. The prompt should be vivid, specific, and describe visual elements like style, lighting, composition, colors, and mood. Return ONLY the raw descriptive prompt text. Do NOT include any prefix like "Title:", "Prompt:", "Image:", or "Description:". Do NOT return JSON, arrays, or wrap in quotes. No labels or headings.`;

export async function generateAutoGenPrompt(
  theme: string,
  signal?: AbortSignal,
  contentMode?: AutoGenContentMode,
  categories?: string[]
): Promise<string> {
  const settings = getSettings();
  const mode = contentMode || 'creative';

  let systemPrompt = AUTOGEN_SYSTEM_PROMPT;
  let userPrompt: string;

  switch (mode) {
    case 'trending':
      systemPrompt = TRENDING_SYSTEM_PROMPT;
      userPrompt = theme.trim()
        ? `Generate one trending-style text-to-image prompt with the theme: "${theme}". Focus on current art trends and popular aesthetics.`
        : `Generate one text-to-image prompt based on the latest trending visual styles and aesthetics.`;
      break;
    case 'news':
      systemPrompt = NEWS_SYSTEM_PROMPT;
      userPrompt = theme.trim()
        ? `Generate one news-inspired text-to-image prompt with the theme: "${theme}". Transform it into visually compelling art.`
        : `Generate one text-to-image prompt inspired by recent world events, discoveries, or cultural moments.`;
      break;
    case 'categories': {
      systemPrompt = CATEGORY_SYSTEM_PROMPT;
      const pool = categories?.length ? categories : ['nature', 'sci-fi', 'fantasy', 'portraits', 'architecture'];
      const picked = pool[Math.floor(Math.random() * pool.length)];
      userPrompt = theme.trim()
        ? `Generate one creative text-to-image prompt in the category "${picked}" with the theme: "${theme}".`
        : `Generate one creative and detailed text-to-image prompt in the category: "${picked}".`;
      break;
    }
    default:
      userPrompt = theme.trim()
        ? `Generate one creative text-to-image prompt inspired by the theme: "${theme}"`
        : `Generate one creative and unique text-to-image prompt on a random interesting topic`;
      break;
  }

  let raw: string;
  if (settings.aiProvider === 'openai') {
    raw = await generateOpenAIText(systemPrompt, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  } else {
    raw = await generateOllamaText(systemPrompt, userPrompt, settings.ollamaModel, signal);
  }
  return cleanSinglePrompt(raw);
}

export async function improvePrompt(
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  const userPrompt = `Improve this prompt: "${prompt}"`;

  let raw: string;
  if (settings.aiProvider === 'openai') {
    raw = await generateOpenAIText(IMPROVE_SYSTEM_PROMPT, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  } else {
    raw = await generateOllamaText(IMPROVE_SYSTEM_PROMPT, userPrompt, settings.ollamaModel, signal);
  }
  return cleanSinglePrompt(raw);
}

export async function generateLyrics(
  styleDescription: string,
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  const userPrompt = styleDescription.trim()
    ? `Write lyrics for a song with this style: ${styleDescription}`
    : `Write lyrics for an interesting and creative song in any genre`;

  if (settings.aiProvider === 'openai') {
    return generateOpenAIText(LYRICS_SYSTEM_PROMPT, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  }
  return generateOllamaText(LYRICS_SYSTEM_PROMPT, userPrompt, settings.ollamaModel, signal);
}

const AUTOGEN_LYRICS_SYSTEM_PROMPT = `You are a talented songwriter. Write song lyrics that match the given context. Include verse/chorus structure using [Verse], [Chorus], [Bridge] markers. The lyrics should be creative, emotionally resonant, and musically singable. Return ONLY the lyrics text, no explanation or meta-text.`;

export async function generateAutoGenLyrics(
  context: string,
  mode: 'genre' | 'image-prompt',
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  const userPrompt = mode === 'genre'
    ? `Write lyrics for a ${context} song. Match the energy and themes typical of the genre.`
    : `Write lyrics inspired by this visual scene: "${context.slice(0, 200)}". Capture the mood and atmosphere.`;

  if (settings.aiProvider === 'openai') {
    return generateOpenAIText(AUTOGEN_LYRICS_SYSTEM_PROMPT, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  }
  return generateOllamaText(AUTOGEN_LYRICS_SYSTEM_PROMPT, userPrompt, settings.ollamaModel, signal);
}

export async function generateAutoGenAudioPrompt(
  imagePrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  const userPrompt = `Generate music tags inspired by this image: "${imagePrompt.slice(0, 150)}"`;

  let raw: string;
  if (settings.aiProvider === 'openai') {
    raw = await generateOpenAIText(AUDIO_AUTOGEN_SYSTEM_PROMPT, userPrompt, settings.openaiApiKey, settings.openaiModel, signal);
  } else {
    raw = await generateOllamaText(AUDIO_AUTOGEN_SYSTEM_PROMPT, userPrompt, settings.ollamaModel, signal);
  }
  return raw.trim();
}

const VOICE_CHAT_SYSTEM_PROMPTS: Record<string, string> = {
  image: `You are a helpful creative assistant guiding the user to build an ideal text-to-image prompt. Ask clarifying questions about subject, style, mood, lighting, colors, composition. Keep responses concise (2-3 sentences max). When the user seems satisfied, output the final prompt prefixed with "FINAL_PROMPT:" on its own line. Do not use markdown formatting.`,
  edit: `You are a helpful assistant guiding the user to describe an image edit. Ask about what they want changed: style, objects, background, colors, effects. Keep responses concise (2-3 sentences max). When the user seems satisfied, output the final edit instruction prefixed with "FINAL_PROMPT:" on its own line. Do not use markdown formatting.`,
  audio: `You are a helpful assistant guiding the user to describe music they want to generate. Ask about genre, mood, tempo, instruments, and atmosphere. Keep responses concise (2-3 sentences max). When the user seems satisfied, output the final music description prefixed with "FINAL_PROMPT:" on its own line. Do not use markdown formatting.`,
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatForPrompt(
  context: 'image' | 'edit' | 'audio',
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings();
  const systemMsg: ChatMessage = { role: 'system', content: VOICE_CHAT_SYSTEM_PROMPTS[context] };
  const allMessages = [systemMsg, ...messages];

  if (settings.aiProvider === 'openai') {
    return chatOpenAI(allMessages, settings.openaiApiKey, settings.openaiModel, signal);
  }
  return chatOllama(allMessages, settings.ollamaModel, signal);
}

async function chatOllama(
  messages: ChatMessage[],
  model: string,
  signal?: AbortSignal
): Promise<string> {
  if (!model) throw new Error('No Ollama model selected.');
  const baseUrl = getOllamaBaseUrl();
  const res = await proxyFetch('/api/chat', baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });
  if (!res.ok) throw new Error('Ollama chat error');
  const data = await res.json();
  return (data.message?.content || '').trim();
}

async function chatOpenAI(
  messages: ChatMessage[],
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API key not set.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
    signal,
  });
  if (!res.ok) throw new Error('OpenAI chat error');
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

function stripMetaPrefixes(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/^(title|prompt|image|description|output|result|here\s*is|generated\s*prompt)\s*[:：]\s*/i, '');
  cleaned = cleaned.replace(/^["'""'']+|["'""'']+$/g, '');
  cleaned = cleaned.replace(/^\*{1,2}(.+?)\*{1,2}$/, '$1');
  return cleaned.trim();
}

function cleanSinglePrompt(raw: string): string {
  let text = raw.trim();

  text = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') return stripMetaPrefixes(parsed.trim());
    if (Array.isArray(parsed)) {
      const first = parsed.find((s: unknown) => typeof s === 'string' && s.trim());
      if (first) return stripMetaPrefixes(first.trim());
    }
    if (parsed && typeof parsed === 'object') {
      const vals = Object.values(parsed);
      const firstStr = vals.find((v): v is string => typeof v === 'string' && v.trim().length > 10);
      if (firstStr) return stripMetaPrefixes(firstStr.trim());
      if (Array.isArray(vals[0])) {
        const firstItem = (vals[0] as string[]).find((s) => typeof s === 'string' && s.trim());
        if (firstItem) return stripMetaPrefixes(firstItem.trim());
      }
    }
  } catch {
    // not JSON, use as-is
  }

  text = text.replace(/^["']+|["']+$/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const contentLines = lines.filter(l => {
    const lower = l.toLowerCase();
    if (/^(title|prompt|image|description|output|result)\s*[:：]/i.test(l)) return false;
    if (lower === 'prompt' || lower === 'title' || lower === 'image') return false;
    return true;
  });

  if (contentLines.length > 0) {
    let best = contentLines[0];
    best = best.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s+/, '');
    return stripMetaPrefixes(best);
  }

  return stripMetaPrefixes(text);
}

async function generateOllama(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (!model) throw new Error('No Ollama model selected. Please choose one in Settings.');
  const baseUrl = getOllamaBaseUrl();
  const res = await proxyFetch('/api/chat', baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      format: 'json',
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error: ${text || res.statusText}`);
  }

  const data = await res.json();
  return parseAiResponse(data.message?.content || '');
}

async function generateOllamaText(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  if (!model) throw new Error('No Ollama model selected. Please choose one in Settings.');
  const baseUrl = getOllamaBaseUrl();
  const res = await proxyFetch('/api/chat', baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error: ${text || res.statusText}`);
  }

  const data = await res.json();
  return (data.message?.content || '').trim();
}

async function generateOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (!apiKey) throw new Error('OpenAI API key not set. Please add it in Settings.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error: ${text || res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseAiResponse(content);
}

async function generateOpenAIText(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API key not set. Please add it in Settings.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1500,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error: ${text || res.statusText}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

function parseAiResponse(content: string): string[] {
  const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((s: unknown) => typeof s === 'string' && s.trim()).slice(0, 6);
    }
    if (parsed && typeof parsed === 'object') {
      const vals = Object.values(parsed);
      if (Array.isArray(vals[0])) {
        return (vals[0] as string[]).filter((s) => typeof s === 'string' && s.trim()).slice(0, 6);
      }
      const stringVals = vals.filter((v): v is string => typeof v === 'string' && v.trim().length > 10);
      if (stringVals.length > 0) return stringVals.slice(0, 6);
    }
  } catch {
    // try line-by-line
  }

  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((l) => l.length > 10);

  if (lines.length > 0) return lines.slice(0, 6);

  throw new Error('Could not parse AI response');
}
