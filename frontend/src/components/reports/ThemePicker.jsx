import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { reportApi } from "../../api/reportApi";

function ThemeSwatch({ theme, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "flex w-full items-center gap-3 rounded-xl border-2 border-slate-900 px-3 py-3 text-left"
          : "flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left opacity-70 hover:opacity-100"
      }
    >
      <div className="flex gap-1">
        <span className="h-6 w-6 rounded-full" style={{ backgroundColor: theme.primary_color }} />
        <span className="h-6 w-6 rounded-full" style={{ backgroundColor: theme.accent_color }} />
        <span className="h-6 w-6 rounded-full" style={{ backgroundColor: theme.secondary_color }} />
      </div>
      <span className="text-sm font-semibold text-slate-800">{theme.name}</span>
    </button>
  );
}

export default function ThemePicker({ reportId, selectedThemeId, onThemeApplied, disabled }) {
  const [themes, setThemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customColors, setCustomColors] = useState({
    primary_color: "#1E3A8A",
    accent_color: "#3B82F6",
    secondary_color: "#0F172A",
  });

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const data = await reportApi.listThemes();
        setThemes(data);
      } catch (err) {
        toast.error(err.message || "Failed to load themes.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function applyTheme(themeId) {
    try {
      const updated = await reportApi.update(reportId, { theme_id: themeId });
      onThemeApplied?.(updated);
      toast.success("Theme applied.");
    } catch (err) {
      toast.error(err.message || "Failed to apply theme.");
    }
  }

  async function saveCustomTheme() {
    try {
      const theme = await reportApi.createTheme({
        name: "Custom",
        ...customColors,
      });
      setThemes((current) => [...current, theme]);
      await applyTheme(theme.id);
    } catch (err) {
      toast.error(err.message || "Failed to save custom theme.");
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading themes...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Preset Themes</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {themes.map((theme) => (
            <ThemeSwatch
              key={theme.id}
              theme={theme}
              selected={theme.id === selectedThemeId}
              onClick={() => !disabled && applyTheme(theme.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Custom Colors</h3>
        <div className="flex flex-wrap items-end gap-4">
          {["primary_color", "accent_color", "secondary_color"].map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium capitalize text-slate-600">
                {key.replace("_color", "").replace("_", " ")}
              </label>
              <input
                type="color"
                value={customColors[key]}
                disabled={disabled}
                onChange={(e) => setCustomColors((c) => ({ ...c, [key]: e.target.value }))}
                className="h-10 w-14 cursor-pointer rounded border border-slate-300"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={saveCustomTheme}
            disabled={disabled}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
