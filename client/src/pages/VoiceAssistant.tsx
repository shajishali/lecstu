import { useState } from 'react';
import VoiceInput, { type TranscriptionResult, type VoiceLanguage } from '@components/VoiceInput';

export default function VoiceAssistant() {
  const [transcription, setTranscription] = useState<string>('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [language, setLanguage] = useState<VoiceLanguage>('en');
  const [engine, setEngine] = useState<'whisper' | 'whisper-finetuned' | 'google' | 'azure'>('whisper');
  const [model, setModel] = useState<'tiny' | 'base' | 'small' | 'medium'>('base');
  const [error, setError] = useState<string>('');

  const handleTranscription = (result: TranscriptionResult) => {
    setTranscription(result.text);
    setLastResult(result);
    setError('');
  };

  const handleError = (msg: string) => {
    setError(msg);
    setTranscription('');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Voice Assistant</h1>
      <p className="mb-6 text-slate-600">
        Record your academic query in English, Tamil, or Sinhala. The transcription will appear below.
        For indoor navigation and today&apos;s classes, open the <strong>LECSTU Assistant</strong> chat
        (bottom-right bubble) and speak or paste your question — e.g. &quot;What classes do I have
        today?&quot; or &quot;Guide me to my next class.&quot;
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as VoiceLanguage)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="en">English</option>
              <option value="ta">Tamil</option>
              <option value="si">Sinhala</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Engine</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as 'whisper' | 'whisper-finetuned' | 'google' | 'azure')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="whisper">Whisper</option>
              <option value="whisper-finetuned">Whisper (Finetuned)</option>
              <option value="google">Google Speech</option>
              <option value="azure">Azure Speech</option>
            </select>
          </div>
          {engine === 'whisper' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as typeof model)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="tiny">Tiny (fastest)</option>
                <option value="base">Base</option>
                <option value="small">Small</option>
                <option value="medium">Medium (best quality)</option>
              </select>
            </div>
          )}
        </div>

        <VoiceInput
          language={language}
          engine={engine}
          model={model}
          onTranscription={handleTranscription}
          onError={handleError}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {transcription && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Transcription
          </h3>
          <p className="text-lg text-slate-800">{transcription}</p>
          {lastResult && (
            <p className="mt-3 text-xs text-slate-500">
              Confidence: {(lastResult.confidence * 100).toFixed(0)}% · Latency:{' '}
              {lastResult.latency_ms.toFixed(0)} ms · Engine: {lastResult.engine}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
