import { createContext, useCallback, useContext, useState } from "react";

const DialogContext = createContext(null);

/**
 * App-wide replacement for `window.confirm` / `window.prompt`. Wrap the app
 * once with `<ConfirmDialogProvider>`, then call `useConfirm()` / `usePrompt()`
 * anywhere to get an async function that resolves the same way the native
 * browser dialogs did — `confirm` to true/false, `prompt` to the entered
 * string or `null` if cancelled — but rendered as a styled in-app modal.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ message: `Delete "${item.name}"?`, tone: "danger" });
 *
 *   const prompt = usePrompt();
 *   const note = await prompt({ message: "Reason for assigning back (optional):" });
 *   if (note === null) return; // cancelled
 */
export function ConfirmDialogProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback((options) => {
    const opts = typeof options === "string" ? { message: options } : options || {};
    return new Promise((resolve) => {
      setConfirmState({
        title: opts.title || "Please confirm",
        message: opts.message || "Are you sure?",
        confirmLabel: opts.confirmLabel || "Confirm",
        cancelLabel: opts.cancelLabel || "Cancel",
        tone: opts.tone || "default",
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options) => {
    const opts = typeof options === "string" ? { message: options } : options || {};
    return new Promise((resolve) => {
      setPromptValue(opts.defaultValue || "");
      setPromptState({
        title: opts.title || "Input required",
        message: opts.message || "",
        placeholder: opts.placeholder || "",
        confirmLabel: opts.confirmLabel || "Submit",
        cancelLabel: opts.cancelLabel || "Cancel",
        multiline: opts.multiline || false,
        resolve,
      });
    });
  }, []);

  function handleConfirmChoice(result) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  function handlePromptChoice(submit) {
    promptState?.resolve(submit ? promptValue : null);
    setPromptState(null);
    setPromptValue("");
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {confirmState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => handleConfirmChoice(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">{confirmState.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{confirmState.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirmChoice(true)}
                className={
                  confirmState.tone === "danger"
                    ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    : "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                }
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => handlePromptChoice(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePromptChoice(true);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">{promptState.title}</h2>
            {promptState.message ? <p className="mt-2 text-sm text-slate-600">{promptState.message}</p> : null}
            {promptState.multiline ? (
              <textarea
                autoFocus
                rows={3}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.placeholder}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            ) : (
              <input
                autoFocus
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.placeholder}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handlePromptChoice(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {promptState.cancelLabel}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {promptState.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function useDialogContext(hookName) {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(`${hookName} must be used within a ConfirmDialogProvider`);
  }
  return ctx;
}

export function useConfirm() {
  return useDialogContext("useConfirm").confirm;
}

export function usePrompt() {
  return useDialogContext("usePrompt").prompt;
}
