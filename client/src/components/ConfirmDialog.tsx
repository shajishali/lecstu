import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'danger' | 'warning';
}

export default function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'danger',
}: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="420px">
      <div className="flex flex-col items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <AlertTriangle size={24} />
        </div>
        <p className="text-center text-slate-700">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
            variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
