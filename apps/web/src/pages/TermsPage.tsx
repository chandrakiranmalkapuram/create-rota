import React from "react";
import { AlertCircle } from "lucide-react";

export const TermsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <span>Notice: Terms Draft for Owner / Legal Review</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-500">
          Draft version for development • Subject to final legal review prior to public commercial launch.
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">1. Nature of Service</h2>
          <p>
            Create Rota is an independent shift planning and schedule preparation application. It is <strong>not</strong> an employer's official HR or payroll system. The service is provided as a calculation and drafting aid for workplace managers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">2. Manager Responsibility for Official Rotas</h2>
          <p>
            Generated rotas represent mathematical draft proposals based on rules configured by the user. The manager remains solely responsible for verifying legal compliance, minimum wage obligations, statutory working hour limitations, and final rota approval before sharing with employees or entering into official systems.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">3. Account Integrity</h2>
          <p>
            Users must provide valid email credentials and maintain the security of their login credentials. Automated bulk registration or disposable email address abuse is strictly prohibited and subject to automated blocking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Limitation of Liability</h2>
          <p>
            The software is provided on an "as is" and "as available" basis. While we strive for absolute mathematical consistency and reliability, Create Rota is not liable for scheduling discrepancies, missed coverage, or payroll errors arising from inaccurate user input.
          </p>
        </section>
      </div>
    </div>
  );
};
