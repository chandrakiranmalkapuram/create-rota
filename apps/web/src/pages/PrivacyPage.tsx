import React from "react";
import { Shield } from "lucide-react";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>Transparency & Privacy Notice</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Privacy Notice
        </h1>
        <p className="text-sm text-slate-500">
          Last updated: October 2026 • <em>Notice: This policy outlines our technical and data handling practices. It will undergo formal legal review prior to commercial deployment.</em>
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">1. Data Minimization by Design</h2>
          <p>
            Create Rota is built to require only the minimal operational data needed to generate and schedule shifts:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Manager Account Information:</strong> First name, last name, business email address, and hashed authentication credentials.</li>
            <li><strong>Staff Scheduling Data:</strong> Staff names, display names, contracted hours, availability time windows, and basic role tags (e.g. Supervisor, Till).</li>
            <li><strong>Unavailability Records:</strong> General reason categories (holiday, study, general unavailable) and date ranges. We strictly <strong>do not</strong> collect medical diagnostic details, medical notes, staff home addresses, or government identification numbers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">2. Strict Multi-Tenant Data Isolation</h2>
          <p>
            All staff records, rotas, and workspace settings belong strictly to their designated workspace. Our backend enforces authorization checks on every single query to guarantee that no user can view or modify data outside their own authorized workspace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">3. Password and Token Security</h2>
          <p>
            Passwords are cryptographically hashed using Argon2id with unique salts. Verification and password reset tokens are single-use, strictly time-limited, and invalidated immediately upon redemption.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Email Processing</h2>
          <p>
            We send transactional emails exclusively for critical account lifecycle events: email verification, password reset links, and critical security notices. We do not sell or monetize email addresses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">5. Data Retention & Deletion</h2>
          <p>
            Managers have full control over their workspace records and can archive or permanently delete staff records and rotas at any time. Account deletion options are provided within account settings.
          </p>
        </section>
      </div>
    </div>
  );
};
