/**
 * LECSTU Chat Widget
 * Floating chat bubble connecting to Rasa REST API.
 * Supports text and voice input.
 * Voice: live words in the input while speaking (browser speech when available,
 * otherwise Whisper with periodic updates). User edits, then Enter/Send.
 */
import { useState, useRef, useEffect, useCallback, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { MessageSquare, X, Minimize2, Send, Mic, Square, Loader2 } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import type { UiLanguage } from '@store/languageStore';
import { useTranslation } from '@hooks/useTranslation';
import api from '@services/api';
import ChatBotMessage from '@components/ChatBotMessage';

const RASA_WEBHOOK =
  import.meta.env.VITE_RASA_WEBHOOK || '/rasa/webhooks/rest/webhook';

const MIN_RECORDING_MS = 500; // Avoid sending empty/short clips
/** How often to refresh the live Whisper transcript while recording (any browser). */
const LIVE_WHISPER_MS = 2200;
const MD_BREAKPOINT = 768;
const SIZE_STORAGE_KEY = 'lecstu-chat-widget-size';
const MIN_CHAT_W = 280;
const MIN_CHAT_H = 300;
const FAB_CLEARANCE = 88; // space above floating open/close button
const EDGE_GAP = 12;
/** Match Layout.tsx: sidebar w-[250px], header h-14 */
const SIDEBAR_WIDTH = 250;
const TOP_NAV_HEIGHT = 56;
const CONTENT_INSET = 8; // small gap from sidebar / top nav

type ChatSize = { width: number; height: number };

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < MD_BREAKPOINT;
}

/** Max size so the panel stays inside the main content square (not over sidebar or top nav). */
function getChatMaxSize(): ChatSize {
  if (typeof window === 'undefined') return { width: 360, height: 560 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftReserve = vw >= MD_BREAKPOINT ? SIDEBAR_WIDTH + CONTENT_INSET : EDGE_GAP;
  const topReserve = TOP_NAV_HEIGHT + CONTENT_INSET;
  return {
    width: Math.max(MIN_CHAT_W, vw - EDGE_GAP - leftReserve),
    height: Math.max(MIN_CHAT_H, vh - FAB_CLEARANCE - topReserve),
  };
}

/** Standard starting size: near full-width on phones, fixed panel on desktop. */
function getDefaultChatSize(): ChatSize {
  if (typeof window === 'undefined') return { width: 360, height: 560 };
  const max = getChatMaxSize();
  if (window.innerWidth < MD_BREAKPOINT) {
    return {
      width: max.width,
      height: Math.min(Math.round(window.innerHeight * 0.52), max.height),
    };
  }
  return clampChatSize(360, 560);
}

function clampChatSize(width: number, height: number): ChatSize {
  const max = getChatMaxSize();
  return {
    width: Math.min(Math.max(width, MIN_CHAT_W), max.width),
    height: Math.min(Math.max(height, MIN_CHAT_H), max.height),
  };
}

function loadStoredChatSize(): ChatSize | null {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mobile?: ChatSize; desktop?: ChatSize };
    const key = isMobileViewport() ? 'mobile' : 'desktop';
    const saved = parsed[key];
    if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return null;
    return clampChatSize(saved.width, saved.height);
  } catch {
    return null;
  }
}

function persistChatSize(size: ChatSize) {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as { mobile?: ChatSize; desktop?: ChatSize }) : {};
    const key = isMobileViewport() ? 'mobile' : 'desktop';
    localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify({ ...prev, [key]: size }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Rewrite messy timetable phrasing so NLU matches trained examples (works before model retrain). */
function normalizeTimetableMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  // Drop casual openers so intent classification focuses on the ask
  const withoutGreeting = trimmed
    .replace(/^(?:hi|hello|hey|please)[,\s]+/i, '')
    .trim();
  const lower = withoutGreeting.toLowerCase();
  const isTimetableAsk =
    /\b(time\s*table|timetable|schedule)\b/i.test(withoutGreeting) ||
    (/\btable\b/i.test(withoutGreeting) &&
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i.test(
        withoutGreeting
      )) ||
    (/\b(my\s+classes|what\s+classes)\b/i.test(withoutGreeting) &&
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        withoutGreeting
      ));
  if (!isTimetableAsk) return trimmed;

  const dayMatch = lower.match(
    /\b(?:the\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tomorrows|today's)\b/
  );
  if (dayMatch) {
    let day = dayMatch[1].replace(/'s$/, '');
    if (day.startsWith('tomorrow')) day = 'tomorrow';
    if (day.startsWith('today')) day = 'today';
    return `What is my timetable for ${day}`;
  }
  return `What is my timetable`;
}

type ChatLanguage = UiLanguage;

const CHAT_LANG_LABELS: Record<ChatLanguage, string> = {
  en: 'English',
  ta: 'Tamil',
  si: 'Sinhala',
};

/** Tamil/Sinhala chat still has quality issues; shown but not selectable. */
const CHAT_LANG_FUTURE_WORK: ReadonlySet<ChatLanguage> = new Set(['ta', 'si']);

const CHAT_PLACEHOLDERS: Record<ChatLanguage, string> = {
  en: 'Type in English or tap the mic…',
  ta: 'Type in Tamil or tap the mic…',
  si: 'Type in Sinhala or tap the mic…',
};

// Web Speech API: instant transcription for English (Chrome, Edge, Safari)
function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function micErrorMessage(err: unknown): string {
  const name =
    err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Chrome blocked the mic. Click the lock icon in the address bar → Site settings → Microphone → Allow, then refresh.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone found. In Windows Sound settings set your laptop mic as Default input, then refresh Chrome.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'Mic is busy or still linked to the old earphone. Unplug the headset, set the laptop mic as Default input in Windows Sound, close other apps using the mic, then refresh Chrome.';
  }
  return 'Could not open the microphone. After unplugging earphones, set the laptop mic as Default in Windows Sound, allow mic in Chrome, refresh, then try again. Or type your message.';
}

/** Prefer laptop/built-in mic so Chrome does not stick to an unplugged headset. */
async function getPreferredMicStream(): Promise<MediaStream> {
  const baseAudio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  // Permission + fresh device list (needed after hot-plug)
  let inputs: MediaDeviceInfo[] = [];
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());
    inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  } catch (err) {
    // Fall through; final getUserMedia will surface a clear error
    throw err;
  }

  const notHeadset = (label: string) =>
    !/headset|headphone|earphone|earbuds|airpods|bluetooth/i.test(label);
  const looksBuiltIn = (label: string) =>
    /microphone|internal|array|realtek|laptop|built.?in|default/i.test(label);

  const preferred =
    inputs.find((d) => looksBuiltIn(d.label) && notHeadset(d.label)) ||
    inputs.find((d) => notHeadset(d.label) && d.label.trim()) ||
    inputs.find((d) => d.deviceId === 'default') ||
    inputs[0];

  if (preferred?.deviceId && preferred.deviceId !== 'default') {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { ...baseAudio, deviceId: { ideal: preferred.deviceId } },
      });
    } catch {
      // Retry with plain default constraints
    }
  }

  return navigator.mediaDevices.getUserMedia({ audio: baseAudio });
}

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
  const [chatSize, setChatSize] = useState<ChatSize>(() => loadStoredChatSize() ?? getDefaultChatSize());
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  /** Finalized phrases kept across Chrome speech restarts (otherwise only the last word remains). */
  const finalsAccumRef = useRef<string>('');
  const recordingStartRef = useRef<number>(0);
  const voiceModeRef = useRef<'idle' | 'browser' | 'whisper'>('idle');
  const wantListeningRef = useRef(false);
  const asrBusyRef = useRef(false);
  const asrAbortRef = useRef<AbortController | null>(null);
  const asrTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('audio/webm');
  const switchingToWhisperRef = useRef(false);
  /** Prefer reviewing voice text in the input before Send (avoids bad ASR cascading into Rasa). */
  const placeVoiceTextForReview = useCallback((raw: string) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) {
      setError('No speech detected. Speak clearly and try again.');
      return;
    }
    setInput(text);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Keep cursor in the input after each bot reply (input is disabled while waiting)
  useEffect(() => {
    if (!isOpen || isMinimized || isTyping || isVoiceProcessing || isRecording) return;
    inputRef.current?.focus();
  }, [isOpen, isMinimized, isTyping, isVoiceProcessing, isRecording]);

  // Keep panel inside the viewport on rotate / resize; restore saved size when crossing mobile/desktop
  useEffect(() => {
    let wasMobile = isMobileViewport();
    const onViewportChange = () => {
      const nowMobile = isMobileViewport();
      if (nowMobile !== wasMobile) {
        wasMobile = nowMobile;
        setChatSize(loadStoredChatSize() ?? getDefaultChatSize());
        return;
      }
      setChatSize((prev) => clampChatSize(prev.width, prev.height));
    };
    window.addEventListener('resize', onViewportChange);
    return () => window.removeEventListener('resize', onViewportChange);
  }, []);

  const beginResize = useCallback(
    (clientX: number, clientY: number) => {
      resizeStartRef.current = {
        x: clientX,
        y: clientY,
        width: chatSize.width,
        height: chatSize.height,
      };
      setIsResizing(true);
    },
    [chatSize.width, chatSize.height]
  );

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      beginResize(e.clientX, e.clientY);
    },
    [beginResize]
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      // Panel is anchored bottom-right: drag left/up to grow
      const next = clampChatSize(
        start.width + (start.x - e.clientX),
        start.height + (start.y - e.clientY)
      );
      setChatSize(next);
    };

    const onUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      setChatSize((current) => {
        const clamped = clampChatSize(current.width, current.height);
        persistChatSize(clamped);
        return clamped;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isResizing]);

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
      let messageToSend = normalizeTimetableMessage(text);
      if (chatLanguage !== 'en') {
        messageToSend = await translate(messageToSend, 'en', chatLanguage);
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

  const clearAsrTick = useCallback(() => {
    if (asrTickRef.current) {
      clearInterval(asrTickRef.current);
      asrTickRef.current = null;
    }
    asrAbortRef.current?.abort();
    asrAbortRef.current = null;
    asrBusyRef.current = false;
  }, []);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    wantListeningRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      clearAsrTick();
      stopMediaTracks();
      setIsRecording(false);
      voiceModeRef.current = 'idle';
    }
  }, [clearAsrTick, stopMediaTracks]);

  const transcribeAudioBlob = useCallback(
    async (blob: Blob, model: 'tiny' | 'base', signal?: AbortSignal): Promise<string | null> => {
      const formData = new FormData();
      formData.append('audio', blob, mimeTypeRef.current.includes('mp4') ? 'recording.mp4' : 'recording.webm');
      formData.append('language', chatLanguage);
      formData.append('engine', 'whisper');
      formData.append('model', model);
      const { data } = await api.post<{ success: boolean; data?: { text?: string }; message?: string }>(
        '/ai/asr/transcribe',
        formData,
        { timeout: model === 'tiny' ? 45000 : 90000, signal }
      );
      return data.success ? data.data?.text?.trim() || null : null;
    },
    [chatLanguage]
  );

  const refreshLiveWhisper = useCallback(async () => {
    if (!wantListeningRef.current || voiceModeRef.current !== 'whisper') return;
    if (asrBusyRef.current || chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    if (blob.size < 1200) return;

    asrBusyRef.current = true;
    asrAbortRef.current?.abort();
    const controller = new AbortController();
    asrAbortRef.current = controller;
    try {
      const text = await transcribeAudioBlob(blob, 'tiny', controller.signal);
      if (text && wantListeningRef.current && voiceModeRef.current === 'whisper') {
        const prev = transcriptRef.current.trim();
        // Ignore bad short partials that wipe a longer phrase already shown
        if (!prev || text.length + 8 >= prev.length || text.toLowerCase().includes(prev.toLowerCase())) {
          transcriptRef.current = text;
          setInput(text);
          setError(null);
        }
      }
    } catch (err: unknown) {
      if (!wantListeningRef.current) return;
      const canceled =
        (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ERR_CANCELED') ||
        (err instanceof DOMException && err.name === 'AbortError');
      if (canceled) return;
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message || '')
          : String(err || '');
      if (/ECONNREFUSED|not running|ASR|Network Error|503/i.test(msg)) {
        setError('Voice service is not running. Keep npm run asr open, then try the mic again.');
      }
    } finally {
      asrBusyRef.current = false;
    }
  }, [transcribeAudioBlob]);

  const startWhisperLive = useCallback(async () => {
    try {
      clearAsrTick();
      const stream = await getPreferredMicStream();
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      mimeTypeRef.current = mimeType || 'audio/webm';
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      // Keep any text already captured from browser speech when falling over to Whisper
      if (!transcriptRef.current.trim()) {
        transcriptRef.current = '';
        setInput('');
      } else {
        setInput(transcriptRef.current);
      }
      recordingStartRef.current = Date.now();
      voiceModeRef.current = 'whisper';
      wantListeningRef.current = true;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearAsrTick();
        stopMediaTracks();
        const duration = Date.now() - recordingStartRef.current;
        setIsRecording(false);
        voiceModeRef.current = 'idle';
        wantListeningRef.current = false;

        // Prefer text already shown live — no long wait after Stop
        if (transcriptRef.current.trim()) {
          placeVoiceTextForReview(transcriptRef.current);
          return;
        }

        if (chunksRef.current.length > 0 && duration >= MIN_RECORDING_MS) {
          setIsVoiceProcessing(true);
          try {
            const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
            const text = await transcribeAudioBlob(blob, 'tiny');
            placeVoiceTextForReview(text || '');
          } catch {
            setError('Voice service is not running. Keep npm run asr open, then try again. Or type your message.');
          } finally {
            setIsVoiceProcessing(false);
          }
        } else {
          setError(duration < MIN_RECORDING_MS ? 'Speak for at least half a second.' : 'No speech detected.');
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsVoiceProcessing(false);
      setError(null);
      asrTickRef.current = setInterval(() => {
        void refreshLiveWhisper();
      }, LIVE_WHISPER_MS);
      // First update a bit sooner so text appears quickly
      window.setTimeout(() => {
        void refreshLiveWhisper();
      }, 1200);
    } catch (err) {
      wantListeningRef.current = false;
      voiceModeRef.current = 'idle';
      setIsRecording(false);
      setError(micErrorMessage(err));
    }
  }, [
    clearAsrTick,
    stopMediaTracks,
    placeVoiceTextForReview,
    transcribeAudioBlob,
    refreshLiveWhisper,
  ]);

  const startBrowserLive = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) return false;

    try {
      transcriptRef.current = '';
      finalsAccumRef.current = '';
      setInput('');
      const recognition = new RecognitionCtor();
      recognitionRef.current = recognition;
      voiceModeRef.current = 'browser';
      wantListeningRef.current = true;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      const navLang = (typeof navigator !== 'undefined' && navigator.language) || 'en-GB';
      recognition.lang =
        chatLanguage === 'en'
          ? navLang.toLowerCase().startsWith('en')
            ? navLang
            : 'en-GB'
          : chatLanguage === 'ta'
            ? 'ta-IN'
            : 'si-LK';

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = (e.results[i][0]?.transcript || '').trim();
          if (!piece) continue;
          if (e.results[i].isFinal) {
            finalsAccumRef.current = `${finalsAccumRef.current} ${piece}`.replace(/\s+/g, ' ').trim();
          } else {
            interim += (interim ? ' ' : '') + piece;
          }
        }
        const text = `${finalsAccumRef.current} ${interim}`.replace(/\s+/g, ' ').trim();
        if (!text) return;
        transcriptRef.current = text;
        setInput(text);
      };

      recognition.onend = () => {
        if (switchingToWhisperRef.current) {
          recognitionRef.current = null;
          return;
        }
        // Chrome often stops mid-utterance — restart but KEEP finalsAccumRef
        if (wantListeningRef.current && voiceModeRef.current === 'browser') {
          try {
            recognition.start();
            return;
          } catch {
            /* fall through to finish */
          }
        }
        recognitionRef.current = null;
        setIsRecording(false);
        setIsVoiceProcessing(false);
        voiceModeRef.current = 'idle';
        const finalText = (finalsAccumRef.current || transcriptRef.current).trim();
        transcriptRef.current = finalText;
        if (finalText) {
          placeVoiceTextForReview(finalText);
        }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted' || e.error === 'no-speech') return;
        // Keep whatever we already transcribed, then continue with Whisper live
        switchingToWhisperRef.current = true;
        wantListeningRef.current = false;
        recognitionRef.current = null;
        voiceModeRef.current = 'idle';
        setIsRecording(false);
        setError(null);
        void startWhisperLive().finally(() => {
          switchingToWhisperRef.current = false;
        });
      };

      setIsRecording(true);
      setIsVoiceProcessing(false);
      setError(null);
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      voiceModeRef.current = 'idle';
      wantListeningRef.current = false;
      return false;
    }
  }, [chatLanguage, placeVoiceTextForReview, startWhisperLive]);

  const selectChatLanguage = useCallback(
    (lang: ChatLanguage) => {
      if (CHAT_LANG_FUTURE_WORK.has(lang)) return;
      if (lang === chatLanguage) return;
      if (isRecording) {
        wantListeningRef.current = false;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            /* ignore */
          }
        } else {
          stopRecording();
        }
        setIsRecording(false);
        setIsVoiceProcessing(false);
      }
      setChatLanguage(lang);
      setError(null);
    },
    [chatLanguage, isRecording, stopRecording]
  );

  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceProcessing || isTyping) return;

    // Stop
    if (isRecording) {
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
        setIsRecording(false);
        voiceModeRef.current = 'idle';
        const finalText = (finalsAccumRef.current || transcriptRef.current).trim();
        transcriptRef.current = finalText;
        placeVoiceTextForReview(finalText);
      } else {
        stopRecording();
      }
      return;
    }

    // Start: browser live speech when available, else Whisper live (any browser)
    if (chatLanguage === 'en' && startBrowserLive()) {
      return;
    }
    await startWhisperLive();
  }, [
    isRecording,
    isVoiceProcessing,
    isTyping,
    chatLanguage,
    stopRecording,
    startBrowserLive,
    startWhisperLive,
    placeVoiceTextForReview,
  ]);

  // Cleanup if chat closes while listening
  useEffect(() => {
    if (isOpen) return;
    wantListeningRef.current = false;
    clearAsrTick();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopMediaTracks();
    setIsRecording(false);
    voiceModeRef.current = 'idle';
  }, [isOpen, clearAsrTick, stopMediaTracks]);

  if (!user) return null;

  const chatMax = getChatMaxSize();
  const panelStyle: CSSProperties = isMinimized
    ? {
        width: Math.min(chatSize.width, 288),
        height: 48,
        right: EDGE_GAP,
        bottom: FAB_CLEARANCE,
        maxWidth: chatMax.width,
      }
    : {
        width: Math.min(chatSize.width, chatMax.width),
        height: Math.min(chatSize.height, chatMax.height),
        right: EDGE_GAP,
        bottom: FAB_CLEARANCE,
        maxWidth: chatMax.width,
        maxHeight: chatMax.height,
      };

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

      {/* Chat window: viewport-safe defaults; drag top-left corner to resize */}
      {isOpen && (
        <div
          className={`fixed z-40 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${
            isResizing ? '' : 'transition-[width,height]'
          }`}
          style={panelStyle}
        >
          <header
            className={`relative flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 py-3 pr-4 ${
              isMinimized ? 'pl-4' : 'pl-11'
            }`}
          >
            {!isMinimized && (
              <button
                type="button"
                onPointerDown={onResizePointerDown}
                className="absolute left-0 top-0 z-10 flex h-full w-9 cursor-nwse-resize items-center justify-center border-r border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 touch-none"
                aria-label="Drag to resize chat"
                title="Drag to resize"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="rotate-90">
                  <circle cx="3" cy="11" r="1.5" fill="currentColor" />
                  <circle cx="7" cy="11" r="1.5" fill="currentColor" />
                  <circle cx="11" cy="11" r="1.5" fill="currentColor" />
                  <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                  <circle cx="11" cy="7" r="1.5" fill="currentColor" />
                  <circle cx="11" cy="3" r="1.5" fill="currentColor" />
                </svg>
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white [background-color:var(--color-primary)]">
                <MessageSquare size={16} />
              </div>
              <span className="truncate font-semibold text-slate-800">LECSTU Assistant</span>
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
              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-500">
                    Chat in <strong>English</strong>. Type or use the microphone. Ask about today&apos;s classes,
                    room directions, timetables, halls, or appointments. Tamil and Sinhala are coming soon.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm break-words ${
                        m.isUser
                          ? 'text-white [background-color:var(--color-primary)]'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {m.isUser ? m.text : (
                        <ChatBotMessage
                          text={m.text}
                          onNavigateAway={() => {
                            setIsOpen(false);
                            setIsMinimized(false);
                          }}
                        />
                      )}
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
                <div className="mb-1.5">
                  <p className="mb-1 text-[10px] font-medium text-slate-600">Chat language</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['en', 'ta', 'si'] as const).map((lang) => {
                      const isFuture = CHAT_LANG_FUTURE_WORK.has(lang);
                      const isSelected = chatLanguage === lang && !isFuture;
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => selectChatLanguage(lang)}
                          disabled={isFuture}
                          title={isFuture ? 'Tamil and Sinhala chat coming soon' : undefined}
                          aria-disabled={isFuture}
                          className={`flex flex-col items-center justify-center rounded-md px-1 py-1 text-center transition-colors ${
                            isFuture
                              ? 'cursor-not-allowed bg-slate-50 text-slate-400 ring-1 ring-slate-200'
                              : isSelected
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="text-[10px] font-medium leading-tight">{CHAT_LANG_LABELS[lang]}</span>
                          {isFuture && (
                            <span className="mt-px text-[8px] font-medium leading-tight text-amber-600">
                              Coming soon
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-0.5 text-[9px] leading-tight text-slate-400">
                    English available now. Tamil and Sinhala coming soon.
                  </p>
                </div>
                {error && (
                  <p className="mb-2 text-xs text-red-500 break-words">{error}</p>
                )}
                {(isRecording || isVoiceProcessing) && (
                  <p className="mb-2 text-xs text-slate-500">
                    {isRecording
                      ? 'Listening… words appear in the box as you speak. Click stop when done, edit if needed, then Enter.'
                      : 'Finishing voice text…'}
                  </p>
                )}
                <div className="flex min-w-0 gap-2">
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
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    disabled={isTyping || isVoiceProcessing}
                    readOnly={isRecording}
                  />
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    disabled={isTyping}
                    className={`flex shrink-0 items-center justify-center rounded-lg px-3 py-2 transition-colors ${
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
                    className="flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-white transition-colors disabled:opacity-50 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)] sm:px-4"
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
