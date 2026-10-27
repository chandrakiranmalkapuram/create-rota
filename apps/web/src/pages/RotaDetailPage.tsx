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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchRotaDetail,
  updateRequirements,
  copyRequirements,
  generateRota,
} from "../services/rotaApi";
import { fetchStaffList } from "../services/staffApi";
import {
  RotaDetail,
  StaffingRequirementInput,
  StaffingRequirementBandInput,
} from "../types/rota";

export const RotaDetailPage: React.FC = () => {
  const { rotaId } = useParams<{ rotaId: string }>();
  const { currentWorkspace, token } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id || "";

  const [activeTab, setActiveTab] = useState<"requirements" | "generation" | "shifts">("requirements");
  const [timeLimit, setTimeLimit] = useState<number>(10.0);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Copy modal state
  const [copySourceDate, setCopySourceDate] = useState<string | null>(null);
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);

  // Fetch rota detail
  const { data: rota, isLoading, error } = useQuery<RotaDetail>({
    queryKey: ["rota", workspaceId, rotaId],
    queryFn: () => fetchRotaDetail(workspaceId, rotaId || "", token || ""),
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

  const generateMutation = useMutation({
    mutationFn: () => generateRota(workspaceId, rotaId || "", timeLimit, token || ""),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rota", workspaceId, rotaId] });
      queryClient.invalidateQueries({ queryKey: ["rotas", workspaceId] });
      if (data.latest_generation_status === "feasible" || data.latest_generation_status === "partially_feasible") {
        setActiveTab("shifts");
      }
    },
  });

  // Requirement editing helpers
  const handleAddBand = (dateStr: string) => {
    setLocalReqs((prev) =>
      prev.map((req) => {
        if (req.date !== dateStr) return req;
        const newBand: StaffingRequirementBandInput = {
          start_time: "09:00",
          end_time: "17:00",
          target_staff_count: 1,
          skill_id: null,
        };
        return { ...req, bands: [...req.bands, newBand] };
      })
    );
  };

  const handleRemoveBand = (dateStr: string, bandIdx: number) => {
    setLocalReqs((prev) =>
      prev.map((req) => {
        if (req.date !== dateStr) return req;
        return {
          ...req,
          bands: req.bands.filter((_, idx) => idx !== bandIdx),
        };
      })
    );
  };

  const handleUpdateBandField = (
    dateStr: string,
    bandIdx: number,
    field: keyof StaffingRequirementBandInput,
    value: any
  ) => {
    setLocalReqs((prev) =>
      prev.map((req) => {
        if (req.date !== dateStr) return req;
        const updatedBands = req.bands.map((b, idx) => {
          if (idx !== bandIdx) return b;
          return { ...b, [field]: value };
        });
        return { ...req, bands: updatedBands };
      })
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        <p className="mt-3 text-sm text-slate-500">Loading rota configuration...</p>
      </div>
    );
  }

  if (error || !rota) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Rota Not Found</h2>
        <p className="mt-1 text-sm text-slate-600">The requested rota could not be loaded.</p>
        <Link
          to="/rotas"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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
  });
  const endDateFormatted = new Date(rota.end_date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Calculate staff summary from generated shifts
  const staffHoursMap = new Map<
    string,
    { name: string; shiftCount: number; paidHours: number; contractedHours: number }
  >();

  if (staffData?.items) {
    for (const member of staffData.items) {
      if (!member.is_archived) {
        staffHoursMap.set(member.id, {
          name: `${member.first_name} ${member.last_name}`,
          shiftCount: 0,
          paidHours: 0,
          contractedHours: member.contract?.contracted_hours_per_week || 37.5,
        });
      }
    }
  }

  for (const s of rota.shifts) {
    const entry = staffHoursMap.get(s.staff_id);
    if (entry) {
      entry.shiftCount += 1;
      entry.paidHours = Math.round((entry.paidHours + s.paid_hours) * 100) / 100;
    }
  }

  const staffSummaryList = Array.from(staffHoursMap.values());

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumbs & Back */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <Link
          to="/rotas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Rotas</span>
        </Link>
        <span className="text-xs text-slate-500">Workspace: {currentWorkspace?.name}</span>
      </div>

      {/* Top Banner */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{rota.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                rota.status === "draft"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
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

      {/* Tabs */}
      <div className="mt-6 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("requirements")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === "shifts"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>3. Generated Draft Shifts ({rota.total_shifts})</span>
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

          <div className="grid grid-cols-1 gap-6">
            {localReqs.map((reqDay) => {
              const dayDate = new Date(reqDay.date);
              const dayName = dayDate.toLocaleDateString("en-GB", { weekday: "long" });
              const dateNice = dayDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={reqDay.date}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                        {dayName.slice(0, 3)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{dayName}</h3>
                        <span className="text-xs text-slate-500">{dateNice}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCopySourceDate(reqDay.date);
                          // Default target dates: all other dates in period
                          setCopyTargetDates(
                            localReqs.map((r) => r.date).filter((d) => d !== reqDay.date)
                          );
                          setIsCopyModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        title="Copy this day's demand to other dates"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Day</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddBand(reqDay.date)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Time Band</span>
                      </button>
                    </div>
                  </div>

                  {/* Bands list for this day */}
                  <div className="mt-4 space-y-3">
                    {reqDay.bands.length === 0 ? (
                      <p className="py-3 text-xs italic text-slate-400">
                        No staffing required on this day (Closed / Off).
                      </p>
                    ) : (
                      reqDay.bands.map((band, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-700">Hours:</span>
                            <input
                              type="text"
                              value={band.start_time}
                              onChange={(e) =>
                                handleUpdateBandField(reqDay.date, bIdx, "start_time", e.target.value)
                              }
                              className="w-18 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-900"
                              placeholder="09:00"
                            />
                            <span className="text-xs text-slate-400">to</span>
                            <input
                              type="text"
                              value={band.end_time}
                              onChange={(e) =>
                                handleUpdateBandField(reqDay.date, bIdx, "end_time", e.target.value)
                              }
                              className="w-18 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-900"
                              placeholder="17:00"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">Staff Count:</span>
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
          {/* Engine Card */}
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

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 font-medium">Time Limit:</span>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value={5.0}>5 seconds</option>
                    <option value={10.0}>10 seconds (Recommended)</option>
                    <option value={30.0}>30 seconds (Large rotas)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Play className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                  <span>{generateMutation.isPending ? "Solving Constraints..." : "Generate Rota"}</span>
                </button>
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
                          Solved in {rota.latest_run.solve_time_seconds} seconds •{" "}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Generated Shifts</span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{rota.total_shifts}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Paid Hours</span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{rota.total_paid_hours}h</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Active Staff Scheduled</span>
              <div className="mt-1 text-2xl font-bold text-emerald-600">
                {new Set(rota.shifts.map((s) => s.staff_id)).size} of {staffSummaryList.length}
              </div>
            </div>
          </div>

          {/* Shifts by Day */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Daily Shift Assignments
            </h2>

            {rota.shifts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No draft shifts generated yet. Go to the "Generation Engine" tab to run the solver.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {Array.from(new Set(rota.shifts.map((s) => s.date)))
                  .sort()
                  .map((dateStr) => {
                    const shiftsOnDay = rota.shifts.filter((s) => s.date === dateStr);
                    const dayDate = new Date(dateStr);
                    const dayLabel = dayDate.toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    });

                    return (
                      <div key={dateStr} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <span className="text-xs font-bold text-slate-900">{dayLabel}</span>
                          <span className="text-xs text-slate-500">
                            {shiftsOnDay.length} shifts ({shiftsOnDay.reduce((a, c) => a + c.paid_hours, 0)}h)
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {shiftsOnDay.map((shift) => (
                            <div
                              key={shift.id}
                              className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {shift.staff_name}
                                </span>
                                {shift.skill_name && (
                                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                                    {shift.skill_name}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <span className="font-mono text-slate-700">
                                  {shift.start_time} – {shift.end_time}
                                </span>
                                <span>{shift.paid_hours}h paid</span>
                              </div>
                              {shift.unpaid_break_minutes > 0 && (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  Includes {shift.unpaid_break_minutes}m unpaid break
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

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
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffSummaryList.map((st, idx) => {
                    const variance = Math.round((st.paidHours - st.contractedHours) * 10) / 10;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{st.contractedHours}h</td>
                        <td className="py-2.5 px-3 text-slate-600">{st.shiftCount}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{st.paidHours}h</td>
                        <td className="py-2.5 px-3">
                          {variance === 0 ? (
                            <span className="text-emerald-700 font-medium">On Target</span>
                          ) : variance > 0 ? (
                            <span className="text-amber-700 font-medium">+{variance}h over</span>
                          ) : (
                            <span className="text-slate-500 font-medium">{variance}h under</span>
                          )}
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

      {/* Copy Day Modal */}
      {isCopyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Copy Requirements from {copySourceDate}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select the dates you want to overwrite with this day's time bands and staff demand.
            </p>

            <div className="mt-4 max-h-60 overflow-y-auto space-y-2 border border-slate-200 p-3 rounded-lg">
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
    </div>
  );
};

export default RotaDetailPage;
