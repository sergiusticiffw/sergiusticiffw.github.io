import { useCallback, useEffect, useRef, useState } from 'react';
import { getAiLanguage } from '../storage';

interface SpeechResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

const RecognitionImpl: RecognitionConstructor | undefined =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const SPEECH_LANGS: Record<string, string> = {
  Romanian: 'ro-RO',
  English: 'en-US',
  Russian: 'ru-RU',
};

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was denied.',
  'service-not-allowed': 'Microphone access was denied.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection.',
};

/**
 * Browser speech-to-text. `onText` receives the full transcript so far,
 * including words that are still being recognized.
 * `silenceMs` stops listening that long after the last word. 0 keeps the
 * browser's own end-of-speech pause.
 */
export function useSpeechInput(onText: (text: string) => void, silenceMs = 0) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const clearSilence = useCallback(() => {
    if (!silenceTimer.current) return;
    clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  }, []);

  useEffect(
    () => () => {
      clearSilence();
      recognitionRef.current?.abort();
    },
    [clearSilence]
  );

  const stop = useCallback(() => {
    clearSilence();
    recognitionRef.current?.stop();
  }, [clearSilence]);

  const start = useCallback(() => {
    if (!RecognitionImpl || recognitionRef.current) return;
    const recognition = new RecognitionImpl();
    recognition.lang = SPEECH_LANGS[getAiLanguage()] || navigator.language;
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onTextRef.current(`${finalText}${interim}`.trim());
      if (silenceMs > 0) {
        clearSilence();
        silenceTimer.current = setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            // Recognition already ended.
          }
        }, silenceMs);
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(ERROR_MESSAGES[event.error] || 'Voice input failed. Try again.');
      }
    };
    recognition.onend = () => {
      clearSilence();
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setError('');
    setListening(true);
    recognition.start();
  }, [clearSilence, silenceMs]);

  return { supported: !!RecognitionImpl, listening, error, start, stop };
}
