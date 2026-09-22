import { useCallback, useRef, type ReactNode } from "react";

import { IconCaret } from "./icons";
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  resetPanelWidth,
  setPanelWidth,
  togglePanel,
  usePanelLayout,
  type PanelSide,
} from "./panelLayout";

/** One arrow key press, in pixels. Shift multiplies it. */
const KEY_STEP = 16;

interface SidePanelProps {
  side: PanelSide;
  title: string;
  /** Small count or kind shown beside the title, when there is one. */
  tag?: ReactNode;
  children: ReactNode;
}

/**
 * A side panel that can be dragged to a width and collapsed to a rail.
 *
 * The drag handle is a `separator` rather than a decorative div, so the width
 * is reachable from the keyboard: an ontology tool is used for long sessions
 * at a fixed desk, and a mouse-only divider is the kind of thing that quietly
 * makes a layout unusable for someone.
 */
export function SidePanel({ side, title, tag, children }: SidePanelProps) {
  const width = usePanelLayout((state) => state.widths[side]);
  const collapsed = usePanelLayout((state) => state.collapsed[side]);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Dragging the left panel's handle right widens it; the right panel's handle
  // sits on its inner edge, so the same gesture narrows it.
  const direction = side === "left" ? 1 : -1;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width };
    },
    [collapsed, width],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPanelWidth(side, drag.startWidth + (event.clientX - drag.startX) * direction);
    },
    [direction, side],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
      if (event.key === "ArrowLeft") setPanelWidth(side, width - step * direction);
      else if (event.key === "ArrowRight") setPanelWidth(side, width + step * direction);
      else if (event.key === "Home" || event.key === "End") resetPanelWidth(side);
      else if (event.key === "Enter" || event.key === " ") togglePanel(side);
      else return;
      event.preventDefault();
    },
    [direction, side, width],
  );

  const handle = (
    <div
      className="resizer"
      role="separator"
      tabIndex={collapsed ? -1 : 0}
      aria-orientation="vertical"
      aria-label={`Resize ${title} panel`}
      aria-valuenow={width}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // A divider's obvious reset: put it back where it started.
      onDoubleClick={() => resetPanelWidth(side)}
      onKeyDown={onKeyDown}
    />
  );

  const toggle = (
    <button
      className="icon-button"
      type="button"
      aria-label={`${collapsed ? "Show" : "Hide"} ${title} panel`}
      aria-expanded={!collapsed}
      onClick={() => togglePanel(side)}
    >
      {/* The caret points the way the panel will move. */}
      <IconCaret direction={caretDirection(side, collapsed)} />
    </button>
  );

  if (collapsed) {
    return (
      <div className={`panel-slot panel-slot--${side} panel-slot--collapsed`}>
        <aside className="panel panel--rail">
          {toggle}
          <span className="panel__rail-title">{title}</span>
        </aside>
      </div>
    );
  }

  return (
    <div className={`panel-slot panel-slot--${side}`}>
      <aside className={`panel panel--${side}`}>
        <div className="panel__header">
          <h2 className="panel__title">{title}</h2>
          <div className="panel__header-end">
            {tag}
            {toggle}
          </div>
        </div>
        <div className="panel__body">{children}</div>
      </aside>
      {handle}
    </div>
  );
}

/** Collapsing moves a panel towards its own edge; showing it moves it back in. */
function caretDirection(side: PanelSide, collapsed: boolean): "left" | "right" {
  if (side === "left") return collapsed ? "right" : "left";
  return collapsed ? "left" : "right";
}
