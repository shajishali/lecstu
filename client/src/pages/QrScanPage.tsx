import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, MapPin, QrCode } from 'lucide-react';
import { postQrPosition } from '@services/indoorNavApi';
import { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';

export default function QrScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const submitCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setLoading(true);
      try {
        const result = await postQrPosition(trimmed);
        showToast('success', result.message);
        navigate(`/map?buildingId=${result.session.buildingId}`);
      } catch (err) {
        showApiErrorToast(err, 'QR scan failed');
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      if ('BarcodeDetector' in window) {
        const detector = new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
          formats: ['qr_code'],
        });
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              stopCamera();
              void submitCode(codes[0].rawValue);
            }
          } catch {
            /* ignore frame errors */
          }
        }, 500);
      }
    } catch {
      showToast('info', 'Camera unavailable. Enter the QR code manually below.');
    }
  }, [stopCamera, submitCode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="mx-auto max-w-lg p-4">
      <Link to="/map" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline">
        <ArrowLeft size={16} /> Back to Campus Map
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <QrCode size={22} className="text-[var(--color-primary)]" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Scan location QR</h1>
            <p className="text-sm text-slate-500">Update your position for accurate indoor directions</p>
          </div>
        </div>

        <div className="relative mb-4 aspect-video overflow-hidden rounded-lg bg-slate-900">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <Camera size={32} className="opacity-60" />
              <p className="text-sm opacity-80">Camera preview</p>
            </div>
          )}
        </div>

        <div className="mb-3 flex gap-2">
          {!scanning ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
            >
              <Camera size={16} /> Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Stop camera
            </button>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Or enter QR code</span>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. LEC-ABCD-0-A1B2C3D4"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitCode(manualCode)}
            />
            <button
              type="button"
              disabled={loading || !manualCode.trim()}
              onClick={() => void submitCode(manualCode)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <MapPin size={16} />
              {loading ? '…' : 'Set location'}
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}
