export function EyeOnIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
      <path d="M10.748 13.93l2.523 2.523a10.046 10.046 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
    </svg>
  );
}

export function CheckIcon({ met }) {
  if (met) {
    return (
      <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V8.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L6.2 9.74a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
    </svg>
  );
}

export const PASSWORD_RULES = [
  { id: "length",  label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",   test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "One lowercase letter (a–z)",   test: (p) => /[a-z]/.test(p) },
  { id: "number",  label: "One number (0–9)",              test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrengthBar({ password }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const pct = (passed / PASSWORD_RULES.length) * 100;
  const color =
    passed <= 1 ? "bg-red-400" :
    passed <= 2 ? "bg-orange-400" :
    passed <= 3 ? "bg-amber-400" :
    passed === 4 ? "bg-teal-400" :
                  "bg-emerald-500";
  const label =
    passed <= 1 ? "Very weak" :
    passed <= 2 ? "Weak" :
    passed <= 3 ? "Fair" :
    passed === 4 ? "Strong" :
                  "Very strong";

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {password.length > 0 && (
        <p className={`mt-1 text-xs font-medium ${
          passed <= 2 ? "text-red-500" : passed <= 3 ? "text-amber-600" : "text-emerald-600"
        }`}>{label}</p>
      )}
    </div>
  );
}

export function PasswordRequirementsChecklist({ password }) {
  const rules = PASSWORD_RULES.map((r) => ({ ...r, met: r.test(password) }));
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Password requirements</p>
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-2">
          <CheckIcon met={rule.met} />
          <span className={`text-xs transition-colors ${rule.met ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
}
