import React, { useState, useEffect } from "react";
import { AlertTriangle, Clock, Trash2, X, AlertCircle, Copy } from "lucide-react";
import { RotaDetail, Shift, ShiftValidationFinding } from "../types/rota";
import { StaffMember } from "../types/staff";
import { createShift, updateShift, deleteShift, copyShift, validateShift } from "../services/rotaApi";
import { useAuth } from "../context/AuthContext";

interface ShiftEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rota: RotaDetail;
  staffList: StaffMember[];
  skillsList?: Array<{ id: string; name: string; color?: string }>;
  shiftToEdit?: Shift | null;
  initialDate?: string;
  initialStaffId?: string;
  onSuccess: (updatedRota: RotaDetail) => void;
}

export const ShiftEditModal: React.FC<ShiftEditModalProps> = ({
  isOpen,
  onClose,
  rota,
  staffList,
  skillsList = [],
  shiftToEdit,
  initialDate,
  initialStaffId,
  onSuccess,
}) => {
  const { token, currentWorkspace } = useAuth();

  const isEditing = Boolean(shiftToEdit);
  const activeStaffList = staffList.filter((s) => !s.is_archived || (shiftToEdit && s.id === shiftToEdit.staff_id));

  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [skillId, setSkillId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [overrideWarnings, setOverrideWarnings] = useState(false);

  // Copy mode state
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [copyDate, setCopyDate] = useState("");
  const [copyStaffId, setCopyStaffId] = useState("");

  // Validation state
  const [findings, setFindings] = useState<ShiftValidationFinding[]>([]);
  const [calcGrossHours, setCalcGrossHours] = useState(8.0);
  const [calcBreakMinutes, setCalcBreakMinutes] = useState(45);
  const [calcPaidHours, setCalcPaidHours] = useState(7.25);
  const [calcAssumptions, setCalcAssumptions] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Action states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize or reset form on open or shift change
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setFindings([]);
      setOverrideWarnings(false);
      setShowDeleteConfirm(false);
      setIsCopyMode(false);

      if (shiftToEdit) {
        setStaffId(shiftToEdit.staff_id);
        setDate(shiftToEdit.date);
        setStartTime(shiftToEdit.start_time);
        setEndTime(shiftToEdit.end_time);
        setSkillId(shiftToEdit.skill_id || "");
        setNotes(shiftToEdit.notes || "");
      } else {
        setStaffId(initialStaffId || (activeStaffList[0]?.id ?? ""));
        setDate(initialDate || rota.start_date);
        setStartTime("09:00");
        setEndTime("17:00");
        setSkillId("");
        setNotes("");
      }
    }
  }, [isOpen, shiftToEdit, initialDate, initialStaffId, rota.start_date]);

  // Run validation when relevant parameters change
  useEffect(() => {
    if (!isOpen || !token || !currentWorkspace || !staffId || !date || !startTime || !endTime) {
      return;
    }

    if (startTime === endTime) {
      setFindings([
        {
          code: "INVALID_TIME",
          severity: "blocking",
          message: "Shift start time and end time cannot be identical.",
        },
      ]);
      return;
    }

    let isMounted = true;
    setIsValidating(true);

    const timer = setTimeout(async () => {
      try {
        const valRes = await validateShift(
          currentWorkspace.id,
          rota.id,
          {
            shift_id: shiftToEdit?.id ?? null,
            staff_id: staffId,
            date,
            start_time: startTime,
            end_time: endTime,
            skill_id: skillId || null,
          },
          token
        );
        if (isMounted) {
          setFindings(valRes.findings);
          setCalcGrossHours(valRes.gross_hours);
          setCalcBreakMinutes(valRes.unpaid_break_minutes);
          setCalcPaidHours(valRes.paid_hours);
          setCalcAssumptions(valRes.assumptions_summary);
        }
      } catch (err: any) {
        if (isMounted) {
          // If server returns error, display as blocking finding
          setFindings([
            {
              code: "SERVER_VALIDATION_ERROR",
              severity: "blocking",
              message: err.message || "Failed to validate shift.",
            },
          ]);
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, token, currentWorkspace, rota.id, shiftToEdit?.id, staffId, date, startTime, endTime, skillId]);

  if (!isOpen) return null;

  const hasBlockingFindings = findings.some((f) => f.severity === "blocking");
  const warningFindings = findings.filter((f) => f.severity === "warning");
  const hasWarnings = warningFindings.length > 0;
  const isPublishedOrArchived = rota.status !== "draft";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentWorkspace) return;

    if (hasBlockingFindings) {
      setErrorMsg("Please correct blocking errors before saving.");
      return;
    }

    if (hasWarnings && !overrideWarnings) {
      setErrorMsg("Please acknowledge the scheduling warnings below to save this shift.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && shiftToEdit) {
        const res = await updateShift(
          currentWorkspace.id,
          rota.id,
          shiftToEdit.id,
          {
            staff_id: staffId,
            date,
            start_time: startTime,
            end_time: endTime,
            skill_id: skillId || null,
            notes: notes || null,
            override_warnings: overrideWarnings,
          },
          token
        );
        onSuccess(res.rota);
        onClose();
      } else {
        const res = await createShift(
          currentWorkspace.id,
          rota.id,
          {
            staff_id: staffId,
            date,
            start_time: startTime,
            end_time: endTime,
            skill_id: skillId || null,
            notes: notes || null,
            override_warnings: overrideWarnings,
          },
          token
        );
        onSuccess(res.rota);
        onClose();
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details.findings)) {
        setFindings(err.details.findings);
        setErrorMsg(err.details.message || "Validation failed.");
      } else {
        setErrorMsg(err.message || "Failed to save shift.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !currentWorkspace || !shiftToEdit) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await deleteShift(currentWorkspace.id, rota.id, shiftToEdit.id, token);
      onSuccess(res.rota);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete shift.");
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentWorkspace || !shiftToEdit) return;
    if (!copyDate) {
      setErrorMsg("Please choose a date to copy this shift to.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await copyShift(
        currentWorkspace.id,
        rota.id,
        shiftToEdit.id,
        {
          target_date: copyDate,
          target_staff_id: copyStaffId || undefined,
          override_warnings: overrideWarnings,
        },
        token
      );
      onSuccess(res.rota);
      onClose();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details.findings)) {
        setFindings(err.details.findings);
        setErrorMsg(err.details.message || "Copy validation failed.");
      } else {
        setErrorMsg(err.message || "Failed to copy shift.");
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 id="shift-modal-title" className="text-lg font-bold text-slate-900">
              {isCopyMode ? "Copy Shift" : isEditing ? "Edit Shift" : "Add Shift"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isPublishedOrArchived
                ? "This rota is published or archived and cannot be edited."
                : "Configure shift assignments, timing, and skills with real-time conflict validation."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Delete confirmation sub-view */}
        {showDeleteConfirm ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <Trash2 className="h-8 w-8 text-rose-600 mx-auto" />
              <h3 className="mt-2 text-sm font-bold text-rose-900">Delete this shift?</h3>
              <p className="mt-1 text-xs text-rose-700">
                Are you sure you want to remove this shift assignment for{" "}
                <span className="font-semibold">{shiftToEdit?.staff_name}</span> on{" "}
                <span className="font-semibold">{shiftToEdit?.date}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Yes, Delete Shift"}
              </button>
            </div>
          </div>
        ) : isCopyMode ? (
          /* Copy shift sub-form */
          <form onSubmit={handleCopy} className="mt-4 space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900 flex items-center gap-2">
              <Copy className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                Copying {shiftToEdit?.start_time}–{shiftToEdit?.end_time} shift originally on {shiftToEdit?.date}.
              </span>
            </div>

            <div>
              <label htmlFor="copy-target-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Target Date *
              </label>
              <input
                id="copy-target-date"
                type="date"
                min={rota.start_date}
                max={rota.end_date}
                required
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="copy-target-staff" className="block text-xs font-semibold text-slate-700 mb-1">
                Assign to Staff Member (Optional)
              </label>
              <select
                id="copy-target-staff"
                value={copyStaffId}
                onChange={(e) => setCopyStaffId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Keep original staff ({shiftToEdit?.staff_name})</option>
                {activeStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.category === "full_time" ? "Full-time" : "Restricted"})
                  </option>
                ))}
              </select>
            </div>

            {hasWarnings && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideWarnings}
                    onChange={(e) => setOverrideWarnings(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Acknowledge scheduling warning(s) and proceed with copy</span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCopyMode(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Edit
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !copyDate}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Copying..." : "Confirm Copy"}
              </button>
            </div>
          </form>
        ) : (
          /* Main Create / Edit Form */
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            {shiftToEdit?.active_override && shiftToEdit.active_override.status === "active" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">Manager Override Active</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    Overridden warnings: {shiftToEdit.active_override.warning_codes.join(", ")}
                  </div>
                  <div className="text-[10px] text-amber-600/90 mt-0.5">
                    Timestamp: {new Date(shiftToEdit.active_override.overridden_at).toLocaleString("en-GB")}
                  </div>
                </div>
              </div>
            )}

            {/* Staff selection */}
            <div>
              <label htmlFor="shift-staff" className="block text-xs font-semibold text-slate-700 mb-1">
                Staff Member *
              </label>
              <select
                id="shift-staff"
                required
                disabled={isPublishedOrArchived}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
              >
                <option value="">Select a staff member...</option>
                {activeStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.category === "full_time" ? "Full-time" : "Restricted"})
                    {s.contract ? ` • ${s.contract.contracted_hours_per_week}h/wk` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Date selection */}
            <div>
              <label htmlFor="shift-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Shift Date *
              </label>
              <input
                id="shift-date"
                type="date"
                required
                disabled={isPublishedOrArchived}
                min={rota.start_date}
                max={rota.end_date}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            {/* Time inputs & Quick presets */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="shift-start-time" className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Time *
                </label>
                <input
                  id="shift-start-time"
                  type="time"
                  required
                  disabled={isPublishedOrArchived}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
                />
              </div>
              <div>
                <label htmlFor="shift-end-time" className="block text-xs font-semibold text-slate-700 mb-1">
                  End Time *
                </label>
                <input
                  id="shift-end-time"
                  type="time"
                  required
                  disabled={isPublishedOrArchived}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Time Presets */}
            {!isPublishedOrArchived && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-medium self-center mr-1">Presets:</span>
                {[
                  { label: "09:00 - 17:00", s: "09:00", e: "17:00" },
                  { label: "10:00 - 16:00", s: "10:00", e: "16:00" },
                  { label: "14:00 - 22:00", s: "14:00", e: "22:00" },
                  { label: "22:00 - 06:00", s: "22:00", e: "06:00" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setStartTime(preset.s);
                      setEndTime(preset.e);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Live Break & Paid-Hours Calculation Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  Calculated Hours:
                </span>
                <span>
                  Gross: <strong className="text-slate-900">{calcGrossHours}h</strong> | Unpaid Break:{" "}
                  <strong className="text-slate-900">{calcBreakMinutes}m</strong> | Net Paid:{" "}
                  <strong className="text-emerald-700 text-sm font-bold">{calcPaidHours}h</strong>
                </span>
              </div>
              {calcAssumptions && (
                <div className="text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/60">
                  {calcAssumptions}
                </div>
              )}
            </div>

            {/* Skill Requirement (Optional) */}
            {skillsList.length > 0 && (
              <div>
                <label htmlFor="shift-skill" className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Skill (Optional)
                </label>
                <select
                  id="shift-skill"
                  disabled={isPublishedOrArchived}
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
                >
                  <option value="">No specific skill required</option>
                  {skillsList.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor="shift-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Manager Notes (Optional)
              </label>
              <textarea
                id="shift-notes"
                rows={2}
                disabled={isPublishedOrArchived}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shift instructions or coverage reason..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            {/* Validation Findings & Conflict Alerts */}
            {isValidating && (
              <div className="text-xs text-slate-400 italic flex items-center gap-1.5 py-1">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                Checking scheduling constraints...
              </div>
            )}

            {findings.length > 0 && (
              <div className="space-y-2 pt-1">
                {findings.map((f, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
                      f.severity === "blocking"
                        ? "border-rose-200 bg-rose-50/80 text-rose-900"
                        : "border-amber-200 bg-amber-50/80 text-amber-900"
                    }`}
                  >
                    {f.severity === "blocking" ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase ${
                            f.severity === "blocking"
                              ? "bg-rose-200 text-rose-800"
                              : "bg-amber-200 text-amber-800"
                          }`}
                        >
                          {f.severity}
                        </span>
                        <span className="font-semibold text-xs">{f.code}</span>
                      </div>
                      <p className="mt-1 text-xs">{f.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manager Warning Override Checkbox */}
            {hasWarnings && !hasBlockingFindings && !isPublishedOrArchived && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideWarnings}
                    onChange={(e) => setOverrideWarnings(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold">Acknowledge warning(s) and proceed with manager override</span>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Check this box if you explicitly confirm this schedule assignment despite the warning(s) above.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                {isEditing && !isPublishedOrArchived && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCopyDate(shiftToEdit?.date || rota.start_date);
                        setCopyStaffId("");
                        setIsCopyMode(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                {!isPublishedOrArchived && (
                  <button
                    type="submit"
                    disabled={isSubmitting || hasBlockingFindings}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? "Saving..." : isEditing ? "Update Shift" : "Create Shift"}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
