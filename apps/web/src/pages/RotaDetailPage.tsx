import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Timer,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Info,
  Save,
  Check,
  History,
  RotateCcw,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchRotaDetail,
  updateRequirements,
  copyRequirements,
  generateRota,
  fetchRotaSnapshots,
  restoreRotaSnapshot,
} from "../services/rotaApi";
import { fetchStaffList } from "../services/staffApi";
import {
  RotaDetail,
  RotaSnapshot,
  StaffingRequirementInput,
  StaffingRequirementBandInput,
  BreakPolicyInput,
} from "../types/rota";
import { WeeklyRotaGrid } from "../components/WeeklyRotaGrid";

export const RotaDetailPage: React.FC = () => {
  const { rotaId } = useParams<{ rotaId: string }>();
  const { currentWorkspace, token } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id || "";

  const [activeTab, setActiveTab] = useState<"requirements" | "generation" | "shifts" | "snapshots">("requirements");
  const [timeLimit, setTimeLimit] = useState<number>(10.0);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [breakPolicyPreset, setBreakPolicyPreset] = useState<"standard" | "uk_statutory" | "no_breaks">("standard");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Copy modal state
  const [copySourceDate, setCopySourceDate] = useState<string | null>(null);
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);

  // Restore snapshot modal state
  const [snapshotToRestore, setSnapshotToRestore] = useState<RotaSnapshot | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);

  // Fetch rota detail
  const { data: rota, isLoading, error } = useQuery<RotaDetail>({
    queryKey: ["rota", workspaceId, rotaId],
    queryFn: () => fetchRotaDetail(workspaceId, rotaId || "", token || ""),
    enabled: Boolean(workspaceId && rotaId && token),
  });

  // Fetch snapshots list
  const { data: snapshots = [], isLoading: isLoadingSnapshots } = useQuery<RotaSnapshot[]>({
    queryKey: ["rota_snapshots", workspaceId, rotaId],
    queryFn: () => fetchRotaSnapshots(workspaceId, rotaId || "", token || ""),
    enabled: Boolean(workspaceId && rotaId && token),
  });

  // Fetch staff list for skills & summaries
  const { data: staffData } = useQuery({
    queryKey: ["staff", workspaceId],
    queryFn: () => fetchStaffList(workspaceId, token || "", { pageSize: 100 }),
    enabled: Boolean(workspaceId && token),
  });

  // Extract unique skills in workspace
  const workspaceSkills = React.useMemo(() => {
    if (!staffData?.items) return [];
    const skillMap = new Map<string, { id: string; name: string; color: string }>();
    for (const staff of staffData.items) {
      for (const sk of staff.skills) {
        if (!skillMap.has(sk.id)) skillMap.set(sk.id, sk);
      }
    }
    return Array.from(skillMap.values());
  }, [staffData]);

  // Requirements local draft state for quick editing
  const [localReqs, setLocalReqs] = useState<StaffingRequirementInput[]>([]);

  React.useEffect(() => {
    if (rota?.requirements) {
      setLocalReqs(
        rota.requirements.map((r) => ({
          date: r.date,
          bands: r.bands.map((b) => ({
            start_time: b.start_time,
            end_time: b.end_time,
            target_staff_count: b.target_staff_count,
            skill_id: b.skill_id,
          })),
        }))
      );
    }
  }, [rota?.requirements]);

  // Mutations
  const saveReqsMutation = useMutation({
    mutationFn: () => updateRequirements(workspaceId, rotaId || "", localReqs, token || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
      setSaveSuccessMessage("Staffing requirements saved successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    },
  });

  const copyMutation = useMutation({
    mutationFn: () =>
      copyRequirements(workspaceId, rotaId || "", copySourceDate || "", copyTargetDates, token || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
      setIsCopyModalOpen(false);
      setCopySourceDate(null);
      setCopyTargetDates([]);
      setSaveSuccessMessage("Requirements copied successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    },
  });

  // Resolve break policy configuration based on preset
  const resolvedBreakPolicy: BreakPolicyInput = React.useMemo(() => {
    if (breakPolicyPreset === "uk_statutory") {
      return {
        name: "uk_statutory",
        description: "UK Working Time Regulations (20m unpaid break for shifts >= 6 hours)",
        tiers: [{ threshold_minutes: 360, break_minutes: 20, is_unpaid: true }],
      };
    }
    if (breakPolicyPreset === "no_breaks") {
      return {
        name: "no_breaks",
        description: "All hours paid (no unpaid break deductions)",
        tiers: [],
      };
    }
    return {
      name: "standard",
      description: "Standard workplace policy (30m break for >=6h, 45m for >=8h)",
      tiers: [
        { threshold_minutes: 360, break_minutes: 30, is_unpaid: true },
        { threshold_minutes: 480, break_minutes: 45, is_unpaid: true },
      ],
    };
  }, [breakPolicyPreset]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateRota(
        workspaceId,
        rotaId || "",
        {
          timeLimitSeconds: timeLimit,
          randomSeed: randomSeed,
          breakPolicy: resolvedBreakPolicy,
        },
        token || ""
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
      queryClient.invalidateQueries({ queryKey: ["rota_snapshots", workspaceId, rotaId] });
      const statusText = data.latest_run?.status.replace("_", " ") || "completed";
      setSaveSuccessMessage(`Schedule generation completed: ${statusText}.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (snapId: string) => restoreRotaSnapshot(workspaceId, rotaId || "", snapId, token || ""),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
      queryClient.invalidateQueries({ queryKey: ["rota_snapshots", workspaceId, rotaId] });
      setIsRestoreModalOpen(false);
      setSnapshotToRestore(null);
      setSaveSuccessMessage(data.message);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    },
  });

  // Helpers to manipulate local staffing requirements draft
  const handleAddBand = (dateStr: string) => {
    setLocalReqs((prev) =>
      prev.map((r) => {
        if (r.date === dateStr) {
          return {
            ...r,
            bands: [
              ...r.bands,
              {
                start_time: "09:00",
                end_time: "17:00",
                target_staff_count: 1,
                skill_id: null,
              },
            ],
          };
        }
        return r;
      })
    );
  };

  const handleRemoveBand = (dateStr: string, bandIndex: number) => {
    setLocalReqs((prev) =>
      prev.map((r) => {
        if (r.date === dateStr) {
          const updated = [...r.bands];
          updated.splice(bandIndex, 1);
          return { ...r, bands: updated };
        }
        return r;
      })
    );
  };

  const handleUpdateBandField = (
    dateStr: string,
    bandIndex: number,
    field: keyof StaffingRequirementBandInput,
    val: any
  ) => {
    setLocalReqs((prev) =>
      prev.map((r) => {
        if (r.date === dateStr) {
          const updated = [...r.bands];
          updated[bandIndex] = {
            ...updated[bandIndex],
            [field]: val,
          };
          return { ...r, bands: updated };
        }
        return r;
      })
    );
  };

  const openCopyModalForDate = (dateStr: string) => {
    setCopySourceDate(dateStr);
    setCopyTargetDates([]);
    setIsCopyModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !rota) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {(error as Error)?.message || "Failed to load rota details."}
        </div>
        <Link
          to="/rotas"
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Rotas</span>
        </Link>
      </div>
    );
  }

  const startDateFormatted = new Date(rota.start_date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const endDateFormatted = new Date(rota.end_date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Calculate staff scheduled summary
  const staffSummaryList = staffData?.items || [];
  const staffShiftCountMap = new Map<string, number>();
  const staffHoursMap = new Map<string, number>();

  for (const shift of rota.shifts) {
    staffShiftCountMap.set(shift.staff_id, (staffShiftCountMap.get(shift.staff_id) || 0) + 1);
    staffHoursMap.set(shift.staff_id, (staffHoursMap.get(shift.staff_id) || 0) + shift.paid_hours);
  }

  // Calculate gross, break, and paid totals
  const totalUnpaidBreakHours = roundToTwo(
    rota.shifts.reduce((acc, s) => acc + s.unpaid_break_minutes / 60.0, 0)
  );
  const totalGrossHours = roundToTwo(rota.total_paid_hours + totalUnpaidBreakHours);

  function roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Navigation */}
      <div className="mb-4">
        <Link
          to="/rotas"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Rotas</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{rota.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                rota.status === "published"
                  ? "bg-blue-100 text-blue-800"
                  : rota.status === "archived"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {rota.status}
            </span>

            {rota.latest_generation_status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  rota.latest_generation_status === "feasible"
                    ? "bg-emerald-100 text-emerald-800"
                    : rota.latest_generation_status === "partially_feasible"
                    ? "bg-amber-100 text-amber-800"
                    : rota.latest_generation_status === "infeasible"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {rota.latest_generation_status === "feasible" && <CheckCircle2 className="h-3 w-3" />}
                {rota.latest_generation_status === "partially_feasible" && (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {rota.latest_generation_status === "infeasible" && <XCircle className="h-3 w-3" />}
                {rota.latest_generation_status === "timeout" && <Timer className="h-3 w-3" />}
                <span className="capitalize">{rota.latest_generation_status.replace("_", " ")}</span>
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {startDateFormatted} — {endDateFormatted}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500">Shifts / Hours</div>
            <div className="text-sm font-bold text-slate-900">
              {rota.total_shifts} shifts ({rota.total_paid_hours}h)
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("generation")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>Engine Controls</span>
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mt-6 flex flex-wrap border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("requirements")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "requirements"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>1. Staffing Demand Requirements</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("generation")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "generation"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>2. Generation Engine & Diagnostics</span>
          {rota.latest_run && (
            <span
              className={`rounded-full px-2 py-0.2 text-[10px] uppercase font-bold ${
                rota.latest_run.status === "feasible"
                  ? "bg-emerald-100 text-emerald-800"
                  : rota.latest_run.status === "partially_feasible"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {rota.latest_run.status}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shifts")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "shifts"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>3. Generated Draft Shifts ({rota.total_shifts})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("snapshots")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "snapshots"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="h-4 w-4" />
          <span>4. Version History (Snapshots)</span>
          {snapshots.length > 0 && (
            <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.2 text-[10px] font-bold">
              {snapshots.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Requirements Editor */}
      {activeTab === "requirements" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Configure Daily Time Bands</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set required start/end hours, headcount, and mandatory skills for each day.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => saveReqsMutation.mutate()}
                disabled={saveReqsMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveReqsMutation.isPending ? "Saving..." : "Save Requirements"}</span>
              </button>
            </div>
          </div>

          {/* Daily Requirements List */}
          <div className="space-y-4">
            {localReqs.map((reqDay) => {
              const dayDate = new Date(reqDay.date);
              const dayOfWeek = dayDate.toLocaleDateString("en-GB", { weekday: "long" });
              const dayFormatted = dayDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={reqDay.date}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {dayOfWeek}, {dayFormatted}
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">{reqDay.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCopyModalForDate(reqDay.date)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Day to...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddBand(reqDay.date)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Time Band</span>
                      </button>
                    </div>
                  </div>

                  {/* Bands container */}
                  <div className="mt-4 space-y-3">
                    {reqDay.bands.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                        No staffing bands required for this day (Day off / Closed).
                      </div>
                    ) : (
                      reqDay.bands.map((band, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-700">Start:</span>
                            <input
                              type="time"
                              value={band.start_time}
                              onChange={(e) =>
                                handleUpdateBandField(reqDay.date, bIdx, "start_time", e.target.value)
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 font-mono"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">End:</span>
                            <input
                              type="time"
                              value={band.end_time}
                              onChange={(e) =>
                                handleUpdateBandField(reqDay.date, bIdx, "end_time", e.target.value)
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 font-mono"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">Staff Target:</span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={band.target_staff_count}
                              onChange={(e) =>
                                handleUpdateBandField(
                                  reqDay.date,
                                  bIdx,
                                  "target_staff_count",
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 font-semibold"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">Required Skill:</span>
                            <select
                              value={band.skill_id || ""}
                              onChange={(e) =>
                                handleUpdateBandField(
                                  reqDay.date,
                                  bIdx,
                                  "skill_id",
                                  e.target.value ? e.target.value : null
                                )
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                            >
                              <option value="">Any Staff Member</option>
                              {workspaceSkills.map((sk) => (
                                <option key={sk.id} value={sk.id}>
                                  {sk.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveBand(reqDay.date, bIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove Band"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Generation Engine & Diagnostics */}
      {activeTab === "generation" && (
        <div className="mt-6 space-y-6">
          {/* Engine Parameters Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <Sparkles className="h-3 w-3" />
                    CP-SAT Solver
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Google OR-Tools</span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-slate-900">
                  Constraint-Based Schedule Generator
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 max-w-xl">
                  Enforces mandatory hard constraints (staff availability, approved leave blocks, required skills, 11-hour minimum rest, maximum weekly shifts & hours) and optimizes soft contract hours and fair distribution.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || rota.status !== "draft"}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Play className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                  <span>{generateMutation.isPending ? "Solving Constraints..." : "Generate Rota"}</span>
                </button>
              </div>
            </div>

            {/* Configurable Solver Settings Grid */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Solver Time Limit:
                </label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value={5.0}>5 seconds (Fast)</option>
                  <option value={10.0}>10 seconds (Recommended)</option>
                  <option value={30.0}>30 seconds (Large periods)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Random Seed (Deterministic):
                </label>
                <input
                  type="number"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Identical seeds produce repeatable schedules</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Break Calculation Policy:
                </label>
                <select
                  value={breakPolicyPreset}
                  onChange={(e) => setBreakPolicyPreset(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="standard">Standard (30m for 6h+, 45m for 8h+)</option>
                  <option value="uk_statutory">UK Statutory (20m for 6h+)</option>
                  <option value="no_breaks">No Unpaid Breaks (100% paid)</option>
                </select>
              </div>
            </div>

            {/* Assumptions & Compliance Disclaimer Banner */}
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-900 block mb-0.5">
                    Calculation Assumptions & Compliance Transparency
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Active Break Policy: <span className="font-semibold text-slate-800">{resolvedBreakPolicy.description}</span>.
                    Rest Period: <span className="font-semibold text-slate-800">11 hours minimum</span> between shifts across adjacent days.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 italic">
                    Notice: Configured rota rules, rest intervals, and fairness indicators are mathematical optimizations based on your workspace settings. They do not constitute formal employment-law advice or an official guarantee of statutory compliance.
                  </p>
                </div>
              </div>
            </div>

            {/* Latest Run Diagnostics Banner */}
            {rota.latest_run ? (
              <div className="mt-6">
                <div
                  className={`rounded-xl p-5 border ${
                    rota.latest_run.status === "feasible"
                      ? "bg-emerald-50/70 border-emerald-200"
                      : rota.latest_run.status === "partially_feasible"
                      ? "bg-amber-50/70 border-amber-200"
                      : rota.latest_run.status === "infeasible"
                      ? "bg-rose-50/70 border-rose-200"
                      : "bg-purple-50/70 border-purple-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {rota.latest_run.status === "feasible" && (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      )}
                      {rota.latest_run.status === "partially_feasible" && (
                        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                      )}
                      {rota.latest_run.status === "infeasible" && (
                        <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                      )}
                      {rota.latest_run.status === "timeout" && (
                        <Timer className="h-6 w-6 text-purple-600 shrink-0" />
                      )}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 capitalize">
                          Outcome: {rota.latest_run.status.replace("_", " ")} Schedule
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Solved in {rota.latest_run.solve_time_seconds}s •{" "}
                          {rota.latest_run.shifts_created} shifts generated •{" "}
                          {rota.latest_run.coverage_score}% demand coverage
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 shadow-xs text-slate-700">
                      Run ID: {rota.latest_run.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Diagnostic items breakdown */}
                  <div className="mt-4 border-t border-slate-200/50 pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                      Engine Findings & Unresolved Requirements:
                    </span>
                    <ul className="space-y-2 text-xs">
                      {rota.latest_run.diagnostics.map((diag, dIdx) => (
                        <li
                          key={dIdx}
                          className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                            diag.type === "error"
                              ? "bg-rose-100/60 border-rose-200 text-rose-900"
                              : diag.type === "warning"
                              ? "bg-amber-100/60 border-amber-200 text-amber-900"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          {diag.type === "error" && (
                            <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          )}
                          {diag.type === "warning" && (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                          )}
                          {diag.type === "info" && (
                            <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <span className="font-medium">{diag.message}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Actionable Relaxation Suggestions Panel */}
                {rota.latest_run.relaxation_suggestions &&
                  rota.latest_run.relaxation_suggestions.length > 0 && (
                    <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-sm font-bold text-indigo-950">
                          Actionable Constraint Relaxation Suggestions
                        </h3>
                      </div>
                      <p className="text-xs text-indigo-900/80 mb-4">
                        The scheduler identified the following potential adjustments to help resolve unmet coverage. Recommendations are never applied automatically without your review.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {rota.latest_run.relaxation_suggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="rounded-lg border border-indigo-200 bg-white p-3.5 shadow-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-bold text-slate-900">{sug.title}</span>
                                {sug.is_confirmed ? (
                                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                    Confirmed Finding
                                  </span>
                                ) : (
                                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                                    Recommendation
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 text-xs leading-relaxed">
                                {sug.description}
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                              <span className="capitalize font-medium text-indigo-700">
                                Category: {sug.category.replace("_", " ")}
                              </span>
                              <span className="text-slate-400 italic">{sug.potential_impact}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="mt-6 py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-2 text-sm font-semibold text-slate-700">
                  Ready to Run OR-Tools Generation
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Click the button above to solve your staffing requirements against all staff availability rules, contracts, and skills.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Generated Shifts Schedule */}
      {activeTab === "shifts" && (
        <div className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Generated Shifts</span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{rota.total_shifts}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Gross Shift Hours</span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{totalGrossHours}h</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Unpaid Breaks</span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{totalUnpaidBreakHours}h</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Net Paid Hours</span>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{rota.total_paid_hours}h</div>
            </div>
          </div>

          {/* Transparent Break Calculation Explanation Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Calculation Breakdown: Gross Hours ({totalGrossHours}h) minus Unpaid Breaks ({totalUnpaidBreakHours}h) = Net Paid Hours ({rota.total_paid_hours}h).
              </span>
            </div>
            <span className="text-slate-400 font-medium">
              Policy: {breakPolicyPreset === "standard" ? "Standard (30m >=6h, 45m >=8h)" : breakPolicyPreset}
            </span>
          </div>

          {/* Weekly Rota Grid Matrix & Schedule Editor */}
          <WeeklyRotaGrid
            rota={rota}
            staffList={staffData?.items || []}
            skillsList={workspaceSkills}
            onRotaUpdated={(updated) => {
              if (workspaceId && rotaId) {
                queryClient.setQueryData(["rota", workspaceId, rotaId], updated);
                queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
              }
            }}
          />

          {/* Workload and Contract Hours Balance Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Staff Hours & Contract Tracking
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Weekly Contract</th>
                    <th className="py-2.5 px-3">Assigned Shifts</th>
                    <th className="py-2.5 px-3">Assigned Paid Hours</th>
                    <th className="py-2.5 px-3">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffSummaryList.map((st) => {
                    const shiftsCount = staffShiftCountMap.get(st.id) || 0;
                    const assignedHrs = staffHoursMap.get(st.id) || 0;
                    const contractHrs = st.contract?.contracted_hours_per_week ?? 37.5;
                    const diff = roundToTwo(assignedHrs - contractHrs);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {st.first_name} {st.last_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{contractHrs}h/wk</td>
                        <td className="py-2.5 px-3 text-slate-600">{shiftsCount}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{assignedHrs}h</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-semibold ${
                              diff === 0
                                ? "text-slate-400"
                                : diff > 0
                                ? "text-amber-600"
                                : "text-blue-600"
                            }`}
                          >
                            {diff > 0 ? `+${diff}h` : `${diff}h`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Version Snapshots & Restoration */}
      {activeTab === "snapshots" && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Draft Version Snapshots</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Snapshots are automatically created before each solver regeneration or restoration, preserving your work history.
                </p>
              </div>
            </div>

            {isLoadingSnapshots ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading version snapshots...</div>
            ) : snapshots.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No draft snapshots saved yet. Snapshots will appear automatically when you run schedule generation.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <th className="py-2.5 px-3">Snapshot Timestamp</th>
                      <th className="py-2.5 px-3">Trigger Reason</th>
                      <th className="py-2.5 px-3">Shifts Count</th>
                      <th className="py-2.5 px-3">Demand Coverage</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshots.map((snap) => {
                      const snapDate = new Date(snap.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      return (
                        <tr key={snap.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono text-slate-800">{snapDate}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                snap.snapshot_reason === "pre_generation"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : snap.snapshot_reason === "pre_restore"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {snap.snapshot_reason.replace("_", " ")}
                            </span>
                            {snap.description && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {snap.description}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{snap.shifts_count} shifts</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">
                            {snap.coverage_score}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSnapshotToRestore(snap);
                                setIsRestoreModalOpen(true);
                              }}
                              disabled={rota.status !== "draft"}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                              <span>Restore Draft</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Copy Requirements Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Copy Requirements from {copySourceDate}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Select the dates you want to duplicate these staffing bands to. Existing bands on target dates will be overwritten.
            </p>

            <div className="mt-4 max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
              {localReqs
                .filter((r) => r.date !== copySourceDate)
                .map((r) => {
                  const isChecked = copyTargetDates.includes(r.date);
                  const dObj = new Date(r.date);
                  const label = `${dObj.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}`;

                  return (
                    <label
                      key={r.date}
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCopyTargetDates((prev) => [...prev, r.date]);
                          } else {
                            setCopyTargetDates((prev) => prev.filter((d) => d !== r.date));
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium text-slate-800">{label}</span>
                    </label>
                  );
                })}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => copyMutation.mutate()}
                disabled={copyTargetDates.length === 0 || copyMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {copyMutation.isPending ? "Copying..." : "Apply Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Snapshot Confirmation Modal */}
      {isRestoreModalOpen && snapshotToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Draft Restoration</h3>
                <span className="text-xs text-slate-500">
                  Snapshot: {new Date(snapshotToRestore.created_at).toLocaleString("en-GB")}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              <p className="font-semibold">Notice before restoring:</p>
              <p className="mt-1 text-slate-700 leading-relaxed">
                Restoring will replace the current draft shifts with the {snapshotToRestore.shifts_count} shifts recorded in this snapshot.
              </p>
              <p className="mt-2 text-slate-600">
                A safety snapshot of your current draft shifts will be taken automatically before restoring, ensuring you can undo this operation.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setSnapshotToRestore(null);
                }}
                disabled={restoreMutation.isPending}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => restoreMutation.mutate(snapshotToRestore.id)}
                disabled={restoreMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {restoreMutation.isPending ? "Restoring Draft..." : "Confirm & Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotaDetailPage;
