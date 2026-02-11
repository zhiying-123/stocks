// H-Stocks Login UI
"use client";

import { useState } from "react";
import { loginRequest } from "./login";
import Link from "next/link";

export default function LoginUI() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await loginRequest(identifier, password);
      setLoading(false);

      if (!result.success) {
        setError(result.message ?? "Login failed");
        return;
      }

      // Redirect to stock platform
      window.location.href = "/h_stocks";
    } catch {
      setLoading(false);
      setError("Server error. Please try again later.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Back to Home Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Home</span>
        </Link>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 px-8 py-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
                <p className="text-sm text-gray-400">Sign in to H-Stocks</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-8">
            <div className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="your.email@example.com"
                  className="
                    w-full px-4 py-3
                    bg-gray-50 border border-gray-200 rounded-xl
                    text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                    transition-all
                  "
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="
                    w-full px-4 py-3
                    bg-gray-50 border border-gray-200 rounded-xl
                    text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                    transition-all
                  "
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="
                  w-full py-3.5 px-4
                  bg-gray-900 text-white font-semibold rounded-xl
                  hover:bg-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all
                  flex items-center justify-center gap-2
                  shadow-sm hover:shadow-md
                "
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Additional Links */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <a
                href="/register"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Create Account
              </a>
              <div className="w-px h-4 bg-gray-300" />
              <a
                href="/forgot-password"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Forgot Password?
              </a>
            </div>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
