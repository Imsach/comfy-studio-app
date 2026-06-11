import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, X, Send, Check, Loader2, Volume2, VolumeX } from 'lucide-react';
import { chatForPrompt, type ChatMessage } from '../services/aiPromptService';
import { useVoiceInput, isVoiceSupported } from '../hooks/useVoiceInput';
import { useAppStore } from '../store/appStore';

interface VoiceConversationProps {
  context: 'image' | 'edit' | 'audio';
  currentPrompt: string;
  onAccept: (prompt: string) => void;
  onClose: () => void;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CONTEXT_LABELS: Record<string, string> = {
  image: 'Text to Image',
  edit: 'Image Edit',
  audio: 'Audio Generation',
};

export default function VoiceConversation({ context, currentPrompt, onAccept, onClose }: VoiceConversationProps) {
  const settings = useAppStore((s) => s.settings);
  const isConfigured = settings.aiProvider === 'openai' ? !!settings.openaiApiKey : !!settings.ollamaModel;

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceSupported = isVoiceSupported();

  const speak = useCallback((text: string) => {
    if (!speakEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [speakEnabled]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || aiLoading) return;
    const userMsg: DisplayMessage = { role: 'user', content: text.trim() };
    const userChat: ChatMessage = { role: 'user', content: text.trim() };

    setMessages((prev) => [...prev, userMsg]);
    const newHistory = [...chatHistory, userChat];
    setChatHistory(newHistory);
    setInputText('');
    setAiLoading(true);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await chatForPrompt(context, newHistory, controller.signal);

      let displayText = response;
      let extracted: string | null = null;

      const finalMatch = response.match(/FINAL_PROMPT:\s*(.+)/s);
      if (finalMatch) {
        extracted = finalMatch[1].trim();
        displayText = response.replace(/FINAL_PROMPT:\s*.+/s, '').trim();
        if (!displayText) {
          displayText = `Here's your prompt: "${extracted}"`;
        }
      }

      const assistantMsg: DisplayMessage = { role: 'assistant', content: displayText };
      const assistantChat: ChatMessage = { role: 'assistant', content: response };

      setMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [...prev, assistantChat]);

      if (extracted) {
        setFinalPrompt(extracted);
      }

      speak(displayText);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg: DisplayMessage = {
          role: 'assistant',
          content: 'Sorry, I had trouble responding. Please try again.',
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setAiLoading(false);
    }
  }, [chatHistory, context, aiLoading, speak]);

  const handleVoiceTranscript = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const { listening, interim, toggle: toggleVoice } = useVoiceInput(handleVoiceTranscript);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiLoading]);

  useEffect(() => {
    if (!isConfigured) return;
    const greeting = currentPrompt.trim()
      ? `I see you're working on: "${currentPrompt.slice(0, 100)}". What would you like to change or add?`
      : `What kind of ${context === 'image' ? 'image' : context === 'edit' ? 'image edit' : 'music'} would you like to create? Describe your idea and I'll help refine it.`;

    const assistantMsg: DisplayMessage = { role: 'assistant', content: greeting };
    const assistantChat: ChatMessage = { role: 'assistant', content: greeting };
    setMessages([assistantMsg]);
    setChatHistory(currentPrompt.trim()
      ? [{ role: 'user', content: `My current prompt is: "${currentPrompt}"` }, assistantChat]
      : [assistantChat]
    );
    speak(greeting);

    return () => {
      window.speechSynthesis?.cancel();
      abortRef.current?.abort();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  if (!isConfigured) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
          <p className="text-sm text-white/60">Configure an AI provider in Settings to use voice conversation.</p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:text-white text-sm">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-[#12121a] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh] sm:max-h-[600px] shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-sm text-white/70 font-medium">Voice Chat</span>
            <span className="text-xs text-white/30">{CONTEXT_LABELS[context]}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSpeakEnabled(!speakEnabled);
                if (speakEnabled) {
                  window.speechSynthesis?.cancel();
                  setSpeaking(false);
                }
              }}
              className={`p-1.5 rounded-lg transition-all ${speakEnabled ? 'text-teal-400/70 hover:text-teal-400' : 'text-white/20 hover:text-white/40'}`}
              title={speakEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            >
              {speakEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-500/15 text-white/80 rounded-br-md'
                  : 'bg-white/5 text-white/70 rounded-bl-md'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {listening && interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm bg-cyan-500/10 text-cyan-400/60 italic border border-cyan-500/10">
                {interim}...
              </div>
            </div>
          )}
        </div>

        {finalPrompt && (
          <div className="mx-4 mb-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl animate-fade-in">
            <p className="text-[10px] text-teal-400/60 uppercase tracking-wider mb-1">Suggested Prompt</p>
            <p className="text-xs text-white/70 leading-relaxed mb-2">{finalPrompt}</p>
            <button
              onClick={() => onAccept(finalPrompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-medium hover:bg-teal-500/30 transition-all"
            >
              <Check size={12} />
              Use this prompt
            </button>
          </div>
        )}

        <div className="px-3 py-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                disabled={aiLoading}
                className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-200 ${
                  listening
                    ? 'bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10'
                    : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10'
                } disabled:opacity-40`}
                title={listening ? 'Stop listening' : 'Speak'}
              >
                {listening ? (
                  <div className="relative">
                    <MicOff size={18} />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  </div>
                ) : (
                  <Mic size={18} />
                )}
              </button>
            )}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? 'Listening...' : 'Type or speak...'}
                disabled={aiLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-50"
              />
              {speaking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className="w-0.5 bg-teal-400/60 rounded-full animate-pulse"
                        style={{ height: `${8 + n * 3}px`, animationDelay: `${n * 100}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || aiLoading}
              className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white disabled:opacity-30 hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/10"
            >
              {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          {listening && (
            <p className="text-[10px] text-red-400/50 mt-1.5 text-center">Recording -- speak now, then pause to send</p>
          )}
        </div>
      </div>
    </div>
  );
}
