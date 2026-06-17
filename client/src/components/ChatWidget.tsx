/**
 * LECSTU Chat Widget
 * Floating chat bubble connecting to Rasa REST API.
 * Supports text and voice input.
 * English: Web Speech API (instant, built-in). Tamil/Sinhala: ASR (Whisper tiny).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Minimize2, Send, Mic, Square, Loader2 } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import type { UiLanguage } from '@store/languageStore';
import { useTranslation } from '@hooks/useTranslation';
import api from '@services/api';
import ChatBotMessage from '@components/ChatBotMessage';

const RASA_WEBHOOK =
  import.meta.env.VITE_RASA_WEBHOOK || '/rasa/webhooks/rest/webhook';

const MIN_RECORDING_MS = 500; // Avoid sending empty/short clips

type ChatLanguage = UiLanguage;

const CHAT_LANG_LABELS: Record<ChatLanguage, string> = {
  en: 'English',
  ta: 'Tamil',
  si: 'Sinhala',
};

const CHAT_PLACEHOLDERS: Record<ChatLanguage, string> = {
  en: 'Type in English or tap the mic…',
  ta: 'Type in Tamil or tap the mic…',
  si: 'Type in Sinhala or tap the mic…',
};

// Web Speech API: instant transcription for English (Chrome, Edge, Safari)
const SpeechRecognitionClass =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
    : null;

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatWidget() {
  const { user } = useAuthStore();
  const { translate } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [chatLanguage, setChatLanguage] = useState<ChatLanguage>('en');
  const [asrAvailable, setAsrAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const transcriptRef = useRef<string>('');
  const recordingStartRef = useRef<number>(0);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen || !user) return;
    api
      .get<{ success: boolean; data?: { available?: boolean } }>('/ai/asr/status')
      .then((r) => setAsrAvailable(r.data.data?.available ?? false))
      .catch(() => setAsrAvailable(false));
  }, [isOpen, user]);

  const senderId = user?.id ?? `guest_${Date.now()}`;

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input.trim()).trim();
      if (!text || isTyping) return;

      setInput('');
      setError(null);

      const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Tamil/Sinhala: translate user input to English so Rasa can understand
      let messageToSend = text;
      if (chatLanguage !== 'en') {
        messageToSend = await translate(text, 'en', chatLanguage);
      }

      const res = await fetch(RASA_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: senderId,
          message: messageToSend,
          metadata: user ? { user_id: user.id } : {},
        }),
        signal: AbortSignal.timeout(90000),
      });

      const isProxyOrServerError = res.status >= 500 && res.status < 600;
      if (!res.ok) {
        throw new Error(
          isProxyOrServerError
            ? 'Chatbot is starting or temporarily unavailable. Please try again in a moment.'
            : `Error ${res.status}`
        );
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error('Invalid response from chatbot. Please try again.');
      }
      const botTexts = Array.isArray(data)
        ? data
            .filter((m: { text?: string }) => m.text)
            .map((m: { text: string }) => m.text)
        : [];

      if (botTexts.length === 0) {
        botTexts.push("I didn't get a response. Try rephrasing or check if the chatbot is running.");
      }

      // Translate bot responses when chat language is Tamil or Sinhala
      let displayTexts = botTexts;
      if (chatLanguage !== 'en') {
        displayTexts = await Promise.all(
          botTexts.map((t) => translate(t, chatLanguage, 'en'))
        );
      }

      const botMsgs: ChatMessage[] = displayTexts.map((t: string, i: number) => ({
        id: `b-${Date.now()}-${i}`,
        text: t,
        isUser: false,
        timestamp: new Date(),
      }));
      setMessages((prev) => [...prev, ...botMsgs]);

      api.post('/ai/chatbot/track', { userMessage: text, botResponse: botTexts }).catch(() => {});
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to send message.';
      const isNetworkError =
        /fetch|network|connection|refused|ECONNREFUSED/i.test(rawMsg);
      const msg = isNetworkError
        ? 'Chatbot is starting or unavailable. Please try again in a moment.'
        : rawMsg;
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          text: msg,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  },
    [input, isTyping, senderId, user, chatLanguage, translate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const useWebSpeech = chatLanguage === 'en' && !!SpeechRecognitionClass;

  const sendForTranscription = useCallback(
    async (blob: Blob) => {
      setIsVoiceProcessing(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('language', chatLanguage);
        formData.append('engine', 'whisper');
        formData.append('model', 'tiny'); // tiny = 3-5x faster than base

        const { data } = await api.post<{ success: boolean; data?: { text?: string }; message?: string }>(
          '/ai/asr/transcribe',
          formData,
          { timeout: 60000 }
        );

        const text = data.data?.text?.trim();
        if (data.success && text) {
          await sendMessage(text);
        } else {
          const serverMsg = (data as { data?: { error?: string } }).data?.error || data.message;
          setError(
            serverMsg || 'Could not transcribe. Speak clearly, try Tamil/Sinhala, or type your message.'
          );
        }
      } catch (err: unknown) {
        let msg =
          chatLanguage === 'en'
            ? 'Voice needs the ASR service. Run: npm run asr (in a separate terminal), then set ASR_USE_HTTP=true in server .env. Or type your message.'
            : 'Tamil/Sinhala voice needs the ASR service. Run: npm run asr, then set ASR_USE_HTTP=true in server .env. Or type your message.';
        if (err && typeof err === 'object' && 'response' in err) {
          const res = (err as { response?: { data?: { message?: string; data?: { error?: string } } } })
            .response?.data;
          const serverMsg = res?.data?.error || res?.message;
          if (serverMsg) msg = serverMsg;
        }
        setError(msg);
        setTimeout(() => setError(null), 6000);
      } finally {
        setIsVoiceProcessing(false);
      }
    },
    [chatLanguage, sendMessage]
  );

  const selectChatLanguage = useCallback(
    (lang: ChatLanguage) => {
      if (lang === chatLanguage) return;
      if (isRecording) {
        if (useWebSpeech && recognitionRef.current) {
          recognitionRef.current.stop();
        } else {
          stopRecording();
        }
        setIsRecording(false);
        setIsVoiceProcessing(false);
      }
      setChatLanguage(lang);
      setError(null);
    },
    [chatLanguage, isRecording, useWebSpeech, stopRecording]
  );

  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceProcessing || isTyping) return;
    if (isRecording) {
      setIsRecording(false);
      if (useWebSpeech && recognitionRef.current) {
        recognitionRef.current.stop();
      } else {
        stopRecording();
      }
      return;
    }

    if (useWebSpeech) {
      // Web Speech API: instant, no server (English only)
      try {
        transcriptRef.current = '';
        const Recognition = SpeechRecognitionClass!;
        const recognition = new Recognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (e: SpeechRecognitionEvent) => {
          const last = e.results[e.results.length - 1];
          transcriptRef.current = last[0].transcript;
        };
        recognition.onend = () => {
          recognitionRef.current = null;
          setIsRecording(false);
          setIsVoiceProcessing(false);
          const text = transcriptRef.current.trim();
          if (text) {
            sendMessage(text);
          } else {
            setError('No speech detected. Speak clearly and try again.');
          }
        };
        recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
          recognitionRef.current = null;
          setIsRecording(false);
          setIsVoiceProcessing(false);
          if (e.error !== 'aborted' && e.error !== 'no-speech') {
            setError('Voice recognition failed. Try typing or use ASR (Tamil/Sinhala).');
          }
        };
        setIsVoiceProcessing(true);
        setIsRecording(true);
        setError(null);
        recognition.start();
      } catch {
        setError('Voice recognition not supported. Use English or type your message.');
      }
      return;
    }

    // ASR path (Tamil/Sinhala or fallback)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Date.now() - recordingStartRef.current;
        if (chunksRef.current.length > 0 && duration >= MIN_RECORDING_MS) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          await sendForTranscription(blob);
        } else {
          setError(duration < MIN_RECORDING_MS ? 'Speak for at least half a second.' : 'No audio recorded.');
          setIsVoiceProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone access denied. Please allow microphone or type your message.');
    }
  }, [
    isRecording,
    isVoiceProcessing,
    isTyping,
    useWebSpeech,
    stopRecording,
    sendForTranscription,
    sendMessage,
  ]);

  if (!user) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((o) => !o);
          if (isOpen) setError(null);
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)] focus:ring-[var(--color-primary)]"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat window: taller, narrower; smaller on mobile to avoid overlapping dashboard */}
      {isOpen && (
        <div
          className={`fixed right-3 bottom-20 z-40 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all md:right-6 ${
            isMinimized
              ? 'h-12 w-72'
              : 'h-[340px] w-[300px] md:h-[560px] md:w-[320px]'
          }`}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-white [background-color:var(--color-primary)]">
                <MessageSquare size={16} />
              </div>
              <span className="font-semibold text-slate-800">LECSTU Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized((m) => !m)}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Minimize2 size={18} />
            </button>
          </header>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-500">
                    Choose <strong>English</strong>, <strong>Tamil</strong>, or <strong>Sinhala</strong> below, then type
                    or use the microphone. Ask about today&apos;s classes, room directions, timetables, halls, or
                    appointments.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        m.isUser
                          ? 'text-white [background-color:var(--color-primary)]'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {m.isUser ? m.text : <ChatBotMessage text={m.text} />}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex gap-1 rounded-2xl bg-slate-100 px-4 py-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-slate-200 p-3">
                <div className="mb-2">
                  <p className="mb-1.5 text-xs font-medium text-slate-600">Chat language</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['en', 'ta', 'si'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => selectChatLanguage(lang)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          chatLanguage === lang
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {CHAT_LANG_LABELS[lang]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {chatLanguage === 'en' && SpeechRecognitionClass
                      ? 'English: type or instant voice (browser).'
                      : chatLanguage === 'en'
                        ? 'English: type or voice via Whisper.'
                        : `${CHAT_LANG_LABELS[chatLanguage]}: type or record voice${
                            asrAvailable === false ? ' (ASR service required for voice)' : ''
                          }.`}
                  </p>
                </div>
                {error && (
                  <p className="mb-2 text-xs text-red-500">{error}</p>
                )}
                {(isRecording || isVoiceProcessing) && (
                  <p className="mb-2 text-xs text-slate-500">
                    {isRecording
                      ? useWebSpeech
                        ? `Listening (${CHAT_LANG_LABELS[chatLanguage]})… Click mic when done`
                        : `Recording (${CHAT_LANG_LABELS[chatLanguage]})… Click mic to stop`
                      : `Transcribing (${CHAT_LANG_LABELS[chatLanguage]})…`}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={CHAT_PLACEHOLDERS[chatLanguage]}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    disabled={isTyping || isVoiceProcessing}
                  />
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    disabled={isTyping}
                    className={`flex items-center justify-center rounded-lg px-3 py-2 transition-colors ${
                      isRecording
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    } disabled:opacity-50`}
                    aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                  >
                    {isVoiceProcessing ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : isRecording ? (
                      <Square size={18} fill="currentColor" />
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isTyping}
                    className="flex items-center justify-center rounded-lg px-4 py-2 text-white transition-colors disabled:opacity-50 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
