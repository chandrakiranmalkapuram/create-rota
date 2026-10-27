import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Clock,
  Award,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  ShieldAlert,
} from "lucide-react";
import {
  Skill,
  StaffCategory,
  StaffMember,
  StaffMemberFormData,
  LeaveReasonCategory,
  UnavailabilityBlockInput,
} from "../types/staff";
import {
  createStaffMember,
  updateStaffMember,
  fetchSkills,
  createSkill,
  addStaffLeave,
  removeStaffLeave,
} from "../services/staffApi";

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  staffMember: StaffMember | null;
  workspaceId: string;
  token: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const PRESET_COLORS = [
  "#4F46E5", // Indigo
  "#059669", // Emerald
  "#D97706", // Amber
  "#DC2626", // Red
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#0D9488", // Teal
  "#E11D48", // Rose
];

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  staffMember,
  workspaceId,
  token,
}) => {
  const isEditing = Boolean(staffMember);

  const [activeTab, setActiveTab] = useState<"profile" | "contract" | "skills" | "availability" | "leave">("profile");

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<StaffCategory>("full_time");
  const [notes, setNotes] = useState("");

  // Contract State
  const [contractedHours, setContractedHours] = useState<number>(37.5);
  const [minHours, setMinHours] = useState<string>("");
  const [maxHours, setMaxHours] = useState<string>("");
  const [maxShifts, setMaxShifts] = useState<string>("5");
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<string>("6");
  const [minRestHours, setMinRestHours] = useState<number>(11.0);

  // Skills State
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillColor, setNewSkillColor] = useState(PRESET_COLORS[0]);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);

  // Availability State (0=Mon ... 6=Sun)
  const [availabilityRules, setAvailabilityRules] = useState<
    Array<{
      weekday: number;
      is_available: boolean;
      start_time: string;
      end_time: string;
      is_recurring_day_off: boolean;
    }>
  >(
    WEEKDAYS.map((_, idx) => ({
      weekday: idx,
      is_available: true,
      start_time: "",
      end_time: "",
      is_recurring_day_off: false,
    }))
  );

  // Leave & Unavailability (only for existing staff editing)
  const [leaveBlocks, setLeaveBlocks] = useState(staffMember?.unavailability_blocks || []);
  const [newLeaveReason, setNewLeaveReason] = useState<LeaveReasonCategory>("holiday");
  const [newLeaveStartDate, setNewLeaveStartDate] = useState("");
  const [newLeaveEndDate, setNewLeaveEndDate] = useState("");
  const [newLeaveStartTime, setNewLeaveStartTime] = useState("");
  const [newLeaveEndTime, setNewLeaveEndTime] = useState("");
  const [newLeaveNotes, setNewLeaveNotes] = useState("");

  // Status & Error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load skills on mount or workspace change
  useEffect(() => {
    if (workspaceId && token && isOpen) {
      fetchSkills(workspaceId, token)
        .then(setAllSkills)
        .catch(() => {});
    }
  }, [workspaceId, token, isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (staffMember) {
      setFirstName(staffMember.first_name);
      setLastName(staffMember.last_name);
      setDisplayName(staffMember.display_name || "");
      setCategory(staffMember.category);
      setNotes(staffMember.notes || "");
      setSelectedSkillIds(staffMember.skills.map((s) => s.id));

      if (staffMember.contract) {
        setContractedHours(staffMember.contract.contracted_hours_per_week);
        setMinHours(staffMember.contract.min_hours_per_week !== null ? String(staffMember.contract.min_hours_per_week) : "");
        setMaxHours(staffMember.contract.max_hours_per_week !== null ? String(staffMember.contract.max_hours_per_week) : "");
        setMaxShifts(staffMember.contract.max_shifts_per_week !== null ? String(staffMember.contract.max_shifts_per_week) : "");
        setMaxConsecutiveDays(staffMember.contract.max_consecutive_days !== null ? String(staffMember.contract.max_consecutive_days) : "");
        setMinRestHours(staffMember.contract.min_rest_hours_between_shifts);
      }

      // Populate availability
      const defaultRules = WEEKDAYS.map((_, idx) => {
        const found = staffMember.availability_rules.find((r) => r.weekday === idx);
        if (found) {
          return {
            weekday: idx,
            is_available: found.is_available,
            start_time: found.start_time || "",
            end_time: found.end_time || "",
            is_recurring_day_off: found.is_recurring_day_off,
          };
        }
        return {
          weekday: idx,
          is_available: true,
          start_time: "",
          end_time: "",
          is_recurring_day_off: false,
        };
      });
      setAvailabilityRules(defaultRules);
      setLeaveBlocks(staffMember.unavailability_blocks || []);
    } else {
      // Reset defaults for creation
      setFirstName("");
      setLastName("");
      setDisplayName("");
      setCategory("full_time");
      setNotes("");
      setContractedHours(37.5);
      setMinHours("");
      setMaxHours("");
      setMaxShifts("5");
      setMaxConsecutiveDays("6");
      setMinRestHours(11.0);
      setSelectedSkillIds([]);
      setAvailabilityRules(
        WEEKDAYS.map((_, idx) => ({
          weekday: idx,
          is_available: true,
          start_time: "",
          end_time: "",
          is_recurring_day_off: false,
        }))
      );
      setLeaveBlocks([]);
    }
    setActiveTab("profile");
    setErrorMsg(null);
  }, [staffMember, isOpen]);

  if (!isOpen) return null;

  // Toggle skill selection
  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  // Create new skill inline
  const handleAddNewSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    try {
      setIsCreatingSkill(true);
      const created = await createSkill(workspaceId, token, {
        name: newSkillName.trim(),
        color: newSkillColor,
      });
      setAllSkills((prev) => [...prev, created]);
      setSelectedSkillIds((prev) => [...prev, created.id]);
      setNewSkillName("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    } finally {
      setIsCreatingSkill(false);
    }
  };

  // Add leave block
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffMember) return;
    if (!newLeaveStartDate || !newLeaveEndDate) {
      setErrorMsg("Please specify both start and end dates for leave.");
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const leaveData: UnavailabilityBlockInput = {
        reason_category: newLeaveReason,
        start_date: newLeaveStartDate,
        end_date: newLeaveEndDate,
        start_time: newLeaveStartTime.trim() || null,
        end_time: newLeaveEndTime.trim() || null,
        notes: newLeaveNotes.trim() || null,
      };
      const created = await addStaffLeave(workspaceId, staffMember.id, token, leaveData);
      setLeaveBlocks((prev) => [...prev, created]);
      // Reset leave input
      setNewLeaveStartDate("");
      setNewLeaveEndDate("");
      setNewLeaveStartTime("");
      setNewLeaveEndTime("");
      setNewLeaveNotes("");
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLeave = async (blockId: string) => {
    if (!staffMember) return;
    try {
      await removeStaffLeave(workspaceId, staffMember.id, blockId, token);
      setLeaveBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  // Handle Save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("First name and last name are required.");
      setActiveTab("profile");
      return;
    }

    if (contractedHours <= 0) {
      setErrorMsg("Contracted hours per week must be greater than 0.");
      setActiveTab("contract");
      return;
    }

    const minH = minHours ? parseFloat(minHours) : null;
    const maxH = maxHours ? parseFloat(maxHours) : null;
    if (minH !== null && maxH !== null && minH > maxH) {
      setErrorMsg("Minimum weekly hours cannot exceed maximum weekly hours.");
      setActiveTab("contract");
      return;
    }

    const payload: StaffMemberFormData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName.trim() || undefined,
      category,
      notes: notes.trim() || undefined,
      skill_ids: selectedSkillIds,
      contract: {
        contracted_hours_per_week: contractedHours,
        min_hours_per_week: minH,
        max_hours_per_week: maxH,
        max_shifts_per_week: maxShifts ? parseInt(maxShifts, 10) : null,
        max_consecutive_days: maxConsecutiveDays ? parseInt(maxConsecutiveDays, 10) : null,
        min_rest_hours_between_shifts: minRestHours,
      },
      availability_rules: availabilityRules.map((r) => ({
        weekday: r.weekday,
        is_available: r.is_available,
        start_time: r.start_time.trim() || null,
        end_time: r.end_time.trim() || null,
        is_recurring_day_off: r.is_recurring_day_off,
      })),
      unavailability_blocks: [],
    };

    try {
      setIsSubmitting(true);
      if (isEditing && staffMember) {
        await updateStaffMember(workspaceId, staffMember.id, token, payload);
      } else {
        await createStaffMember(workspaceId, token, payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("An unexpected error occurred while saving staff details.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 id="staff-modal-title" className="text-xl font-bold text-slate-900">
              {isEditing ? `Edit ${staffMember?.first_name} ${staffMember?.last_name}` : "Add New Staff Member"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure profile, contracts, skills, and weekly availability rules.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profile & Category</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contract")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "contract"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Contract & Hours</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("skills")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "skills"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Skills ({selectedSkillIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("availability")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "availability"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Weekly Availability</span>
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setActiveTab("leave")}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "leave"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Time Off & Leave ({leaveBlocks.length})</span>
            </button>
          )}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Validation Error</p>
                <p className="mt-0.5 text-xs text-red-600">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="staff-first-name" className="block text-sm font-medium text-slate-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="staff-first-name"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Sarah"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="staff-last-name" className="block text-sm font-medium text-slate-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="staff-last-name"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Jenkins"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="staff-display-name" className="block text-sm font-medium text-slate-700">
                  Display / Preferred Name <span className="text-xs text-slate-500">(Optional, shown on rotas)</span>
                </label>
                <input
                  id="staff-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sarah J"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Category Picker: Full-Time vs Restricted Hours */}
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Staff Category <span className="text-red-500">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm transition-all ${
                      category === "full_time"
                        ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="staff-category"
                      value="full_time"
                      checked={category === "full_time"}
                      onChange={() => {
                        setCategory("full_time");
                        if (!isEditing && contractedHours === 20.0) setContractedHours(37.5);
                      }}
                      className="sr-only"
                    />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        Full-Time Staff
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Standard full-time employment with regular contracted hours (default 37.5h/week).
                      </span>
                    </div>
                  </label>

                  <label
                    className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm transition-all ${
                      category === "restricted_hours"
                        ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="staff-category"
                      value="restricted_hours"
                      checked={category === "restricted_hours"}
                      onChange={() => {
                        setCategory("restricted_hours");
                        if (!isEditing && contractedHours === 37.5) setContractedHours(20.0);
                      }}
                      className="sr-only"
                    />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                        <span className="h-2 w-2 rounded-full bg-amber-600" />
                        Restricted Hours
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Part-time, student, or capped hours employees with specific availability constraints.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="staff-notes" className="block text-sm font-medium text-slate-700">
                  Manager Notes <span className="text-xs text-slate-500">(Private to workspace managers)</span>
                </label>
                <textarea
                  id="staff-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prefers Tuesday mornings or weekend shifts."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CONTRACT & HOURS */}
          {activeTab === "contract" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Custom Contract Rules</p>
                <p className="mt-1">
                  Do not assume all part-time or full-time staff have the same contracted hours.
                  Enter the specific contractual values for this team member below.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="staff-contracted-hours" className="block text-sm font-medium text-slate-700">
                    Contracted Paid Hours / Week <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="staff-contracted-hours"
                    type="number"
                    step="0.5"
                    min="1"
                    max="168"
                    required
                    value={contractedHours}
                    onChange={(e) => setContractedHours(parseFloat(e.target.value) || 0)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">E.g. 37.5, 20.0, or 16.0 hrs</p>
                </div>

                <div>
                  <label htmlFor="staff-min-hours" className="block text-sm font-medium text-slate-700">
                    Min Weekly Hours <span className="text-xs text-slate-500">(Optional)</span>
                  </label>
                  <input
                    id="staff-min-hours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="168"
                    value={minHours}
                    onChange={(e) => setMinHours(e.target.value)}
                    placeholder="None"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="staff-max-hours" className="block text-sm font-medium text-slate-700">
                    Max Weekly Hours <span className="text-xs text-slate-500">(Optional)</span>
                  </label>
                  <input
                    id="staff-max-hours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="168"
                    value={maxHours}
                    onChange={(e) => setMaxHours(e.target.value)}
                    placeholder="None"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="staff-max-shifts" className="block text-sm font-medium text-slate-700">
                    Max Shifts / Week
                  </label>
                  <input
                    id="staff-max-shifts"
                    type="number"
                    min="1"
                    max="14"
                    value={maxShifts}
                    onChange={(e) => setMaxShifts(e.target.value)}
                    placeholder="e.g. 5"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="staff-max-consec" className="block text-sm font-medium text-slate-700">
                    Max Consecutive Days
                  </label>
                  <input
                    id="staff-max-consec"
                    type="number"
                    min="1"
                    max="14"
                    value={maxConsecutiveDays}
                    onChange={(e) => setMaxConsecutiveDays(e.target.value)}
                    placeholder="e.g. 6"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="staff-min-rest" className="block text-sm font-medium text-slate-700">
                    Min Rest Between Shifts (hrs)
                  </label>
                  <input
                    id="staff-min-rest"
                    type="number"
                    step="0.5"
                    min="0"
                    max="48"
                    value={minRestHours}
                    onChange={(e) => setMinRestHours(parseFloat(e.target.value) || 0)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Default 11 hours rest</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Applicable Skills & Roles
                </label>
                {allSkills.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No skills created in this workspace yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allSkills.map((skill) => {
                      const isSelected = selectedSkillIds.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleToggleSkill(skill.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: skill.color }}
                          />
                          <span>{skill.name}</span>
                          {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inline Create Skill */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                  + Create New Skill
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="e.g. Supervisor, Barista, First Aid"
                    className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSkillColor(c)}
                        className={`h-5 w-5 rounded-full border-2 transition-transform ${
                          newSkillColor === c ? "scale-110 border-slate-900" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isCreatingSkill || !newSkillName.trim()}
                    onClick={handleAddNewSkill}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    Add Skill
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WEEKLY AVAILABILITY */}
          {activeTab === "availability" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Weekly Availability Matrix</p>
                <p className="mt-1">
                  Specify which weekdays this staff member can work. Check "Recurring Day Off" to guarantee
                  a regular weekly day off. Leave time range empty to indicate full-day availability.
                </p>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
                {availabilityRules.map((rule, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between p-3.5 gap-3 hover:bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <span className="font-semibold text-sm text-slate-900 w-24">
                        {WEEKDAYS[rule.weekday]}
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.is_available && !rule.is_recurring_day_off}
                          onChange={(e) => {
                            const updated = [...availabilityRules];
                            updated[idx].is_available = e.target.checked;
                            if (!e.target.checked) updated[idx].is_recurring_day_off = false;
                            setAvailabilityRules(updated);
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Available</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Recurring Day Off Checkbox */}
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.is_recurring_day_off}
                          onChange={(e) => {
                            const updated = [...availabilityRules];
                            updated[idx].is_recurring_day_off = e.target.checked;
                            if (e.target.checked) updated[idx].is_available = false;
                            setAvailabilityRules(updated);
                          }}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className={rule.is_recurring_day_off ? "text-amber-700 font-semibold" : ""}>
                          Recurring Day Off
                        </span>
                      </label>

                      {/* Time window */}
                      {!rule.is_recurring_day_off && rule.is_available && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <input
                            type="time"
                            value={rule.start_time}
                            onChange={(e) => {
                              const updated = [...availabilityRules];
                              updated[idx].start_time = e.target.value;
                              setAvailabilityRules(updated);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={rule.end_time}
                            onChange={(e) => {
                              const updated = [...availabilityRules];
                              updated[idx].end_time = e.target.value;
                              setAvailabilityRules(updated);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: LEAVE & UNAVAILABILITY (EDIT MODE ONLY) */}
          {activeTab === "leave" && isEditing && (
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900">
                <p className="font-semibold">Privacy & Sickness Policy</p>
                <p className="mt-0.5">
                  We do not collect medical details, doctors notes, or sensitive personal data. Sickness only records
                  the specific dates or times the team member was unavailable to work.
                </p>
              </div>

              {/* Current Leave Records */}
              <div>
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                  Existing Leave & Unavailability Records
                </h4>
                {leaveBlocks.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No approved leave or unavailability records registered.</p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {leaveBlocks.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                b.reason_category === "holiday"
                                  ? "bg-blue-100 text-blue-800"
                                  : b.reason_category === "sickness"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {b.reason_category}
                            </span>
                            <span className="text-xs font-medium text-slate-700">
                              {b.start_date} to {b.end_date}
                            </span>
                            {b.start_time && b.end_time && (
                              <span className="text-xs text-slate-500">
                                ({b.start_time} - {b.end_time})
                              </span>
                            )}
                          </div>
                          {b.notes && <p className="text-xs text-slate-500 italic">{b.notes}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteLeave(b.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label="Delete leave record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Leave Record Form */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  + Add Leave / Sickness Unavailability
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="staff-leave-reason" className="block text-xs font-medium text-slate-700">
                      Reason
                    </label>
                    <select
                      id="staff-leave-reason"
                      value={newLeaveReason}
                      onChange={(e) => setNewLeaveReason(e.target.value as LeaveReasonCategory)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="holiday">Approved Holiday</option>
                      <option value="sickness">Sickness Unavailable</option>
                      <option value="training">Training</option>
                      <option value="other">Other Unavailability</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="staff-leave-start" className="block text-xs font-medium text-slate-700">
                      Start Date
                    </label>
                    <input
                      id="staff-leave-start"
                      type="date"
                      value={newLeaveStartDate}
                      onChange={(e) => setNewLeaveStartDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-leave-end" className="block text-xs font-medium text-slate-700">
                      End Date
                    </label>
                    <input
                      id="staff-leave-end"
                      type="date"
                      value={newLeaveEndDate}
                      onChange={(e) => setNewLeaveEndDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label htmlFor="staff-leave-notes" className="block text-xs font-medium text-slate-700">
                      Operational Note <span className="text-slate-400 font-normal">(No medical details)</span>
                    </label>
                    <input
                      id="staff-leave-notes"
                      type="text"
                      value={newLeaveNotes}
                      onChange={(e) => setNewLeaveNotes(e.target.value)}
                      placeholder="e.g. Annual leave or unavailable"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLeave}
                    disabled={isSubmitting || !newLeaveStartDate || !newLeaveEndDate}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Record Leave</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Staff Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
