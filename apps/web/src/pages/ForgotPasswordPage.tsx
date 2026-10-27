import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export const ForgotPasswordPage: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
    } catch {
      // Intentionally silent for anti-enumeration
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="flex justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <KeyRound className="h-6 w-6" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot your password?</h1>
          <p className="mt-1 text-xs text-slate-600">
            Enter your account email and we'll send you single-use reset instructions.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-left rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-emerald-900">Instructions sent</h2>
                <p className="text-xs text-emerald-800 mt-1">
                  If an account exists with <strong>{email}</strong>, a password reset link has been dispatched. Please check your inbox (or your local development email sink).
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="block text-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Back to Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                Registered account email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="manager@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>{isSubmitting ? "Sending instructions..." : "Send Reset Link"}</span>
            </button>
          </form>
        )}

        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
