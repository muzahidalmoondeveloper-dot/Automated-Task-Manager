import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { authApi } from "../api/authApi";
import { invitationApi } from "../api/invitationApi";
import { useAuth } from "../context/AuthContext";

// ─── Icons ────────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
      <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  );
}

function EyeOnIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
      <path d="M10.748 13.93l2.523 2.523a10.046 10.046 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
    </svg>
  );
}

function CheckIcon({ met }) {
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

// ─── Password rules ───────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { id: "length",    label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { id: "upper",     label: "One uppercase letter (A–Z)",   test: (p) => /[A-Z]/.test(p) },
  { id: "lower",     label: "One lowercase letter (a–z)",   test: (p) => /[a-z]/.test(p) },
  { id: "number",    label: "One number (0–9)",              test: (p) => /[0-9]/.test(p) },
  { id: "special",   label: "One special character (!@#…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordStrengthBar({ password }) {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initialForm = { full_name: "", email: "", password: "", confirm_password: "" };
const initialErrors = { full_name: "", email: "", password: "", confirm_password: "" };

function validateRegisterForm(data) {
  const errors = { full_name: "", email: "", password: "", confirm_password: "" };
  let valid = true;

  if (!data.full_name.trim()) {
    errors.full_name = "Full name is required.";
    valid = false;
  }
  if (!data.email.trim()) {
    errors.email = "Email is required.";
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = "Please enter a valid email address.";
    valid = false;
  }
  if (!data.password) {
    errors.password = "Password is required.";
    valid = false;
  } else if (data.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
    valid = false;
  }
  if (!data.confirm_password) {
    errors.confirm_password = "Please confirm your password.";
    valid = false;
  } else if (data.password && data.confirm_password !== data.password) {
    errors.confirm_password = "Passwords do not match.";
    valid = false;
  }

  return { errors, valid };
}

// ─── Reusable input wrapper ───────────────────────────────────────────────────

function InputField({ icon, error, children }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        {icon}
      </div>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (error) =>
  `w-full rounded-xl border py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 ${
    error
      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 bg-slate-50 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
  }`;

// ─── OTP input boxes ──────────────────────────────────────────────────────────

function OtpBoxes({ value, onChange }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  function handleKey(e, i) {
    const key = e.key;
    if (key === "Backspace") {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
      return;
    }
    if (/^\d$/.test(key)) {
      const next = (value.slice(0, i) + key + value.slice(i + 1)).slice(0, 6);
      onChange(next);
      if (i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted); document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus(); }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          readOnly
          onKeyDown={(e) => handleKey(e, i)}
          onClick={() => document.getElementById(`otp-${i}`)?.focus()}
          className={`h-12 w-12 rounded-xl border text-center text-lg font-bold text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-100 ${
            d ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-slate-50"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { loginWithToken, isAuthenticated, isAuthLoading } = useAuth();

  const [step, setStep] = useState("register");
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState(initialErrors);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [invitePreview, setInvitePreview] = useState(null);

  useEffect(() => {
    if (!inviteToken) return;
    invitationApi.preview(inviteToken)
      .then((data) => {
        setInvitePreview(data);
        setFormData((f) => ({ ...f, email: data.email }));
      })
      .catch(() => {});
  }, [inviteToken]);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate(inviteToken
        ? `/accept-invitation?token=${encodeURIComponent(inviteToken)}`
        : "/dashboard",
        { replace: true }
      );
    }
  }, [isAuthLoading, isAuthenticated, navigate, inviteToken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((f) => ({ ...f, [name]: "" }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    const { errors, valid } = validateRegisterForm(formData);
    if (!valid) { setFieldErrors(errors); return; }

    try {
      setIsSubmitting(true);
      const res = await authApi.register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: "team_member",
      });
      toast.success(res.message || "OTP sent to your email.");
      setStep("otp");
      setResendCooldown(30);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
    } catch (err) {
      toast.error(err.message || "Unable to register.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpCode.length !== 6) { setOtpError("Please enter the full 6-digit code."); return; }
    try {
      setOtpError("");
      setIsSubmitting(true);
      const res = await authApi.verifyRegisterOtp({
        email: formData.email.trim().toLowerCase(),
        otp_code: otpCode,
      });
      loginWithToken(res.access_token, res.user, null, res.refresh_token);
      toast.success("Account verified successfully.");
      navigate(inviteToken
        ? `/accept-invitation?token=${encodeURIComponent(inviteToken)}`
        : "/dashboard"
      );
    } catch (err) {
      setOtpError(err.message || "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const passRules = PASSWORD_RULES.map((r) => ({ ...r, met: r.test(formData.password) }));
  const showRules = passwordFocused || formData.password.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50 px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md">
        {/* Logo / brand mark */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 shadow-lg shadow-teal-200">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-teal-700">Task Manager</p>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-9 shadow-xl shadow-slate-200/50">

          {/* Invite banner */}
          {invitePreview && step === "register" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-teal-800">
                Invited to join <span className="font-semibold">{invitePreview.organization_name}</span>{" "}
                as <span className="font-semibold capitalize">{invitePreview.role.replace("_", " ")}</span>.
              </p>
            </div>
          )}

          {step === "register" ? (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
                <p className="mt-1.5 text-sm text-slate-500">Start managing your tasks smarter today.</p>
              </div>

              <form onSubmit={handleRegister} noValidate className="space-y-5">
                {/* Full name */}
                <div>
                  <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <InputField icon={<UserIcon />} error={fieldErrors.full_name}>
                    <input
                      id="full_name"
                      name="full_name"
                      autoComplete="name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      className={inputCls(fieldErrors.full_name)}
                    />
                  </InputField>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <InputField icon={<MailIcon />} error={fieldErrors.email}>
                    <input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email address"
                      readOnly={Boolean(invitePreview)}
                      className={`${inputCls(fieldErrors.email)} ${invitePreview ? "cursor-not-allowed opacity-70" : ""}`}
                    />
                  </InputField>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LockIcon />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      placeholder="Enter your password"
                      className={`${inputCls(fieldErrors.password)} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOnIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {fieldErrors.password}
                    </p>
                  )}

                  {/* Strength bar */}
                  {formData.password.length > 0 && (
                    <PasswordStrengthBar password={formData.password} />
                  )}

                  {/* Requirements checklist */}
                  {showRules && (
                    <div className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Password requirements</p>
                      {passRules.map((rule) => (
                        <div key={rule.id} className="flex items-center gap-2">
                          <CheckIcon met={rule.met} />
                          <span className={`text-xs transition-colors ${rule.met ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Confirm password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LockIcon />
                    </div>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      placeholder="Re-enter your password"
                      className={`${inputCls(fieldErrors.confirm_password)} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOnIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                  {/* Match indicator */}
                  {formData.confirm_password.length > 0 && (
                    <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
                      formData.confirm_password === formData.password
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}>
                      {formData.confirm_password === formData.password ? (
                        <>
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                          </svg>
                          Passwords match
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Passwords do not match
                        </>
                      )}
                    </p>
                  )}
                  {fieldErrors.confirm_password && !formData.confirm_password.length && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {fieldErrors.confirm_password}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-1 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all hover:bg-teal-700 hover:shadow-teal-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                      </svg>
                      Sending verification code…
                    </span>
                  ) : "Create account"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* OTP step */}
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
                  <svg className="h-6 w-6 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-slate-700">{formData.email}</span>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-700">
                    Verification code
                  </label>
                  <OtpBoxes value={otpCode} onChange={(v) => { setOtpCode(v); setOtpError(""); }} />
                  {otpError && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {otpError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length < 6}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Verifying…" : "Verify & continue"}
                </button>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await authApi.resendOtp({ email: formData.email, purpose: "register" });
                        toast.success("A new code has been sent.");
                        setResendCooldown(30);
                      } catch (err) {
                        toast.error(err.message || "Unable to resend code.");
                      }
                    }}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("register"); setOtpCode(""); setOtpError(""); }}
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
                  >
                    ← Back to registration
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          By creating an account you agree to our{" "}
          <span className="cursor-default underline">Terms of Service</span> and{" "}
          <span className="cursor-default underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
