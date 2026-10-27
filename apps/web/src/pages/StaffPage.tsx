import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Archive,
  RotateCcw,
  Eye,
  Edit,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { StaffMember } from "../types/staff";
import {
  fetchStaffList,
  archiveStaffMember,
  reactivateStaffMember,
  deleteStaffMember,
} from "../services/staffApi";
import { StaffModal } from "../components/StaffModal";
import { StaffDetailModal } from "../components/StaffDetailModal";

export const StaffPage: React.FC = () => {
  const { currentWorkspace, token } = useAuth();

  // State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [viewTab, setViewTab] = useState<"active" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [detailStaff, setDetailStaff] = useState<StaffMember | null>(null);

  const loadStaff = useCallback(async () => {
    if (!currentWorkspace || !token) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetchStaffList(currentWorkspace.id, token, {
        page,
        pageSize: 15,
        search: searchQuery,
        category: categoryFilter,
        isArchived: viewTab === "archived",
      });
      setStaffList(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg("Failed to load staff list.");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, token, page, searchQuery, categoryFilter, viewTab]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setIsModalOpen(true);
  };

  const handleArchive = async (staff: StaffMember) => {
    if (!currentWorkspace || !token) return;
    try {
      await archiveStaffMember(currentWorkspace.id, staff.id, token);
      setSuccessMsg(`${staff.first_name} ${staff.last_name} was archived successfully.`);
      loadStaff();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  const handleReactivate = async (staff: StaffMember) => {
    if (!currentWorkspace || !token) return;
    try {
      await reactivateStaffMember(currentWorkspace.id, staff.id, token);
      setSuccessMsg(`${staff.first_name} ${staff.last_name} was reactivated.`);
      loadStaff();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  const handleDelete = async (staff: StaffMember) => {
    if (!currentWorkspace || !token) return;
    try {
      await deleteStaffMember(currentWorkspace.id, staff.id, token);
      setSuccessMsg(`${staff.first_name} ${staff.last_name} has been permanently deleted.`);
      loadStaff();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  // Stats calculation
  const fullTimeCount = staffList.filter((s) => s.category === "full_time").length;
  const restrictedHoursCount = staffList.filter((s) => s.category === "restricted_hours").length;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Page Header */}
      <div className="border-b border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                <Users className="h-4 w-4" />
                <span>Workspace Staff Management</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Team Members & Availability
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage contracts, weekly availability rules, qualified skills, and approved time off.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Flash Notifications */}
        {successMsg && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold text-red-700 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500">Total in View</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
              <span className="text-xs text-slate-400">members</span>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs">
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Full-Time
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{fullTimeCount}</span>
              <span className="text-xs text-slate-400">staff</span>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-xs">
            <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600" />
              Restricted Hours
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{restrictedHoursCount}</span>
              <span className="text-xs text-slate-400">staff</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Archive className="h-3 w-3" />
              Mode
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-800 capitalize">{viewTab} Staff</span>
            </div>
          </div>
        </div>

        {/* Filter and Tab Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          {/* Active / Archived Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setViewTab("active");
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewTab === "active"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTab("archived");
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewTab === "archived"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Archived Staff
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-1.5 text-xs shadow-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by staff category"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="full_time">Full-Time Only</option>
                <option value="restricted_hours">Restricted Hours Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Staff Table / Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500 font-medium">Loading staff members...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {viewTab === "active" ? "No staff members found" : "No archived staff"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {viewTab === "active"
                ? "Get started by adding your team members with their custom contracted hours and availability windows."
                : "Archived team members who are no longer scheduled on active rotas will appear here."}
            </p>
            {viewTab === "active" && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Your First Team Member</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">
                      Name & Profile
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Contracted Hours
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Skills
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Weekly Availability
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Time Off / Leave
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {staffList.map((staff) => {
                    const activeLeaveCount = staff.unavailability_blocks.length;
                    const recurringDaysOffCount = staff.availability_rules.filter(
                      (r) => r.is_recurring_day_off
                    ).length;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name & Initials */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shrink-0">
                              {staff.first_name[0]}
                              {staff.last_name[0]}
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setDetailStaff(staff)}
                                className="font-bold text-slate-900 hover:text-emerald-700 text-left text-sm"
                              >
                                {staff.first_name} {staff.last_name}
                              </button>
                              {staff.display_name && (
                                <p className="text-[11px] text-slate-400">({staff.display_name})</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category Badge with visual distinction */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {staff.category === "restricted_hours" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Restricted Hours
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Full-Time
                            </span>
                          )}
                        </td>

                        {/* Contracted Hours */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{staff.contract?.contracted_hours_per_week ?? 0} hrs/wk</span>
                          </div>
                          {(staff.contract?.min_hours_per_week || staff.contract?.max_hours_per_week) && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Range: {staff.contract.min_hours_per_week ?? 0}h -{" "}
                              {staff.contract.max_hours_per_week ?? "∞"}h
                            </p>
                          )}
                        </td>

                        {/* Skills */}
                        <td className="px-4 py-4">
                          {staff.skills.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {staff.skills.map((skill) => (
                                <span
                                  key={skill.id}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    backgroundColor: `${skill.color}15`,
                                    color: skill.color,
                                  }}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: skill.color }}
                                  />
                                  {skill.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Weekly Availability */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              {recurringDaysOffCount > 0
                                ? `${7 - recurringDaysOffCount} days/wk (${recurringDaysOffCount} recurring off)`
                                : "Available 7 days"}
                            </span>
                          </div>
                        </td>

                        {/* Leave & Unavailability */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {activeLeaveCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              <Calendar className="h-3 w-3" />
                              <span>{activeLeaveCount} leave block{activeLeaveCount > 1 ? "s" : ""}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No active leave</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailStaff(staff)}
                              className="rounded-lg p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="View details"
                              aria-label={`View ${staff.first_name} details`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(staff)}
                              className="rounded-lg p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Edit staff member"
                              aria-label={`Edit ${staff.first_name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {staff.is_archived ? (
                              <button
                                type="button"
                                onClick={() => handleReactivate(staff)}
                                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Reactivate staff member"
                                aria-label={`Reactivate ${staff.first_name}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleArchive(staff)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                title="Archive staff member"
                                aria-label={`Archive ${staff.first_name}`}
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 text-xs">
                <span className="text-slate-500">
                  Showing page <span className="font-semibold text-slate-800">{page}</span> of{" "}
                  <span className="font-semibold text-slate-800">{totalPages}</span> ({totalCount} total)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staff Create / Edit Modal */}
      {currentWorkspace && token && (
        <StaffModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={loadStaff}
          staffMember={editingStaff}
          workspaceId={currentWorkspace.id}
          token={token}
        />
      )}

      {/* Staff Detail Slideover / Modal */}
      {detailStaff && (
        <StaffDetailModal
          isOpen={Boolean(detailStaff)}
          onClose={() => setDetailStaff(null)}
          staff={detailStaff}
          onEdit={(staff) => {
            setDetailStaff(null);
            handleOpenEditModal(staff);
          }}
          onArchive={handleArchive}
          onReactivate={handleReactivate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};
