import React, { useState, useEffect } from "react";
import { Copy, AlertCircle, X } from "lucide-react";
import { Rota, RotaDetail, RotaDuplicateInput } from "../types/rota";
import { duplicateRota } from "../services/rotaApi";
import { useAuth } from "../context/AuthContext";

interface DuplicateRotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  rota: Rota | RotaDetail;
  onSuccess: (newRota: RotaDetail) => void;
}

export const DuplicateRotaModal: React.FC<DuplicateRotaModalProps> = ({
  isOpen,
  onClose,
  rota,
  onSuccess,
}) => {
  const { currentWorkspace, token } = useAuth();
  const workspaceId = currentWorkspace?.id || "";

  // Calculate rota duration in days
  const startMs = new Date(rota.start_date).getTime();
  const endMs = new Date(rota.end_date).getTime();
  const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));

  // Default target dates: 7 days after source rota
  const defaultTargetStart = new Date(startMs + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const defaultTargetEnd = new Date(
    new Date(defaultTargetStart).getTime() + durationDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const [name, setName] = useState<string>(`Copy of ${rota.name}`);
  const [startDate, setStartDate] = useState<string>(defaultTargetStart);
  const [endDate, setEndDate] = useState<string>(defaultTargetEnd);
  const [copyRequirements, setCopyRequirements] = useState<boolean>(true);
  const [copyShifts, setCopyShifts] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when rota changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const sMs = new Date(rota.start_date).getTime();
      const eMs = new Date(rota.end_date).getTime();
      const dur = Math.round((eMs - sMs) / (1000 * 60 * 60 * 24));
      const nextStart = new Date(sMs + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const nextEnd = new Date(
        new Date(nextStart).getTime() + dur * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      setName(`Copy of ${rota.name}`);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setCopyRequirements(true);
      setCopyShifts(true);
      setErrorMessage(null);
    }
  }, [isOpen, rota]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart) {
      const newEnd = new Date(
        new Date(newStart).getTime() + durationDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];
      setEndDate(newEnd);
    }
  };

  const handlePreset = (offsetWeeks: number) => {
    const newStart = new Date(startMs + offsetWeeks * 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const newEnd = new Date(
      new Date(newStart).getTime() + durationDays * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];
    setStartDate(newStart);
    setEndDate(newEnd);
    const dateFormatted = new Date(newStart).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    setName(`Week Commencing ${dateFormatted}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Please enter a rota name.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage("Please enter valid start and end dates.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: RotaDuplicateInput = {
        new_name: name.trim(),
        new_start_date: startDate,
        new_end_date: endDate,
        copy_requirements: copyRequirements,
        copy_shifts: copyShifts,
      };

      const result = await duplicateRota(workspaceId, rota.id, payload, token || "");
      onSuccess(result);
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to duplicate rota.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="duplicate-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Duplicate Rota
              </h2>
              <p className="text-xs text-slate-500">
                Create a new draft schedule based on "{rota.name}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="duplicate-rota-name"
              className="block text-xs font-semibold text-slate-700"
            >
              New Rota Name
            </label>
            <input
              id="duplicate-rota-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. Next Week Commencing..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Period Presets ({durationDays + 1} days)
              </label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handlePreset(1)}
                  className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-200"
                >
                  +1 Week
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(2)}
                  className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-200"
                >
                  +2 Weeks
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="duplicate-start-date"
                  className="block text-[11px] font-medium text-slate-500"
                >
                  Start Date
                </label>
                <input
                  id="duplicate-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="duplicate-end-date"
                  className="block text-[11px] font-medium text-slate-500"
                >
                  End Date (Locked to match duration)
                </label>
                <input
                  id="duplicate-end-date"
                  type="date"
                  value={endDate}
                  readOnly
                  disabled
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Content to Copy
            </span>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={copyRequirements}
                onChange={(e) => setCopyRequirements(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Copy staffing demand requirements & time bands</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={copyShifts}
                onChange={(e) => setCopyShifts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Copy scheduled shifts (shifts will start in draft state)</span>
            </label>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-[11px] text-blue-800 leading-relaxed">
            <strong>Audit & Snapshot note:</strong> Duplication produces a fresh draft rota.
            Historical solver runs, version snapshots, and manager override audits are not
            copied over to keep the audit trail accurate.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Duplicating...</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Confirm Duplication</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
