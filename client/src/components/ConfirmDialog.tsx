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
      <div className="confirm-body">
        <div className={`confirm-icon ${variant}`}>
          <AlertTriangle size={24} />
        </div>
        <p>{message}</p>
      </div>
      <div className="confirm-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button className={`btn-${variant}`} onClick={onConfirm} disabled={loading}>
          {loading ? <span className="spinner-sm" /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
