import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing or invalid password reset token. Please request a new link.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const msg = await resetPassword(token, newPassword);
      setSuccess(msg);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Password reset failed. The link may have expired.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="flex justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Lock className="h-6 w-6" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set new password</h1>
          <p className="mt-1 text-xs text-slate-600">Enter a secure new password for your account.</p>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 text-left">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-left">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-emerald-900">Password Updated!</h2>
                <p className="text-xs text-emerald-800 mt-1">{success}</p>
                <p className="text-xs text-emerald-700 mt-1">Redirecting to login in 3 seconds...</p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <span>Sign in now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="new_pwd" className="block text-xs font-semibold text-slate-700">
                New password (min 8 chars)
              </label>
              <input
                id="new_pwd"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="confirm_pwd" className="block text-xs font-semibold text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirm_pwd"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              <span>{isSubmitting ? "Resetting password..." : "Save New Password"}</span>
            </button>
          </form>
        )}

        <div className="pt-2">
          <Link to="/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Cancel and return to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
