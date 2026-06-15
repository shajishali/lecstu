import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import api from '@services/api';

export type VoiceLanguage = 'en' | 'ta' | 'si';

const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'Tamil' },
  { value: 'si', label: 'Sinhala' },
];

export interface TranscriptionResult {
  text: string;
  confidence: number;
  latency_ms: number;
  engine: string;
}

interface VoiceInputProps {
  onTranscription: (result: TranscriptionResult) => void;
  onError?: (message: string) => void;
  language?: VoiceLanguage;
  engine?: 'whisper' | 'whisper-finetuned' | 'google' | 'azure';
  model?: 'tiny' | 'base' | 'small' | 'medium';
}

export default function VoiceInput({
  onTranscription,
  onError,
  language = 'en',
  engine = 'whisper',
  model = 'base',
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          onError?.('No audio recorded');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await sendForTranscription(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      onError?.('Microphone access denied or unavailable');
    }
  }, [language, engine, model, onError]);

  const sendForTranscription = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', language);
      formData.append('engine', engine);
      formData.append('model', model);

      const { data } = await api.post<{ success: boolean; data?: TranscriptionResult }>(
        '/ai/asr/transcribe',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        }
      );

      if (data.success && data.data) {
        onTranscription(data.data);
      } else {
        onError?.(data.data?.error || 'Transcription failed');
      }
    } catch (err: unknown) {
      let msg = 'Transcription failed';
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string; data?: { error?: string } } } })
          .response?.data;
        msg = res?.data?.error || res?.message || msg;
      }
      onError?.(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggle = () => {
    if (isProcessing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
          isRecording
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]'
        } ${isProcessing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <Loader2 size={28} className="animate-spin" />
        ) : isRecording ? (
          <Square size={28} fill="currentColor" />
        ) : (
          <Mic size={28} />
        )}
      </button>
      <p className="text-sm text-slate-500">
        {isRecording ? 'Recording... Click to stop' : isProcessing ? 'Processing...' : 'Click to speak'}
      </p>
      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <span
            key={lang.value}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              language === lang.value ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)]' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {lang.label}
          </span>
        ))}
      </div>
    </div>
  );
}
