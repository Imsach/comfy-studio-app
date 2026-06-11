import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function isVoiceSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) {
        callbackRef.current(finalText);
        setInterim('');
      } else {
        setInterim(interimText);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('Speech recognition error:', e.error);
      }
      setListening(false);
      setInterim('');
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { listening, interim, start, stop, toggle };
}
