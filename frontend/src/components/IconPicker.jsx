import { useEffect, useState } from "react";
import { ICON_COLORS, ICON_SET, parseRockIcon, serializeRockIcon, RockIconDisplay } from "../utils/rockIcons.jsx";

/**
 * Shared "Choose Icon" picker used by Rock, Core Value, KPI, Issue, News,
 * Objective, and To-Do modals. `value` is the serialized `"HiIconName|#hex"`
 * string (or null/legacy raw text) produced by `serializeRockIcon`; `onChange`
 * receives the new serialized string, or null when cleared.
 *
 * Pass `resetKey` (e.g. `editing?.id ?? "create"`) so the picker re-syncs its
 * internal name/color state whenever the modal is reused for a different record.
 */
export default function IconPickerButton({ value, onChange, resetKey, size = 20, renderPreview }) {
  const initial = parseRockIcon(value && value.includes("|") ? value : "");
  const [iconName, setIconName] = useState(initial.name);
  const [iconColor, setIconColor] = useState(initial.color);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredLabel, setHoveredLabel] = useState(null);

  useEffect(() => {
    const parsed = parseRockIcon(value && value.includes("|") ? value : "");
    setIconName(parsed.name);
    setIconColor(parsed.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const isPresetColor = ICON_COLORS.some((c) => c.hex === iconColor);

  function pickColor(hex) {
    setIconColor(hex);
    if (iconName) onChange(serializeRockIcon(iconName, hex));
  }

  function pickIcon(name) {
    setIconName(name);
    onChange(serializeRockIcon(name, iconColor));
    setOpen(false);
  }

  function clear() {
    setIconName(null);
    onChange(null);
    setOpen(false);
  }

  const previewStr = iconName ? serializeRockIcon(iconName, iconColor) : value;

  return (
    <div className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); setHoveredLabel(null); }}
        className="flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        style={{ height: size + 16, width: size + 16 }}
      >
        {renderPreview ? renderPreview(previewStr) : <RockIconDisplay iconStr={previewStr} size={size} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 z-40 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Choose Icon</span>
              {(iconName || value) && (
                <button type="button" onClick={clear} className="text-xs text-slate-400 hover:text-slate-700">Clear</button>
              )}
            </div>
            {/* Color swatches */}
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {ICON_COLORS.map((c) => (
                <button key={c.hex} type="button"
                  onClick={() => pickColor(c.hex)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-100"
                  style={{ backgroundColor: c.hex, opacity: iconColor === c.hex ? 1 : 0.55 }}>
                  {c.label}
                  {iconColor === c.hex && <span>✓</span>}
                </button>
              ))}
              <label
                className="relative flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-100"
                style={{ backgroundColor: iconColor, opacity: !isPresetColor ? 1 : 0.55 }}
              >
                Custom
                {!isPresetColor && <span>✓</span>}
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => pickColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
            {/* Search */}
            <div className="relative mb-2.5">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons…"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400" />
            </div>
            {/* Icon grid */}
            <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
              {ICON_SET
                .filter((ic) => !search || ic.label.toLowerCase().includes(search.toLowerCase()))
                .map((ic) => (
                  <button key={ic.name} type="button"
                    onClick={() => pickIcon(ic.name)}
                    onMouseEnter={() => setHoveredLabel(ic.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 ${iconName === ic.name ? "bg-slate-200 ring-1 ring-slate-300" : ""}`}>
                    <ic.Icon size={18} color={iconColor} />
                  </button>
                ))}
            </div>
            {/* Hover preview label */}
            <p className="mt-1.5 h-4 text-center text-[10px] text-slate-400">
              {hoveredLabel || ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
