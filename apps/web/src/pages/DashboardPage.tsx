import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Sparkles,
  Building,
  Check,
  Mail,
  Clock,
  ArrowRight,
} from "lucide-react";
import { fetchStaffList } from "../services/staffApi";

export const DashboardPage: React.FC = () => {
  const { user, currentWorkspace, token, resendVerification } = useAuth();
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [totalContractHours, setTotalContractHours] = useState<number>(0);

  const handleResend = async () => {
    if (!user) return;
    setIsResending(true);
    try {
      const msg = await resendVerification(user.email);
      setResendStatus(msg);
    } catch {
      setResendStatus("Verification email sent.");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace && token) {
      fetchStaffList(currentWorkspace.id, token, { pageSize: 100 })
        .then((res) => {
          setStaffCount(res.total);
          const hours = res.items.reduce(
            (acc, s) => acc + (s.contract?.contracted_hours_per_week || 0),
            0
          );
          setTotalContractHours(hours);
        })
        .catch(() => {});
    }
  }, [currentWorkspace, token]);

  const firstName = user?.first_name || "Manager";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner if email is not verified */}
      {user && !user.is_verified && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Email verification pending:</strong> Please verify <strong>{user.email}</strong> to ensure uninterrupted account access.
            </span>
          </div>
          <div className="flex items-center gap-3">
            {resendStatus ? (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                {resendStatus}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                aria-label="Resend verification email"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>{isResending ? "Sending..." : "Resend email"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hero Welcome with required greeting and animation */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <Building className="h-3 w-3" />
                {currentWorkspace?.name || "Primary Workspace"}
              </span>
              <span className="text-xs text-slate-500">
                Timezone: {currentWorkspace?.timezone || "Europe/London"}
              </span>
            </div>

            {/* Exact greeting required by spec with subtle animation */}
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              Hi, {firstName}! <span className="animate-subtle-smile" role="img" aria-label="smiling face">😊</span>
            </h1>

            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Welcome to your Create Rota dashboard. Manage your team members, set contracted paid hours, and prepare rota shifts with fairness constraints.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              to="/staff"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
            >
              <Users className="h-4 w-4" />
              <span>Manage Staff</span>
            </Link>
            <Link
              to="/rotas"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-all"
            >
              <Calendar className="h-4 w-4" />
              <span>Manage Rotas</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Metrics / Planning Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/staff"
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Team Members</span>
            <Users className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{staffCount}</div>
          <p className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Active team members</span>
            <span className="text-emerald-600 font-semibold group-hover:underline">View →</span>
          </p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Contract Hours</span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalContractHours.toFixed(1)}h</div>
          <p className="text-[11px] text-slate-500">Weekly contracted target</p>
        </div>

        <Link
          to="/rotas"
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Rotas & Schedules</span>
            <Calendar className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1">OR-Tools Engine</div>
          <p className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Configure demand & solve</span>
            <span className="text-emerald-600 font-semibold group-hover:underline">Open →</span>
          </p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Solver Readiness</span>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-sm font-semibold text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Ready (OR-Tools)
          </div>
          <p className="text-[11px] text-slate-500">Constraint programming live</p>
        </div>
      </div>

      {/* Onboarding Checklist for New Managers */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Workspace Setup Checklist</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Follow these milestone steps to configure your workplace and generate your first automated rota.
          </p>
        </div>

        <div className="space-y-3">
          {/* Step 1: Account & Workspace Creation */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs sm:text-sm">
            <div className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-900">Step 1: Create your manager account and personal workspace</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Completed! Your secure workspace ({currentWorkspace?.name}) is initialized with multi-tenant data isolation.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Completed</span>
          </div>

          {/* Step 2: Staff Management */}
          <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs sm:text-sm transition-all ${
            staffCount > 0
              ? "bg-emerald-50/70 border-emerald-200"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
              staffCount > 0 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"
            }`}>
              {staffCount > 0 ? <Check className="h-3.5 w-3.5" /> : "2"}
            </div>
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-900">Step 2: Add your team members & work contracts</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Define contracted paid hours, restricted hours versus full-time categories, recurring days off, and qualified skills.
              </p>
            </div>
            <Link
              to="/staff"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md transition-colors"
            >
              <span>{staffCount > 0 ? `${staffCount} Members` : "Add Staff"}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Step 3: Rota Configuration & Demand */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
              3
            </div>
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-900">Step 3: Configure rota period & staffing demand</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Set weekly cycles (Sun-Sat or Mon-Sun) and configure exact required headcounts across varying time bands.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">Milestone 4</span>
          </div>

          {/* Step 4: Solver Generation */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
              4
            </div>
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-900">Step 4: Generate, fine-tune, and export your draft rota</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Run the Google OR-Tools CP-SAT solver, inspect coverage diagnostics, edit shifts, and export to Excel, CSV, or PDF.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">Milestone 5</span>
          </div>
        </div>
      </div>
    </div>
  );
};
