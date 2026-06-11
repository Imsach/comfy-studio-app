import { useState, useRef, useEffect } from 'react';
import { Lightbulb, Loader2, X, RefreshCw, AlertCircle } from 'lucide-react';
import { generateSuggestions } from '../services/aiPromptService';
import { useAppStore } from '../store/appStore';

interface PromptSuggestionsProps {
  context: 'image' | 'edit' | 'audio';
  currentPrompt: string;
  onSelect: (suggestion: string) => void;
}

export default function PromptSuggestions({ context, currentPrompt, onSelect }: PromptSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const settings = useAppStore((s) => s.settings);

  const isConfigured = settings.aiProvider === 'openai'
    ? !!settings.openaiApiKey
    : !!settings.ollamaModel;

  const fetchSuggestions = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setSuggestions([]);

    try {
      const results = await generateSuggestions(context, currentPrompt, controller.signal);
      setSuggestions(results);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Failed to generate suggestions');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (open) {
      abortRef.current?.abort();
      setOpen(false);
      return;
    }
    setOpen(true);
    fetchSuggestions();
  };

  const handleSelect = (s: string) => {
    onSelect(s);
    setOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        abortRef.current?.abort();
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!isConfigured) {
    return (
      <button
        title="Configure AI in Settings to get prompt suggestions"
        className="p-2 rounded-lg bg-white/5 text-white/20 cursor-not-allowed"
        disabled
      >
        <Lightbulb size={16} />
      </button>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className={`p-2 rounded-lg transition-all duration-200 ${
          open
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-amber-400'
        }`}
        title="AI prompt suggestions"
      >
        <Lightbulb size={16} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[400px] max-w-[calc(100vw-2rem)] bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-[60] overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Lightbulb size={12} className="text-amber-400" />
              <span>
                AI Suggestions
                <span className="ml-1 text-white/30">
                  ({settings.aiProvider === 'ollama' ? settings.ollamaModel : settings.openaiModel})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchSuggestions}
                disabled={loading}
                className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
                <Loader2 size={16} className="animate-spin" />
                Generating suggestions...
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 text-xs text-red-300">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && suggestions.length === 0 && (
              <div className="py-6 text-center text-xs text-white/30">
                No suggestions generated
              </div>
            )}

            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
              >
                <span className="line-clamp-3">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
