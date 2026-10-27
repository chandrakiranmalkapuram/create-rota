import React from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  FileSpreadsheet,
  CalendarDays,
  UserCheck,
  Check,
  ArrowRight,
} from "lucide-react";

export const FeaturesPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Features & Scheduling Capabilities
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Everything you need to create fair, compliant, and conflict-free rotas without the headache of manual spreadsheets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Staff & Contract Rules</h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Restricted vs. Full-Time:</strong> Tailored handling for part-time, student, or restricted staff.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Contract Hours:</strong> Track weekly targets and prevent under/over-scheduling.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Availability & Leave:</strong> Recurring days off, one-off time off, and approved leave blocks.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Skills & Roles:</strong> Ensure key positions (e.g. First Aider, Supervisor) are always staffed.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Period & Demand Customization</h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Flexible Week Starts:</strong> Support Sunday–Saturday or Monday–Sunday cycles.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Time-Band Demand:</strong> Configure required headcounts across varying intervals during the day.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Quick Copying:</strong> Copy requirements across days or from past rota periods in seconds.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
            <Sliders className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">OR-Tools Constraint Solver</h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>No Silently Invented Data:</strong> The solver respects availability and hard constraints strictly.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Transparent Diagnostics:</strong> Clear explanations if a slot cannot be filled (e.g. missing skills).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Draft Status:</strong> You retain complete control; generated rotas are editable drafts.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Workplace-Ready Exports</h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Multiple Formats:</strong> Export to Microsoft Excel (.xlsx), CSV, PDF, and Word (.docx).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Copy-to-Clipboard:</strong> Clean formatted table text ready to paste into any system.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Print Stylesheet:</strong> Clean landscape print layout built right into the browser view.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl bg-slate-100 p-8 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Experience Create Rota</h3>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Start building fair rotas today with a free account.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          <span>Get Started Free</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
