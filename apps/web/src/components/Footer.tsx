import React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ShieldCheck } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="font-bold text-base tracking-tight text-slate-900">
                Create<span className="text-emerald-600 font-extrabold">Rota</span>
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Build a fair, clear staff rota in minutes. Check coverage and contracted hours, make adjustments, and export cleanly for your workplace.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Independent scheduling builder. Zero lock-in. Multi-tenant data isolation.</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Navigation</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Overview
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Features & Capabilities
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Account Sign In
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Legal & Transparency</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/privacy" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Privacy Policy Notice
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-slate-600 hover:text-emerald-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer section */}
        <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="text-center md:text-left">
            <strong>Notice:</strong> Create Rota is an independent planning tool and is not affiliated with, endorsed by, or integrated into any employer's official HR system.
          </p>
          <p className="text-center md:text-right">
            &copy; {new Date().getFullYear()} Create Rota. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
