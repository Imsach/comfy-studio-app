import { useState, useRef } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { improvePrompt } from '../services/aiPromptService';
import { useAppStore } from '../store/appStore';

interface ImprovePromptButtonProps {
  prompt: string;
  onImproved: (improved: string) => void;
  disabled?: boolean;
}

export default function ImprovePromptButton({ prompt, onImproved, disabled }: ImprovePromptButtonProps) {
  const [improving, setImproving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const settings = useAppStore((s) => s.settings);

  const isConfigured = settings.aiProvider === 'openai'
    ? !!settings.openaiApiKey
    : !!settings.ollamaModel;

  const handleImprove = async () => {
    if (!prompt.trim() || improving) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setImproving(true);
    try {
      const improved = await improvePrompt(prompt, controller.signal);
      onImproved(improved);
    } catch {
      // silently fail
    } finally {
      setImproving(false);
    }
  };

  if (!isConfigured || !prompt.trim()) return null;

  return (
    <button
      onClick={handleImprove}
      disabled={disabled || improving}
      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-amber-400 transition-all duration-200 disabled:opacity-30"
      title="Improve prompt with AI"
    >
      {improving ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
    </button>
  );
}
