"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  message,
  error,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog card" onClick={(e) => e.stopPropagation()} role="alertdialog">
        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__message">{message}</p>
        {error ? <p className="error confirm-dialog__error">{error}</p> : null}
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
