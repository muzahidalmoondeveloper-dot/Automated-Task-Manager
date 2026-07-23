import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateString(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first weekday index (0 = Monday ... 6 = Sunday)
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(day);
  }
  return days;
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c0-.414.336-.75.75-.75h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 7.5z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronUpDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.24a.75.75 0 011.06.02L10 15.148l2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.02-1.02z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Popover calendar date picker, drop-in compatible with the native
 * `<input type="date" name=.. value=.. onChange=.. />` pattern used
 * throughout this app — fires `onChange({ target: { name, value } })` with
 * the same "YYYY-MM-DD" string a native date input produces, so existing
 * `handleChange(event)` handlers keep working unchanged.
 */
export default function DatePicker({ name, value, onChange, placeholder = "Select date", disabled = false, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const selected = parseDateString(value);
  const [viewDate, setViewDate] = useState(selected || new Date());
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (isOpen) setViewDate(selected || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e) {
      if (popoverRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  function open() {
    if (disabled) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const width = 288;
      const left = Math.min(Math.max(r.left, 8), window.innerWidth - width - 8);
      const openUpward = window.innerHeight - r.bottom < 340 && r.top > 340;
      setPos(openUpward ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
    }
    setIsOpen(true);
  }

  function selectDay(day) {
    onChange?.({ target: { name, value: toDateString(day) } });
    setIsOpen(false);
  }

  function goToMonth(delta) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  const today = new Date();
  const days = buildCalendarDays(viewDate);
  const displayLabel = selected
    ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : placeholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className={`flex items-center gap-2 ${selected ? "text-slate-900" : "text-slate-400"}`}>
          <CalendarIcon />
          {displayLabel}
        </span>
        <span className="text-slate-400">
          <ChevronUpDownIcon />
        </span>
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[300] w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => goToMonth(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-slate-900">{MONTH_LABELS[viewDate.getMonth()]} {viewDate.getFullYear()}</p>
              <button type="button" onClick={() => goToMonth(1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="py-1 text-xs font-semibold text-slate-400">{w}</div>
              ))}
              {days.map((day, i) => {
                const inCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isSelected = isSameDay(day, selected);
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? "bg-slate-200 font-semibold text-slate-900"
                        : inCurrentMonth
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {day.getDate()}
                    {isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-slate-900" />}
                  </button>
                );
              })}
            </div>

            {selected && (
              <button
                type="button"
                onClick={() => { onChange?.({ target: { name, value: "" } }); setIsOpen(false); }}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                Clear date
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
