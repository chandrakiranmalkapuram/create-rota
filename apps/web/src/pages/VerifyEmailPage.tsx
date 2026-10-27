import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, AlertCircle, Mail, ArrowRight, RefreshCw } from "lucide-react";

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const { verifyEmail, resendVerification } = useAuth();

  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    tokenFromUrl ? "verifying" : "idle"
  );
  const [message, setMessage] = useState<string>("");

  // Resend state
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleVerify = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setStatus("verifying");
    setMessage("");
    try {
      const resMsg = await verifyEmail(tokenToUse.trim());
      setStatus("success");
      setMessage(resMsg);
    } catch (err: unknown) {
      setStatus("error");
      if (err instanceof Error) {
        setMessage(err.message);
      } else {
        setMessage("Verification failed. The link may have expired or already been used.");
      }
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setIsResending(true);
    try {
      const resMsg = await resendVerification(resendEmail);
      setResendMessage(resMsg);
    } catch {
      setResendMessage("If that account exists, a new verification link has been sent.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-spin">
                <RefreshCw className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Verifying your email address...</h1>
            <p className="text-xs text-slate-600">Please wait while we validate your one-time verification link.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Email Verified!</h1>
            <p className="text-sm text-slate-600">{message}</p>
            <div className="pt-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">Verification Link Invalid</h1>
                <p className="text-xs text-slate-600">This token may have expired or already been used.</p>
              </div>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
              {message}
            </div>

            {/* Resend verification section */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <h2 className="text-xs font-semibold text-slate-800">Request a new verification link:</h2>
              {resendMessage ? (
                <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2.5 rounded border border-emerald-200">
                  {resendMessage}
                </p>
              ) : (
                <form onSubmit={handleResend} className="space-y-2">
                  <input
                    type="email"
                    required
                    placeholder="Enter your registered email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isResending}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{isResending ? "Sending..." : "Resend Verification Email"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {status === "idle" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Mail className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Email Verification</h1>
            <p className="text-xs text-slate-600">Enter the verification token from your confirmation email below.</p>
            <div className="space-y-2 text-left">
              <input
                type="text"
                placeholder="Paste token here"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleVerify(tokenInput)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Verify Email
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <Link to="/login" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Return to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
