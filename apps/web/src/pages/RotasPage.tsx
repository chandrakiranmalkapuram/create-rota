import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  ChevronRight,
  Filter,
  Users,
  Timer,
  Sparkles,
  Copy,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchRotas, createRota, deleteRota } from "../services/rotaApi";
import { Rota, RotaCreateInput } from "../types/rota";
import { DuplicateRotaModal } from "../components/DuplicateRotaModal";

export const RotasPage: React.FC = () => {
  const { currentWorkspace, token } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [rotaToDuplicate, setRotaToDuplicate] = useState<Rota | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState<string>(() => {
    // Default to next Monday
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() + ((7 - day + 1) % 7 || 7);
    const nextMon = new Date(today.setDate(diff));
    return nextMon.toISOString().split("T")[0];
  });
  const [formEndDate, setFormEndDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() + ((7 - day + 1) % 7 || 7) + 6;
    const nextSun = new Date(today.setDate(diff));
    return nextSun.toISOString().split("T")[0];
  });
  const [defaultBandStart, setDefaultBandStart] = useState<string>("09:00");
  const [defaultBandEnd, setDefaultBandEnd] = useState<string>("17:00");
  const [defaultStaffCount, setDefaultStaffCount] = useState<number>(2);
  const [formError, setFormError] = useState<string | null>(null);

  const workspaceId = currentWorkspace?.id || "";

  // Queries
  const { data, isLoading, error } = useQuery({
    queryKey: ["rotas", workspaceId, page, statusFilter],
    queryFn: () => fetchRotas(workspaceId, token || "", page, 20, statusFilter),
    enabled: Boolean(workspaceId && token),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: RotaCreateInput) => createRota(workspaceId, input, token || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas", workspaceId] });
      setIsCreateModalOpen(false);
      setFormName("");
      setFormError(null);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (rotaId: string) => deleteRota(workspaceId, rotaId, token || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas", workspaceId] });
      setDeleteConfirmationId(null);
    },
  });

  const handleQuickPeriod = (type: "this_week" | "next_week" | "two_weeks") => {
    const now = new Date();
    const day = now.getDay();
    const distanceToMonday = (day === 0 ? -6 : 1) - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + distanceToMonday);

    if (type === "this_week") {
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setFormStartDate(mon.toISOString().split("T")[0]);
      setFormEndDate(sun.toISOString().split("T")[0]);
      setFormName(`Week Commencing ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    } else if (type === "next_week") {
      const nextMon = new Date(mon);
      nextMon.setDate(mon.getDate() + 7);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      setFormStartDate(nextMon.toISOString().split("T")[0]);
      setFormEndDate(nextSun.toISOString().split("T")[0]);
      setFormName(`Week Commencing ${nextMon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    } else if (type === "two_weeks") {
      const sun2 = new Date(mon);
      sun2.setDate(mon.getDate() + 13);
      setFormStartDate(mon.toISOString().split("T")[0]);
      setFormEndDate(sun2.toISOString().split("T")[0]);
      setFormName(`Fortnight Commencing ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Please enter a rota name.");
      return;
    }
    if (formStartDate > formEndDate) {
      setFormError("Start date must be before or equal to end date.");
      return;
    }
    setFormError(null);
    createMutation.mutate({
      name: formName.trim(),
      start_date: formStartDate,
      end_date: formEndDate,
      default_band_start: defaultBandStart,
      default_band_end: defaultBandEnd,
      default_staff_count: defaultStaffCount,
    });
  };

  const rotas = data?.items || [];
  const draftCount = rotas.filter((r) => r.status === "draft").length;
  const feasibleCount = rotas.filter((r) => r.latest_generation_status === "feasible").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              OR-Tools Scheduling Engine
            </span>
            <span className="text-xs text-slate-500 font-medium">Milestone 4</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Rotas & Generation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define daily staffing demand, configure time bands, and generate optimized schedules with mathematical constraint satisfaction.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(true);
            if (!formName) handleQuickPeriod("next_week");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          aria-label="Create Rota"
        >
          <Plus className="h-4 w-4" />
          <span>Create Rota</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Rotas</span>
            <CalendarClock className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{data?.total || 0}</div>
          <p className="mt-1 text-xs text-slate-500">Configured rota periods</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Draft Plans</span>
            <Calendar className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600">{draftCount}</div>
          <p className="mt-1 text-xs text-slate-500">Currently in draft state</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Feasible Solutions</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">{feasibleCount}</div>
          <p className="mt-1 text-xs text-slate-500">100% hard & soft coverage</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Constraint Engine</span>
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-3 text-sm font-bold text-slate-900">Google OR-Tools CP-SAT</div>
          <p className="mt-1 text-xs text-slate-500">Zero greedy heuristics</p>
        </div>
      </div>

      {/* Filter and Content */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 px-6 py-4 gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Filter Status:
            </span>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              {(["all", "draft", "published", "archived"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-slate-500">
            Showing {rotas.length} of {data?.total || 0} rotas
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="mt-2 text-sm text-slate-500">Loading rotas...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-rose-600">Failed to load rotas.</p>
          </div>
        ) : rotas.length === 0 ? (
          <div className="py-16 text-center px-4">
            <CalendarClock className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No rotas created yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              Create your first rota to configure daily staffing demand and generate shift schedules.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(true);
                handleQuickPeriod("next_week");
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Rota</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rotas.map((rota) => {
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

              return (
                <div
                  key={rota.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/75 transition-colors gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/rotas/${rota.id}`}
                        className="text-base font-semibold text-slate-900 hover:text-emerald-700 truncate"
                      >
                        {rota.name}
                      </Link>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                          rota.status === "draft"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : rota.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {rota.status}
                      </span>

                      {/* Engine outcome badge */}
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
                          {rota.latest_generation_status === "feasible" && (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {rota.latest_generation_status === "partially_feasible" && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {rota.latest_generation_status === "infeasible" && (
                            <XCircle className="h-3 w-3" />
                          )}
                          {rota.latest_generation_status === "timeout" && (
                            <Timer className="h-3 w-3" />
                          )}
                          <span className="capitalize">
                            {rota.latest_generation_status.replace("_", " ")}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {startDateFormatted} — {endDateFormatted}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {rota.total_shifts} shifts generated
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {rota.total_paid_hours}h paid hours
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRotaToDuplicate(rota)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                      title={`Duplicate rota ${rota.name}`}
                      aria-label={`Duplicate rota ${rota.name}`}
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Duplicate</span>
                    </button>

                    <Link
                      to={`/rotas/${rota.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <span>Configure & Generate</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>

                    {rota.status === "published" ? (
                      <span
                        className="inline-flex items-center p-1.5 text-slate-300 cursor-not-allowed"
                        title="Published rotas cannot be deleted directly. Unpublish or archive first."
                        aria-label="Published rotas cannot be deleted directly"
                      >
                        <Trash2 className="h-4 w-4" />
                      </span>
                    ) : deleteConfirmationId === rota.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                        <span className="text-xs text-rose-700 px-1 font-medium">Delete?</span>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(rota.id)}
                          className="rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmationId(null)}
                          className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmationId(rota.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Delete Rota"
                        aria-label={`Delete rota ${rota.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Page {data.page} of {data.total_pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Rota Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-rota-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 id="create-rota-title" className="text-lg font-bold text-slate-900">
                  Create New Rota Period
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the scheduling dates and default daily requirements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="rota-name-input" className="block text-xs font-semibold text-slate-700">
                  Rota Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="rota-name-input"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Week Commencing 09 Nov"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Period Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quick Period Shortcuts
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("this_week")}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Current Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("next_week")}
                    className="rounded-lg border border-emerald-300 bg-emerald-50/50 px-2 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    Next Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("two_weeks")}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    2-Week Fortnight
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date-input" className="block text-xs font-semibold text-slate-700">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="start-date-input"
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="end-date-input" className="block text-xs font-semibold text-slate-700">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="end-date-input"
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Default Template Settings */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Default Daily Staffing Demand Template
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically initializes each date in this period with this band. You can customize each day individually later.
                </p>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="band-start-input" className="block text-xs font-medium text-slate-600">
                      Start Time
                    </label>
                    <input
                      id="band-start-input"
                      type="text"
                      value={defaultBandStart}
                      onChange={(e) => setDefaultBandStart(e.target.value)}
                      placeholder="09:00"
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="band-end-input" className="block text-xs font-medium text-slate-600">
                      End Time
                    </label>
                    <input
                      id="band-end-input"
                      type="text"
                      value={defaultBandEnd}
                      onChange={(e) => setDefaultBandEnd(e.target.value)}
                      placeholder="17:00"
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-count-input" className="block text-xs font-medium text-slate-600">
                      Staff / Day
                    </label>
                    <input
                      id="staff-count-input"
                      type="number"
                      min={1}
                      max={20}
                      value={defaultStaffCount}
                      onChange={(e) => setDefaultStaffCount(parseInt(e.target.value, 10) || 1)}
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating Rota..." : "Create Rota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Rota Modal */}
      {rotaToDuplicate && (
        <DuplicateRotaModal
          isOpen={Boolean(rotaToDuplicate)}
          onClose={() => setRotaToDuplicate(null)}
          rota={rotaToDuplicate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["rotas", workspaceId] });
            setRotaToDuplicate(null);
          }}
        />
      )}
    </div>
  );
};

export default RotasPage;
