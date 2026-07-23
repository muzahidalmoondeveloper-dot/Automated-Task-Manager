import { useRef, useState } from "react";
import { createPortal } from "react-dom";

const LINK_TYPE_LABELS = {
  objective: "Objective",
  rock: "Rock",
  task: "To-Do",
  kpi: "KPI",
};

const POPOVER_WIDTH = 224; // px, matches w-56
const VIEWPORT_MARGIN = 8;

// Distinct from the filled interlocking-rings icon RocksTab already uses for
// its "linked parent objective" indicator, so the two don't read as the same
// icon shown twice on one row.
function LinkIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Small link-icon indicator shown next to an item's title. Renders nothing
 * when there are no linked items; otherwise hovering the icon reveals a
 * popover listing each linked item's type badge + title. Rendered via a
 * portal (fixed positioning, computed from the icon's bounding rect) so it
 * escapes any scroll/overflow container the row lives in, instead of being
 * clipped like a plain CSS-absolute popover would be.
 */
export default function LinkedItemsHoverIcon({ links = [] }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const hideTimer = useRef(null);

  if (!links || links.length === 0) return null;

  function show() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;

    const left = Math.min(
      Math.max(r.left + r.width / 2 - POPOVER_WIDTH / 2, VIEWPORT_MARGIN),
      window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN
    );
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < 200 && r.top > spaceBelow;

    setPos(openUpward ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
  }

  function scheduleHide() {
    hideTimer.current = setTimeout(() => setPos(null), 100);
  }

  return (
    <span className="inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        tabIndex={-1}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className="flex items-center justify-center rounded p-0.5 text-slate-400 hover:text-slate-600"
        title={`${links.length} linked item${links.length === 1 ? "" : "s"}`}
      >
        <LinkIcon />
      </button>

      {pos &&
        createPortal(
          <div
            className="fixed z-[200] w-56"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {links.map((link, idx) => (
                <div
                  key={`${link.linked_type}-${link.linked_id}-${idx}`}
                  className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {LINK_TYPE_LABELS[link.linked_type] || link.linked_type}
                  </span>
                  <span className="truncate text-slate-800">{link.title}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
