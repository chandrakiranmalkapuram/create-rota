import React, { useState } from "react";
import {
  X,
  Clock,
  Award,
  Calendar,
  Archive,
  RotateCcw,
  Trash2,
  Edit,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { StaffMember } from "../types/staff";

interface StaffDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  onEdit: (staff: StaffMember) => void;
  onArchive: (staff: StaffMember) => Promise<void>;
  onReactivate: (staff: StaffMember) => Promise<void>;
  onDelete: (staff: StaffMember) => Promise<void>;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  isOpen,
  onClose,
  staff,
  onEdit,
  onArchive,
  onReactivate,
  onDelete,
}) => {
  const [confirmAction, setConfirmAction] = useState<"archive" | "reactivate" | "delete" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !staff) return null;

  const handleAction = async () => {
    if (!confirmAction) return;
    try {
      setIsProcessing(true);
      if (confirmAction === "archive") {
        await onArchive(staff);
      } else if (confirmAction === "reactivate") {
        await onReactivate(staff);
      } else if (confirmAction === "delete") {
        await onDelete(staff);
        onClose();
      }
      setConfirmAction(null);
    } catch {
      // Error handled by parent
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-detail-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-6 bg-slate-50/70">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xl shadow-sm border border-emerald-200">
              {staff.first_name[0]}
              {staff.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 id="staff-detail-title" className="text-xl font-bold text-slate-900">
                  {staff.first_name} {staff.last_name}
                </h2>
                {staff.display_name && (
                  <span className="text-xs text-slate-500 font-medium">({staff.display_name})</span>
                )}
                {staff.category === "restricted_hours" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Restricted Hours
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Full-Time
                  </span>
                )}
                {staff.is_archived && (
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Contracted:{" "}
                <span className="font-semibold text-slate-800">
                  {staff.contract?.contracted_hours_per_week ?? 0} hrs/week
                </span>{" "}
                • Min rest: {staff.contract?.min_rest_hours_between_shifts ?? 11}h
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close detail modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Confirmation Banner */}
        {confirmAction && (
          <div className="border-b border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 text-xs font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                {confirmAction === "archive" &&
                  `Are you sure you want to archive ${staff.first_name}? They will not be assigned to new rotas.`}
                {confirmAction === "reactivate" &&
                  `Reactivate ${staff.first_name} to allow scheduling them on upcoming rotas?`}
                {confirmAction === "delete" &&
                  `Permanently delete ${staff.first_name}? This action cannot be undone.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleAction}
                className={`px-3 py-1 text-xs font-bold text-white rounded-lg transition-colors ${
                  confirmAction === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {isProcessing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Working Contract Rules Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>Contract & Scheduling Parameters</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-slate-500 block">Weekly Paid Hours</span>
                <span className="text-sm font-bold text-slate-900">
                  {staff.contract?.contracted_hours_per_week ?? 0}h
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-slate-500 block">Min / Max Hours</span>
                <span className="text-sm font-bold text-slate-900">
                  {staff.contract?.min_hours_per_week ?? "—"} / {staff.contract?.max_hours_per_week ?? "—"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-slate-500 block">Max Shifts / Week</span>
                <span className="text-sm font-bold text-slate-900">
                  {staff.contract?.max_shifts_per_week ?? "—"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-slate-500 block">Max Consec. Days</span>
                <span className="text-sm font-bold text-slate-900">
                  {staff.contract?.max_consecutive_days ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Skills Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Award className="h-4 w-4 text-emerald-600" />
              <span>Qualified Skills & Roles</span>
            </div>
            {staff.skills.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No specific skills assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {staff.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-xs"
                    style={{
                      backgroundColor: `${skill.color}15`,
                      color: skill.color,
                      border: `1px solid ${skill.color}35`,
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: skill.color }} />
                    {skill.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Availability Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>Weekly Availability</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {WEEKDAYS.map((dayName, idx) => {
                const rule = staff.availability_rules.find((r) => r.weekday === idx);
                const isRecurringOff = rule?.is_recurring_day_off;
                const isAvailable = rule ? rule.is_available : true;
                const windowText = rule?.start_time && rule?.end_time
                  ? `${rule.start_time} - ${rule.end_time}`
                  : isAvailable
                  ? "Full Day"
                  : "Unavailable";

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <span className="font-semibold text-slate-700">{dayName}</span>
                    {isRecurringOff ? (
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Recurring Day Off
                      </span>
                    ) : isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {windowText}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave & Time Off */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Leave & Sickness Records ({staff.unavailability_blocks.length})</span>
              </div>
              <span className="text-[11px] text-slate-500">Zero medical data collected</span>
            </div>

            {staff.unavailability_blocks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No leave or sickness records registered.</p>
            ) : (
              <div className="space-y-2">
                {staff.unavailability_blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          b.reason_category === "holiday"
                            ? "bg-blue-100 text-blue-800"
                            : b.reason_category === "sickness"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {b.reason_category}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {b.start_date} to {b.end_date}
                      </span>
                      {b.start_time && b.end_time && (
                        <span className="text-slate-500">
                          ({b.start_time} - {b.end_time})
                        </span>
                      )}
                    </div>
                    {b.notes && <span className="text-slate-500 italic">{b.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {staff.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block mb-0.5">Manager Notes:</span>
              <p>{staff.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center gap-2">
            {staff.is_archived ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmAction("reactivate")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reactivate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("delete")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction("archive")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(staff);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Staff Member</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
