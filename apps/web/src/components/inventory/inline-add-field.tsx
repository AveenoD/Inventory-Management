"use client";

import { useState } from "react";

export function InlineAddField({
  triggerLabel,
  placeholder,
  value,
  onChange,
  onAdd,
  pending,
  disabled,
}: {
  triggerLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => Promise<unknown>;
  pending?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    onChange("");
  }

  async function submit() {
    if (!value.trim() || pending) return;
    try {
      await onAdd();
      close();
    } catch {
      /* error surfaced by mutation */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-add-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        + {triggerLabel}
      </button>
    );
  }

  return (
    <div className="inline-add-panel">
      <div className="inline-add-row">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") close();
          }}
        />
        <button type="button" disabled={!value.trim() || pending} onClick={submit}>
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" className="secondary" disabled={pending} onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
