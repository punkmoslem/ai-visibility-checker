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
/**
 * Horizontal limits the bubble must stay inside. The viewport is not the real
 * boundary — the dashboard's main column scrolls, and the per-prompt table
 * scrolls sideways, so each clips anything drawn past its own edges.
 */
function clippingBounds(from: HTMLElement): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const viewport = { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
  let node = from.parentElement;
  while (node && node !== document.body) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|hidden)/.test(overflowX) || /(auto|scroll|hidden)/.test(overflowY)) {
      const rect = node.getBoundingClientRect();
      return {
        left: Math.max(rect.left, viewport.left),
        right: Math.min(rect.right, viewport.right),
        top: Math.max(rect.top, viewport.top),
        bottom: Math.min(rect.bottom, viewport.bottom),
      };
    }
    node = node.parentElement;
  }
  return viewport;
}

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
  const [side, setSide] = useState<"top" | "bottom">("top");
  const root = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // A centred bubble runs off the edge on the outermost column of a grid or the
  // trailing column of a table, so anchor it to whichever edge keeps it in
  // view. The bubble stays laid out while hidden, so it can be measured up
  // front and placed in one pass without a visible jump.
  function reposition() {
    const trigger = root.current;
    const width = bubble.current?.offsetWidth;
    if (!trigger || !width) return;
    const rect = trigger.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const bounds = clippingBounds(trigger);
    const margin = 12;

    if (centre + width / 2 > bounds.right - margin) setPlacement("right");
    else if (centre - width / 2 < bounds.left + margin) setPlacement("left");
    else setPlacement("center");

    // A tall bubble on a trigger near the top of the page gets its first lines
    // cut off, so drop it below when there is not room above.
    const height = bubble.current?.offsetHeight ?? 0;
    const roomAbove = rect.top - bounds.top;
    const roomBelow = bounds.bottom - rect.bottom;
    setSide(roomAbove < height + margin && roomBelow > roomAbove ? "bottom" : "top");
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
        className={`brand-tip-bubble brand-tip-${placement} brand-tip-side-${side}${
          pinned ? " is-pinned" : ""
        }`}
      >
        {label}
      </span>
    </span>
  );
}
