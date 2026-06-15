import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

let toastListener: ((msg: ToastMessage) => void) | null = null;

export function showToast(type: ToastMessage['type'], text: string) {
  const msg: ToastMessage = { id: Date.now().toString(36), type, text };
  toastListener?.(msg);
}

const toastStyles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-[var(--color-primary-light)] border-[var(--color-primary)]/30 text-[var(--color-primary-hover)]',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== msg.id));
    }, 4000);
  }, []);

  useEffect(() => {
    toastListener = addToast;
    return () => { toastListener = null; };
  }, [addToast]);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons = {
    success: <CheckCircle size={16} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${toastStyles[t.type]}`}
        >
          {icons[t.type]}
          <span className="text-sm font-medium">{t.text}</span>
          <button
            type="button"
            onClick={() => remove(t.id)}
            className="ml-1 rounded p-0.5 hover:opacity-70"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
