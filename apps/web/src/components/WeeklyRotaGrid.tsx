import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  AlertTriangle,
  Edit2,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { RotaDetail, Shift } from "../types/rota";
import { StaffMember } from "../types/staff";
import { ShiftEditModal } from "./ShiftEditModal";

interface WeeklyRotaGridProps {
  rota: RotaDetail;
  staffList: StaffMember[];
  skillsList?: Array<{ id: string; name: string; color?: string }>;
  onRotaUpdated: (updatedRota: RotaDetail) => void;
}

export const WeeklyRotaGrid: React.FC<WeeklyRotaGridProps> = ({
  rota,
  staffList,
  skillsList = [],
  onRotaUpdated,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<Shift | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);
  const [modalInitialStaffId, setModalInitialStaffId] = useState<string | undefined>(undefined);

  const isPublishedOrArchived = rota.status !== "draft";

  // Generate list of 7 days between start_date and end_date
  const days: { dateStr: string; label: string; weekdayName: string; dayNum: string }[] = [];
  const curr = new Date(rota.start_date);
  const end = new Date(rota.end_date);
  while (curr <= end) {
    const dateStr = curr.toISOString().split("T")[0];
    days.push({
      dateStr,
      label: curr.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      weekdayName: curr.toLocaleDateString("en-GB", { weekday: "short" }),
      dayNum: curr.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    });
    curr.setDate(curr.getDate() + 1);
  }

  // Construct combined staff list from staffList and any staff with shifts in this rota
  const staffMap = new Map<string, StaffMember>();
  for (const s of staffList) {
    staffMap.set(s.id, s);
  }
  for (const shift of rota.shifts) {
    if (!staffMap.has(shift.staff_id)) {
      const names = (shift.staff_name || "Staff Member").split(" ");
      staffMap.set(shift.staff_id, {
        id: shift.staff_id,
        workspace_id: rota.workspace_id,
        first_name: names[0] || "Staff",
        last_name: names.slice(1).join(" ") || "",
        display_name: null,
        category: "full_time",
        is_archived: false,
        notes: null,
        skills: [],
        contract: null,
        availability_rules: [],
        unavailability_blocks: [],
        created_at: "",
        updated_at: "",
      });
    }
  }
  const combinedStaff = Array.from(staffMap.values());
  const activeStaff = combinedStaff.filter((s) => !s.is_archived);

  // Group shifts by staff ID and by Date
  const shiftsByStaffAndDate: Record<string, Record<string, Shift[]>> = {};
  for (const staff of combinedStaff) {
    shiftsByStaffAndDate[staff.id] = {};
    for (const d of days) {
      shiftsByStaffAndDate[staff.id][d.dateStr] = [];
    }
  }

  // Also collect shifts for unassigned staff or staff not in staffList
  const unassignedShiftsByDate: Record<string, Shift[]> = {};
  for (const d of days) {
    unassignedShiftsByDate[d.dateStr] = [];
  }

  for (const shift of rota.shifts) {
    if (shiftsByStaffAndDate[shift.staff_id] && shiftsByStaffAndDate[shift.staff_id][shift.date]) {
      shiftsByStaffAndDate[shift.staff_id][shift.date].push(shift);
    } else if (unassignedShiftsByDate[shift.date]) {
      unassignedShiftsByDate[shift.date].push(shift);
    }
  }

  // Calculate staff scheduled hours
  const staffPaidHours: Record<string, number> = {};
  for (const staff of combinedStaff) {
    const staffShifts = rota.shifts.filter((s) => s.staff_id === staff.id);
    staffPaidHours[staff.id] = Math.round(staffShifts.reduce((acc, s) => acc + s.paid_hours, 0) * 100) / 100;
  }

  // Calculate daily staffing coverage
  const dailyCoverage: Record<string, { target: number; scheduled: number; status: "filled" | "under" | "over" }> = {};
  for (const d of days) {
    const req = rota.requirements?.find((r) => r.date === d.dateStr);
    const target = req ? req.bands.reduce((acc, b) => acc + b.target_staff_count, 0) : 0;
    const scheduled = rota.shifts.filter((s) => s.date === d.dateStr).length;

    let covStatus: "filled" | "under" | "over" = "filled";
    if (scheduled < target) covStatus = "under";
    else if (scheduled > target) covStatus = "over";

    dailyCoverage[d.dateStr] = { target, scheduled, status: covStatus };
  }

  const handleOpenCreateModal = (dateStr?: string, staffMemberId?: string) => {
    if (isPublishedOrArchived) return;
    setShiftToEdit(null);
    setModalInitialDate(dateStr);
    setModalInitialStaffId(staffMemberId);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shift: Shift) => {
    setShiftToEdit(shift);
    setModalInitialDate(undefined);
    setModalInitialStaffId(undefined);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar: View Toggles & Add Shift Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-label="Switch to Weekly Matrix Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Weekly Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-label="Switch to Daily List view"
            >
              <List className="h-3.5 w-3.5" />
              <span>Daily List</span>
            </button>
          </div>

          <span className="text-xs text-slate-400">|</span>

          <span className="text-xs text-slate-600 font-medium">
            Total Shifts: <strong className="text-slate-900">{rota.total_shifts}</strong> • Paid Hours:{" "}
            <strong className="text-emerald-700 font-bold">{rota.total_paid_hours}h</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPublishedOrArchived ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
              <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
              Read-Only ({rota.status})
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid View Mode */}
      {viewMode === "grid" ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                {/* Header row: Days and Dates */}
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="py-3.5 px-4 w-56 border-r border-slate-200/80">Staff Member</th>
                  {days.map((d) => (
                    <th key={d.dateStr} className="py-3 px-3 text-center border-r border-slate-200/60 last:border-r-0">
                      <div className="text-slate-900 font-bold">{d.weekdayName}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{d.dayNum}</div>
                    </th>
                  ))}
                </tr>

                {/* Daily Coverage Bar Row */}
                <tr className="bg-slate-100/50 border-b border-slate-200 text-[11px]">
                  <td className="py-2 px-4 font-semibold text-slate-600 border-r border-slate-200/80">
                    Daily Staffing Coverage
                  </td>
                  {days.map((d) => {
                    const cov = dailyCoverage[d.dateStr];
                    const isUnder = cov.status === "under" && cov.target > 0;
                    const isFilled = cov.status === "filled" && cov.target > 0;
                    const isOver = cov.status === "over";

                    return (
                      <td key={d.dateStr} className="py-2 px-2 text-center border-r border-slate-200/60 last:border-r-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[10px] ${
                            isUnder
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : isFilled
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : isOver
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-200/60 text-slate-600"
                          }`}
                          title={`Scheduled: ${cov.scheduled} / Target: ${cov.target}`}
                        >
                          {isUnder ? (
                            <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          )}
                          <span>
                            {cov.scheduled}/{cov.target}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {activeStaff.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-12 text-center text-slate-400">
                      No active staff found in workspace. Add staff in the Staff Directory to schedule shifts.
                    </td>
                  </tr>
                ) : (
                  activeStaff.map((staff) => {
                    const scheduledHours = staffPaidHours[staff.id] || 0;
                    const contractedHours = staff.contract?.contracted_hours_per_week || 37.5;
                    const isOverContracted = scheduledHours > contractedHours;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/40 transition-colors">
                        {/* Staff column */}
                        <td className="py-3 px-4 border-r border-slate-200/80 bg-white align-top">
                          <div className="font-bold text-slate-900 truncate">
                            {staff.first_name} {staff.last_name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                                staff.category === "full_time"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {staff.category === "full_time" ? "FT" : "Restricted"}
                            </span>
                            <span
                              className={`text-[10px] font-medium ${
                                isOverContracted ? "text-amber-700 font-bold" : "text-slate-500"
                              }`}
                            >
                              {scheduledHours}h / {contractedHours}h
                            </span>
                          </div>
                        </td>

                        {/* 7 Day Cells */}
                        {days.map((d) => {
                          const shifts = shiftsByStaffAndDate[staff.id]?.[d.dateStr] || [];

                          return (
                            <td
                              key={d.dateStr}
                              className="py-2 px-2 border-r border-slate-200/60 last:border-r-0 align-top min-w-[110px]"
                            >
                              <div className="space-y-1.5 min-h-[48px] flex flex-col justify-start">
                                {shifts.map((s) => {
                                  const hasOverride = Boolean(s.active_override && s.active_override.status === "active");
                                  const overrideTitle = s.active_override
                                    ? `Manager override: ${s.active_override.warning_codes.join(", ")}`
                                    : undefined;

                                  return (
                                    <div
                                      key={s.id}
                                      onClick={() => handleOpenEditModal(s)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleOpenEditModal(s);
                                        }
                                      }}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Shift on ${d.label} from ${s.start_time} to ${s.end_time} for ${s.staff_name}`}
                                      className={`group relative rounded-xl border p-2 text-left cursor-pointer transition-all shadow-2xs hover:shadow-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                                        hasOverride
                                          ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50 text-amber-950"
                                          : "border-slate-200 bg-indigo-50/50 hover:bg-indigo-50/80 text-slate-900"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-[11px]">
                                          {s.start_time}–{s.end_time}
                                        </span>
                                        {hasOverride && (
                                          <span title={overrideTitle || "Override active"}>
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                                        <span>{s.paid_hours}h paid</span>
                                        {s.skill_name && (
                                          <span className="rounded bg-indigo-100 px-1 py-0.2 text-[9px] font-semibold text-indigo-700 truncate max-w-[55px]">
                                            {s.skill_name}
                                          </span>
                                        )}
                                      </div>

                                      {s.unpaid_break_minutes > 0 && (
                                        <div className="mt-1 text-[9px] text-slate-400">
                                          Includes {s.unpaid_break_minutes}m unpaid break deduction
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Add Shift cell button */}
                                {!isPublishedOrArchived && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreateModal(d.dateStr, staff.id)}
                                    aria-label={`Add shift for ${staff.first_name} on ${d.label}`}
                                    className="w-full py-1 rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center text-[10px]"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Daily List View Mode (Mobile-friendly) */
        <div className="space-y-4">
          {days.map((d) => {
            const dayShifts = rota.shifts.filter((s) => s.date === d.dateStr);
            const cov = dailyCoverage[d.dateStr];
            const isUnder = cov.status === "under" && cov.target > 0;

            return (
              <div key={d.dateStr} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900">{d.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isUnder ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {cov.scheduled}/{cov.target} Staff
                    </span>
                  </div>

                  {!isPublishedOrArchived && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal(d.dateStr)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Shift
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  {dayShifts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No shifts scheduled for this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayShifts.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{s.staff_name}</span>
                              <div className="flex items-center gap-1.5">
                                {s.active_override && s.active_override.status === "active" && (
                                  <span
                                    title={`Manager override: ${s.active_override.warning_codes.join(", ")}`}
                                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-200"
                                  >
                                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                    Override
                                  </span>
                                )}
                                {s.skill_name && (
                                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                                    {s.skill_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                {s.start_time} – {s.end_time} ({s.paid_hours}h paid)
                              </span>
                            </div>
                            {s.unpaid_break_minutes > 0 && (
                              <div className="mt-1 text-[10px] text-slate-400">
                                Includes {s.unpaid_break_minutes}m unpaid break deduction
                              </div>
                            )}
                            {s.notes && (
                              <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-1">{s.notes}</p>
                            )}
                          </div>

                          {!isPublishedOrArchived && (
                            <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(s)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shift Edit / Create Modal */}
      <ShiftEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rota={rota}
        staffList={staffList}
        skillsList={skillsList}
        shiftToEdit={shiftToEdit}
        initialDate={modalInitialDate}
        initialStaffId={modalInitialStaffId}
        onSuccess={(updatedRota) => {
          onRotaUpdated(updatedRota);
        }}
      />
    </div>
  );
};
