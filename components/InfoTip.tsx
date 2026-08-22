"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Explains a metric on hover, keyboard focus, or click. The native `title`
 * attribute was too slow to appear and ignored clicks entirely, which made the
 * dashboard's metrics look unexplained. Click-to-pin also gives touch devices a
 * way in, since they have no hover.
 *
 * Pass `children` to make an existing element the trigger; otherwise an info
 * icon is rendered. The trigger is a span rather than a button so it can sit
 * inside the clickable cells of the per-prompt table without nesting buttons.
 */
export default function InfoTip({
  label,
  children,
  className = "",
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [pinned, setPinned] = useState(false);
  const [placement, setPlacement] = useState<"center" | "left" | "right">("center");
  const root = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // A centred bubble runs off screen on the outermost column of a grid or the
  // trailing column of a table, so anchor it to whichever edge keeps it in
  // view. The bubble stays laid out while hidden, so it can be measured up
  // front and placed in one pass without a visible jump.
  function reposition() {
    const trigger = root.current;
    const width = bubble.current?.offsetWidth;
    if (!trigger || !width) return;
    const rect = trigger.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const margin = 12;
    if (centre + width / 2 > window.innerWidth - margin) setPlacement("right");
    else if (centre - width / 2 < margin) setPlacement("left");
    else setPlacement("center");
  }

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setPinned(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  return (
    <span
      ref={root}
      className={`brand-tip ${className}`}
      onMouseEnter={reposition}
      onFocus={reposition}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={children ? label : `Explain: ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          reposition();
          setPinned((open) => !open);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setPinned((open) => !open);
          }
        }}
        className={children ? "brand-tip-wrap" : "brand-tip-icon"}
      >
        {children ?? "i"}
      </span>
      <span
        ref={bubble}
        role="tooltip"
        className={`brand-tip-bubble brand-tip-${placement}${pinned ? " is-pinned" : ""}`}
      >
        {label}
      </span>
    </span>
  );
}
