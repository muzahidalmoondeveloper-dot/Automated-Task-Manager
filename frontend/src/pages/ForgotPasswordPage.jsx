import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { authApi } from "../api/authApi";

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

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

const inputBase = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-200";
const inputNormal = `${inputBase} border-slate-300 focus:border-slate-900`;
const inputErr = `${inputBase} border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100`;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleEmailSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailError("");
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword({ email: trimmed });
      toast.success("OTP sent to your email.");
      setStep("otp");
      setResendCooldown(30);
    } catch (err) {
      setEmailError(err.message || "Unable to send OTP.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    try {
      await authApi.resendOtp({ email: email.trim().toLowerCase(), purpose: "reset_password" });
      toast.success("OTP resent successfully.");
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.message || "Unable to resend OTP.");
    }
  }

  function handleOtpSubmit(event) {
    event.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError("Please enter the full 6-digit OTP.");
      return;
    }
    setOtpError("");
    setStep("new-password");
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    let valid = true;

    if (!newPassword) {
      setNewPasswordError("Password is required.");
      valid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setNewPasswordError("");
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      valid = false;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmPasswordError("");
    }

    if (!valid) return;

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp_code: otpCode.trim(),
        new_password: newPassword,
      });
      toast.success("Password reset successfully.");
      setStep("done");
    } catch (err) {
      setNewPasswordError(err.message || "Unable to reset password.");
      setStep("otp");
      setOtpCode("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepTitles = {
    email: "Forgot password",
    otp: "Check your email",
    "new-password": "Set new password",
    done: "Password reset",
  };
  const stepSubtitles = {
    email: "Enter your email and we'll send you a reset code.",
    otp: `Enter the 6-digit OTP sent to ${email}.`,
    "new-password": "Choose a strong new password.",
    done: "Your password has been updated.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{stepTitles[step]}</h1>
          <p className="mt-2 text-sm text-slate-600">{stepSubtitles[step]}</p>
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="fp-email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="fp-email"
                type="text"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="you@example.com"
                className={emailError ? inputErr : inputNormal}
              />
              <FieldError message={emailError} />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="fp-otp" className="mb-1 block text-sm font-medium text-slate-700">
                OTP code
              </label>
              <input
                id="fp-otp"
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                placeholder="Enter 6-digit OTP"
                className={`${otpError ? inputErr : inputNormal} tracking-widest`}
              />
              <FieldError message={otpError} />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtpCode(""); setOtpError(""); }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          </form>
        )}

        {step === "new-password" && (
          <form onSubmit={handleResetSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="fp-new-pw" className="mb-1 block text-sm font-medium text-slate-700">
                New password
              </label>
              <div className="relative">
                <input
                  id="fp-new-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError(""); }}
                  placeholder="At least 8 characters"
                  className={`${newPasswordError ? inputErr : inputNormal} pr-11`}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
              <FieldError message={newPasswordError} />
            </div>

            <div>
              <label htmlFor="fp-confirm-pw" className="mb-1 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="fp-confirm-pw"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(""); }}
                  placeholder="Repeat new password"
                  className={`${confirmPasswordError ? inputErr : inputNormal} pr-11`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
              <FieldError message={confirmPasswordError} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("otp"); setNewPasswordError(""); setConfirmPasswordError(""); }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-600">
              Your password has been reset. You can now log in with your new password.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to login
            </button>
          </div>
        )}

        {step !== "done" && (
          <p className="mt-6 text-center text-sm text-slate-600">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-slate-900 hover:underline">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
