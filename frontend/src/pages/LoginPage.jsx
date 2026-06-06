import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S5.75 4.88 12 4.88 21.5 12 21.5 12 18.25 19.12 12 19.12 2.5 12 2.5 12z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.75A2.75 2.75 0 1012 9.25a2.75 2.75 0 000 5.5z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.45 10.45 0 0112 4.88c5.25 0 8.5 4.62 9.5 7.12a12.17 12.17 0 01-2.3 3.48M6.53 6.53A12.32 12.32 0 002.5 12c1 2.5 4.25 7.12 9.5 7.12a10.7 10.7 0 005.47-1.55" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    login,
    verifyLoginOtp,
    verifyRegisterOtp,
    selectOrganization,
    resendOtp,
    isAuthenticated,
    isAuthLoading,
  } = useAuth();

  const [step, setStep] = useState("login"); // "login" | "otp" | "select-org"
  const [organizations, setOrganizations] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [otpError, setOtpError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((current) => ({ ...current, [name]: "" }));
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    // Client-side validation — no browser popups
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
    if (!valid) {
      setFieldErrors(errors);
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);

      const response = await login(formData);

      if (response?.email_verification_required) {
        toast.success(response.message || "OTP sent to your email.");
        setOtpPurpose("register");
        setStep("otp");
        setResendCooldown(30);
        return;
      }

      if (response?.otp_required) {
        toast.success(response.message || "OTP sent to your email.");
        setOtpPurpose("login");
        setStep("otp");
        setResendCooldown(30);
        return;
      }

      if (response?.requires_org_selection) {
        setOrganizations(response.organizations || []);
        setStep("select-org");
        return;
      }

      toast.success("Login successful.");
      // Do not call navigate here.
      // The useEffect above will navigate after AuthContext updates user.
    } catch (err) {
      const message = err.message || "Unable to log in.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }


  useEffect(() => {
    if (resendCooldown <= 0) return;
  
    const timer = setTimeout(() => {
      setResendCooldown((current) => current - 1);
    }, 1000);
  
    return () => clearTimeout(timer);
  }, [resendCooldown]);


  async function handleResendOtp() {
    try {
      if (!otpPurpose) {
        toast.error("OTP purpose not found.");
        return;
      }
  
      await resendOtp({
        email: formData.email,
        purpose: otpPurpose,
      });
  
      toast.success("OTP resent successfully.");
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.message || "Unable to resend OTP.");
    }
  }

  async function handleOtpSubmit(event) {
    event.preventDefault();

    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter the full 6-digit OTP.");
      return;
    }

    try {
      setError("");
      setOtpError("");
      setIsSubmitting(true);

      const payload = {
        email: formData.email.trim().toLowerCase(),
        otp_code: otpCode.trim(),
      };

      if (otpPurpose === "register") {
        const data = await verifyRegisterOtp(payload);
        if (data?.requires_org_selection) {
          setOrganizations(data.organizations || []);
          setStep("select-org");
          return;
        }
        toast.success("Email verified successfully.");
      } else if (otpPurpose === "login") {
        const data = await verifyLoginOtp(payload);
        if (data?.requires_org_selection) {
          setOrganizations(data.organizations || []);
          setStep("select-org");
          return;
        }
        toast.success("Login verified successfully.");
      } else {
        toast.error("OTP purpose not found. Please login again.");
        return;
      }
    } catch (err) {
      const message = err.message || "Invalid OTP.";
      setOtpError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {step === "login" && "Welcome back"}
            {step === "otp" && "Verify login"}
            {step === "select-org" && "Select organization"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {step === "login" && "Log in to manage meeting action items and tasks."}
            {step === "otp" && `Enter the OTP sent to ${formData.email}.`}
            {step === "select-org" && "Choose which workspace you want to enter."}
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {step === "login" && (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-200 ${
                  fieldErrors.email
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-slate-900"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={`w-full rounded-lg border px-3 py-2 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-slate-200 ${
                    fieldErrors.password
                      ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-300 focus:border-slate-900"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-slate-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="otp" className="mb-1 block text-sm font-medium text-slate-700">
                OTP code
              </label>
              <input
                id="otp"
                value={otpCode}
                onChange={(event) => {
                  setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setOtpError("");
                }}
                placeholder="Enter 6-digit OTP"
                className={`w-full rounded-lg border px-3 py-2 text-sm tracking-widest outline-none transition focus:ring-2 ${
                  otpError
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                }`}
              />
              {otpError && <p className="mt-1.5 text-xs text-red-600">{otpError}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("login"); setOtpCode(""); setOtpError(""); setError(""); }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to login
            </button>
          </form>
        )}

        {step === "select-org" && (
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
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-900 hover:bg-slate-50 transition disabled:opacity-60"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{org.role} · {org.plan}</p>
                </div>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-slate-900 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}