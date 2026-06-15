import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { authApi } from "../api/authApi";
import { invitationApi } from "../api/invitationApi";
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

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

const initialForm = { full_name: "", email: "", password: "" };
const initialErrors = { full_name: "", email: "", password: "" };

function validateRegisterForm(data) {
  const errors = { full_name: "", email: "", password: "" };
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

  return { errors, valid };
}

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [invitePreview, setInvitePreview] = useState(null);

  // Pre-fill email from invite token and show org context
  useEffect(() => {
    if (!inviteToken) return;
    invitationApi
      .preview(inviteToken)
      .then((data) => {
        setInvitePreview(data);
        setFormData((current) => ({ ...current, email: data.email }));
      })
      .catch(() => {
        // Ignore — user can still register without pre-fill
      });
  }, [inviteToken]);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      if (inviteToken) {
        navigate(`/accept-invitation?token=${encodeURIComponent(inviteToken)}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthLoading, isAuthenticated, navigate, inviteToken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    // Clear the field error on change
    if (fieldErrors[name]) {
      setFieldErrors((current) => ({ ...current, [name]: "" }));
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const { errors, valid } = validateRegisterForm(formData);
    if (!valid) {
      setFieldErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authApi.register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: "team_member",
      });
      toast.success(response.message || "OTP sent to your email.");
      setStep("otp");
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.message || "Unable to register.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();

    if (otpCode.length !== 6) {
      setOtpError("Please enter the full 6-digit OTP.");
      return;
    }

    try {
      setOtpError("");
      setIsSubmitting(true);
      const response = await authApi.verifyRegisterOtp({
        email: formData.email.trim().toLowerCase(),
        otp_code: otpCode,
      });
      loginWithToken(response.access_token, response.user);
      toast.success("Account verified successfully.");
      if (inviteToken) {
        navigate(`/accept-invitation?token=${encodeURIComponent(inviteToken)}`);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setOtpError(err.message || "Invalid OTP.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputBase =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-200";
  const inputNormal = `${inputBase} border-slate-300 focus:border-slate-900`;
  const inputError = `${inputBase} border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {step === "register" ? "Create account" : "Verify your email"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {step === "register"
              ? "Create your account to get started."
              : `Enter the OTP sent to ${formData.email}.`}
          </p>
        </div>

        {invitePreview && step === "register" && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            You were invited to join{" "}
            <span className="font-semibold">{invitePreview.organization_name}</span> as{" "}
            <span className="font-semibold capitalize">{invitePreview.role.replace("_", " ")}</span>.
          </div>
        )}

        {step === "register" ? (
          <form onSubmit={handleRegister} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Jane Smith"
                className={fieldErrors.full_name ? inputError : inputNormal}
              />
              <FieldError message={fieldErrors.full_name} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                name="email"
                type="text"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                readOnly={Boolean(invitePreview)}
                className={`${fieldErrors.email ? inputError : inputNormal} ${invitePreview ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
              />
              <FieldError message={fieldErrors.email} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className={`${fieldErrors.password ? inputError : inputNormal} pr-11`}
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
              <FieldError message={fieldErrors.password} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending OTP..." : "Register"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                OTP code
              </label>
              <input
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setOtpError("");
                }}
                placeholder="Enter 6-digit OTP"
                className={`${otpError ? inputError : inputNormal} tracking-widest`}
              />
              <FieldError message={otpError} />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await authApi.resendOtp({ email: formData.email, purpose: "register" });
                  toast.success("OTP resent successfully.");
                  setResendCooldown(30);
                } catch (err) {
                  toast.error(err.message || "Unable to resend OTP.");
                }
              }}
              disabled={resendCooldown > 0 || isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("register"); setOtpCode(""); setOtpError(""); }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to register
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-slate-900 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
