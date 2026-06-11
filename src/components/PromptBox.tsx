import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Dice5, Mic, MicOff, MessageCircle } from 'lucide-react';
import PromptSuggestions from './PromptSuggestions';
import ImprovePromptButton from './ImprovePromptButton';
import VoiceConversation from './VoiceConversation';
import { useVoiceInput, isVoiceSupported } from '../hooks/useVoiceInput';

interface PromptBoxProps {
  onSubmit: (prompt: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showRandomSeed?: boolean;
  onRandomSeed?: () => void;
  suggestionContext?: 'image' | 'edit' | 'audio';
  onPromptChange?: (prompt: string) => void;
}

export default function PromptBox({
  onSubmit,
  loading = false,
  disabled = false,
  placeholder = 'Describe what you want to create...',
  showRandomSeed = false,
  onRandomSeed,
  suggestionContext,
  onPromptChange,
}: PromptBoxProps) {
  const [prompt, setPrompt] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const voiceSupported = isVoiceSupported();

  const updatePrompt = useCallback((value: string) => {
    setPrompt(value);
    onPromptChange?.(value);
  }, [onPromptChange]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setPrompt((prev) => {
      const next = prev ? `${prev} ${text}` : text;
      onPromptChange?.(next);
      return next;
    });
  }, [onPromptChange]);

  const { listening, interim, toggle: toggleVoice } = useVoiceInput(handleVoiceTranscript);

  const handleSubmit = useCallback(() => {
    if (!prompt.trim() || loading || disabled) return;
    onSubmit(prompt.trim());
  }, [prompt, loading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => updatePrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={loading || disabled}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 backdrop-blur-sm disabled:opacity-50"
        />
        {listening && interim && (
          <div className="absolute bottom-1 left-3 right-3 text-xs text-cyan-400/60 italic truncate pointer-events-none">
            {interim}...
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ImprovePromptButton
            prompt={prompt}
            onImproved={updatePrompt}
            disabled={loading || disabled}
          />
          {suggestionContext && (
            <PromptSuggestions
              context={suggestionContext}
              currentPrompt={prompt}
              onSelect={updatePrompt}
            />
          )}
          {showRandomSeed && onRandomSeed && (
            <button
              onClick={onRandomSeed}
              disabled={loading || disabled}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all duration-200"
              title="Random seed"
            >
              <Dice5 size={16} />
            </button>
          )}
          {voiceSupported && (
            <>
              <button
                onClick={toggleVoice}
                disabled={disabled}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  listening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                }`}
                title={listening ? 'Stop listening' : 'Voice input'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {suggestionContext && (
                <button
                  onClick={() => setShowVoiceChat(true)}
                  disabled={loading || disabled}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-teal-400 transition-all duration-200"
                  title="Voice conversation - talk to AI about your prompt"
                >
                  <MessageCircle size={16} />
                </button>
              )}
            </>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading || disabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-cyan-500/20 flex-shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          <span className="hidden sm:inline">{loading ? 'Generating' : 'Generate'}</span>
        </button>
      </div>
      {showVoiceChat && suggestionContext && (
        <VoiceConversation
          context={suggestionContext}
          currentPrompt={prompt}
          onAccept={(finalPrompt) => {
            updatePrompt(finalPrompt);
            setShowVoiceChat(false);
          }}
          onClose={() => setShowVoiceChat(false)}
        />
      )}
    </div>
  );
}
