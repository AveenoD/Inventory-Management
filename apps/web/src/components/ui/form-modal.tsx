"use client";

import { X } from "lucide-react";

export function FormModal({
  open,
  title,
  subtitle,
  size = "md",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  size?: "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal card${size === "lg" ? " modal--lg" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header__text">
            <h2 className="modal-header__title">{title}</h2>
            {subtitle ? <p className="modal-header__subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
