import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls = (error) =>
  `w-full rounded-xl border py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 ${
    error
      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 bg-slate-50 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
  }`;

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

// ─── OTP digit boxes ──────────────────────────────────────────────────────────

function OtpBoxes({ value, onChange }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  function handleKey(e, i) {
    if (e.key === "Backspace") {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
      return;
    }
    if (/^\d$/.test(e.key)) {
      const next = (value.slice(0, i) + e.key + value.slice(i + 1)).slice(0, 6);
      onChange(next);
      if (i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus();
    }
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

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    login,
    verifyLoginOtp,
    verifyRegisterOtp,
    selectOrganization,
    resendOtp,
    isAuthenticated,
    isAuthLoading,
    user,
  } = useAuth();

  const [step, setStep] = useState("login"); // "login" | "otp" | "select-org"
  const [organizations, setOrganizations] = useState([]);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      const redirect = searchParams.get("redirect");
      const defaultPath = user?.role === "client" ? "/client" : "/dashboard";
      const safePath = redirect && redirect.startsWith("/") ? redirect : defaultPath;
      navigate(safePath, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, navigate, searchParams, user]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
    setGlobalError("");
    if (fieldErrors[name]) setFieldErrors((f) => ({ ...f, [name]: "" }));
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const errors = { email: "", password: "" };
    let valid = true;
    if (!formData.email.trim()) {
      errors.email = "Email is required.";
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
      valid = false;
    }
    if (!formData.password) {
      errors.password = "Password is required.";
      valid = false;
    }
    if (!valid) { setFieldErrors(errors); return; }

    try {
      setGlobalError("");
      setIsSubmitting(true);
      const response = await login(formData);

      if (response?.email_verification_required) {
        toast.success(response.message || "OTP sent to your email.");
        setOtpPurpose("register");
        setStep("otp");
        setResendCooldown(30);
        setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
        return;
      }
      if (response?.otp_required) {
        toast.success(response.message || "OTP sent to your email.");
        setOtpPurpose("login");
        setStep("otp");
        setResendCooldown(30);
        setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
        return;
      }
      if (response?.requires_org_selection) {
        setOrganizations(response.organizations || []);
        setStep("select-org");
        return;
      }
      toast.success("Welcome back!");
    } catch (err) {
      const msg = err.message || "Invalid email or password.";
      setGlobalError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    try {
      await resendOtp({ email: formData.email, purpose: otpPurpose });
      toast.success("A new code has been sent.");
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.message || "Unable to resend code.");
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }
    try {
      setGlobalError("");
      setOtpError("");
      setIsSubmitting(true);
      const payload = { email: formData.email.trim().toLowerCase(), otp_code: otpCode.trim() };

      if (otpPurpose === "register") {
        const data = await verifyRegisterOtp(payload);
        if (data?.requires_org_selection) { setOrganizations(data.organizations || []); setStep("select-org"); return; }
        toast.success("Email verified successfully.");
      } else if (otpPurpose === "login") {
        const data = await verifyLoginOtp(payload);
        if (data?.requires_org_selection) { setOrganizations(data.organizations || []); setStep("select-org"); return; }
        toast.success("Login verified successfully.");
      } else {
        toast.error("Session expired. Please log in again.");
      }
    } catch (err) {
      setOtpError(err.message || "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-lg">
          <svg className="h-5 w-5 animate-spin text-teal-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          <p className="text-sm font-medium text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 shadow-lg shadow-teal-200">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-teal-700">Task Manager</p>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-9 shadow-xl shadow-slate-200/50">

          {/* ── Login step ───────────────────────────────────────── */}
          {step === "login" && (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
                <p className="mt-1.5 text-sm text-slate-500">Sign in to your account to continue.</p>
              </div>

              {/* Global error banner */}
              {globalError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-700">{globalError}</p>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <MailIcon />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="email"
                      autoFocus
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email address"
                      className={inputCls(fieldErrors.email)}
                    />
                  </div>
                  <FieldError message={fieldErrors.email} />
                </div>

                {/* Password */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LockIcon />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleChange}
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
                  <FieldError message={fieldErrors.password} />
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
                      Signing in…
                    </span>
                  ) : "Sign in"}
                </button>
              </form>
            </>
          )}

          {/* ── OTP step ─────────────────────────────────────────── */}
          {step === "otp" && (
            <>
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

              <form onSubmit={handleOtpSubmit} noValidate className="space-y-5">
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-700">
                    Verification code
                  </label>
                  <OtpBoxes
                    value={otpCode}
                    onChange={(v) => { setOtpCode(v); setOtpError(""); }}
                  />
                  <FieldError message={otpError} />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length < 6}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Verifying…" : "Verify & sign in"}
                </button>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("login"); setOtpCode(""); setOtpError(""); setGlobalError(""); }}
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
                  >
                    ← Back to sign in
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Select org step ───────────────────────────────────── */}
          {step === "select-org" && (
            <>
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
                  <svg className="h-6 w-6 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Choose workspace</h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Select which workspace you'd like to enter.
                </p>
              </div>

              <div className="space-y-3">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        await selectOrganization(org.id);
                        toast.success(`Entered ${org.name}`);
                      } catch (err) {
                        toast.error(err.message || "Failed to select organization.");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="group flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 text-left transition-all hover:border-teal-400 hover:bg-teal-50 hover:shadow-sm disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                        <p className="text-xs capitalize text-slate-500">
                          {org.role.replace("_", " ")} · {org.plan}
                        </p>
                      </div>
                    </div>
                    <svg className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer link */}
          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Protected by industry-standard encryption.
        </p>
      </div>
    </div>
  );
}
