"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSendCode() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to send verification code");
        return;
      }

      setMessage(data.message || "Verification code sent. Please check your Gmail inbox.");
      setStep(2);
    } catch {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Invalid verification code");
        return;
      }

      setMessage("Code verified. You can now set a new password.");
      setStep(3);
    } catch {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to reset password");
        return;
      }

      setMessage("Password reset successful. Redirecting to sign in...");
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || loading) return;
    if (step === 1) handleSendCode();
    if (step === 2) handleVerifyCode();
    if (step === 3) handleResetPassword();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Sign In</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 px-8 py-10">
            <h1 className="text-2xl font-bold text-white tracking-tight">Forgot Password</h1>
            <p className="text-sm text-gray-300 mt-2">Step {step} of 3 - Verify with Gmail code</p>
          </div>

          <div className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onEnter}
                disabled={step > 1}
                placeholder="your.email@gmail.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-60"
              />
            </div>

            {step >= 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={onEnter}
                  placeholder="6-digit code"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            )}

            {step >= 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="At least 8 chars, letters + numbers"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="Re-enter your new password"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                {message}
              </div>
            )}

            {step === 1 && (
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <button
                  onClick={handleVerifyCode}
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Resend Code
                </button>
              </div>
            )}

            {step === 3 && (
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Updating Password..." : "Reset Password"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
