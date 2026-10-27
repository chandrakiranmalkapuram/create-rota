import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Lock, UserPlus } from "lucide-react";

export const AuthPlaceholderPage: React.FC = () => {
  const location = useLocation();
  const isRegister = location.pathname.includes("register");

  return (
    <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            {isRegister ? <UserPlus className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {isRegister ? "Create Manager Account" : "Sign In to Create Rota"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Authentication and user workspace registration are scheduled for Milestone 2.
          </p>
        </div>

        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 text-left space-y-1.5">
          <p className="font-semibold">Milestone 2 Features Coming Next:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Argon2id password hashing & JWT authentication</li>
            <li>Email verification & password reset flows</li>
            <li>Disposable email prevention check</li>
            <li>Multi-tenant workspace isolation</li>
          </ul>
        </div>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
