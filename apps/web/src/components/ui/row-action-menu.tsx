"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

type MenuCoords = { top: number; left: number };

function isAnchorVisible(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function placeMenu(
  button: HTMLButtonElement,
  menu: HTMLDivElement | null,
  itemCount: number,
): MenuCoords | null {
  const rect = button.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const menuHeight = menu?.offsetHeight ?? itemCount * 36 + 12;
  const menuWidth = menu?.offsetWidth ?? 116;
  const gap = 6;

  let top = rect.bottom + gap;
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - gap);
  }

  let left = rect.right - menuWidth;
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

  return { top, left };
}

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const btn = buttonRef.current;
      if (!btn || !isAnchorVisible(btn)) {
        setCoords(null);
        return;
      }
      setCoords(placeMenu(btn, menuRef.current, items.length));
    };

    update();
    const raf = requestAnimationFrame(update);

    const onScroll = () => update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      // Another RowActionMenu instance may own the open portal (e.g. desktop + mobile lists).
      if (target instanceof Element && target.closest(".row-action-dropdown--portal")) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  const dropdown =
    open && coords && mounted
      ? createPortal(
          <div
            ref={menuRef}
            className="row-action-dropdown row-action-dropdown--portal"
            role="menu"
            style={{ top: coords.top, left: coords.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={item.danger ? "danger-text" : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  item.onClick();
                  onClose();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="row-action-menu" ref={rootRef}>
      <button
        ref={buttonRef}
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
      {dropdown}
    </div>
  );
}
