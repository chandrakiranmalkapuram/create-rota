import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Copy,
  Shield,
  Clock,
  ArrowRight,
  Sliders,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Independent Staff Rota Planner</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Build a <span className="text-emerald-600">fair, clear</span> staff rota in minutes
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Check staffing coverage and contracted hours, resolve conflicts, make manual adjustments, and export cleanly into your workplace’s official system.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-all duration-150"
              >
                <span>Start Planning Free</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150"
              >
                Explore Capabilities
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 pt-4 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Export to Excel, CSV & PDF
              </span>
            </div>
          </div>

          {/* Interactive Rota Preview Card */}
          <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xl shadow-slate-200/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h2 className="text-base font-bold text-slate-900">Sample Week Rota — Monday Preview</h2>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Draft v1</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Workspace: Central Store • Timezone: Europe/London</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Coverage: 100% Met
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5" /> 0 Hard Conflicts
                </span>
              </div>
            </div>

            {/* Time band requirement summary */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Band 1 (09:00 - 13:00):</span>
                <span className="font-semibold text-slate-900">Required 4 staff • Assigned 4 <span className="text-emerald-600">✓</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Band 2 (13:00 - 17:00):</span>
                <span className="font-semibold text-slate-900">Required 7 staff • Assigned 7 <span className="text-emerald-600">✓</span></span>
              </div>
            </div>

            {/* Rota Rows */}
            <div className="mt-4 divide-y divide-slate-100 text-xs sm:text-sm">
              {/* Row 1 */}
              <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    JM
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Jordan M.</span>
                    <span className="ml-2 rounded bg-purple-50 text-purple-700 px-1.5 py-0.5 text-xs font-medium border border-purple-200">Supervisor</span>
                    <span className="ml-1 text-xs text-slate-500">Full-Time (37.5h contract)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">08:30 - 16:30 (30m break)</span>
                  <span className="text-xs font-medium text-slate-600">Paid: 7.5h</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Contract On Track</span>
                </div>
              </div>

              {/* Row 2 */}
              <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                    AK
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Alex K.</span>
                    <span className="ml-2 rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-xs font-medium border border-amber-200">Restricted Hours</span>
                    <span className="ml-1 text-xs text-slate-500">Part-Time (16.0h max)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">09:00 - 13:00 (0m break)</span>
                  <span className="text-xs font-medium text-slate-600">Paid: 4.0h</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Within Limits</span>
                </div>
              </div>

              {/* Row 3 */}
              <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs">
                    SR
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Sam R.</span>
                    <span className="ml-2 rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-xs font-medium border border-blue-200">Till / Customer Care</span>
                    <span className="ml-1 text-xs text-slate-500">Full-Time (37.5h contract)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">12:30 - 20:30 (30m break)</span>
                  <span className="text-xs font-medium text-slate-600">Paid: 7.5h</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Coverage Filled</span>
                </div>
              </div>
            </div>

            {/* Export preview buttons */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <span className="font-medium">One-click exports ready for your workplace:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded text-slate-700">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel (.xlsx)
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> CSV
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded text-slate-700">
                  <Copy className="h-3.5 w-3.5 text-slate-600" /> Copy Table
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="py-16 sm:py-24 bg-white border-y border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Designed for real managers, not spreadsheets
            </h2>
            <p className="text-slate-600 text-base">
              Say goodbye to juggling scribbled notes, conflicting availability texts, and broken formulas.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Sliders className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Constraint-Based Fairness</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Google OR-Tools CP-SAT solver balances contracted hours, honours time-off requests, and enforces rest periods without silently inventing availability.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Precise Time-Band Demands</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Specify staffing demand by custom time intervals (e.g. 4 staff from 09:00-13:00, 7 from 13:00-17:00), open/close times, and specific skill/role requirements.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Strict Data Isolation</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every workspace has strict authorization boundaries. Data is never mixed, leaked, or exposed across organizations or unauthorized users.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Journey Section */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How Create Rota works</h2>
            <p className="text-slate-600 text-sm">Four simple steps from blank page to published workplace rota.</p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 1</div>
              <h3 className="text-base font-bold text-slate-900">Add Staff & Contracts</h3>
              <p className="text-xs text-slate-600">Enter contracted hours, category (restricted or full-time), availability, and skills.</p>
            </div>

            <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 2</div>
              <h3 className="text-base font-bold text-slate-900">Set Period Demand</h3>
              <p className="text-xs text-slate-600">Select dates, opening hours, and required headcount per time band.</p>
            </div>

            <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 3</div>
              <h3 className="text-base font-bold text-slate-900">Generate Draft</h3>
              <p className="text-xs text-slate-600">The solver builds a mathematically validated schedule and highlights any coverage gaps.</p>
            </div>

            <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 4</div>
              <h3 className="text-base font-bold text-slate-900">Adjust & Export</h3>
              <p className="text-xs text-slate-600">Fine-tune shifts manually, approve the draft, and export directly for your team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-emerald-700 text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Ready to spend minutes on your rota, not hours?
          </h2>
          <p className="text-emerald-100 max-w-xl mx-auto text-base">
            Create your manager account today and start building conflict-free schedules immediately.
          </p>
          <div className="pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-emerald-800 shadow-lg hover:bg-emerald-50 transition-colors"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
