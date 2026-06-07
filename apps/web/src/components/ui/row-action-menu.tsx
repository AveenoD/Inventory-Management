"use client";

import { useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";

export function RowActionMenu({
  open,
  onToggle,
  onClose,
  items,
  disabled = false,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  disabled?: boolean;
  items: Array<{
    key: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  return (
    <div className="row-action-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div className="row-action-dropdown" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={item.danger ? "danger-text" : undefined}
              onClick={() => {
                onClose();
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
