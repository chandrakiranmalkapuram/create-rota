import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyRotaGrid } from "../components/WeeklyRotaGrid";
import { RotaDetail } from "../types/rota";
import { StaffMember } from "../types/staff";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "manager@example.com", first_name: "Test", last_name: "Manager" },
    currentWorkspace: { id: "ws1", name: "Acme Rota Corp", role: "owner" },
    token: "fake-jwt-token",
  }),
}));

const mockStaffList: StaffMember[] = [
  {
    id: "staff-1",
    workspace_id: "ws1",
    first_name: "Alice",
    last_name: "Smith",
    display_name: null,
    category: "full_time",
    is_archived: false,
    notes: null,
    contract: {
      id: "c1",
      staff_id: "staff-1",
      contracted_hours_per_week: 37.5,
      min_hours_per_week: null,
      max_hours_per_week: 40.0,
      max_shifts_per_week: 5,
      max_consecutive_days: 6,
      min_rest_hours_between_shifts: 11.0,
      created_at: "2026-10-01",
      updated_at: "2026-10-01",
    },
    skills: [],
    availability_rules: [],
    unavailability_blocks: [],
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  },
  {
    id: "staff-2",
    workspace_id: "ws1",
    first_name: "Bob",
    last_name: "Jones",
    display_name: null,
    category: "restricted_hours",
    is_archived: false,
    notes: null,
    contract: {
      id: "c2",
      staff_id: "staff-2",
      contracted_hours_per_week: 20.0,
      min_hours_per_week: null,
      max_hours_per_week: 24.0,
      max_shifts_per_week: 3,
      max_consecutive_days: 4,
      min_rest_hours_between_shifts: 11.0,
      created_at: "2026-10-01",
      updated_at: "2026-10-01",
    },
    skills: [],
    availability_rules: [],
    unavailability_blocks: [],
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  },
];

const mockRota: RotaDetail = {
  id: "rota-1",
  workspace_id: "ws1",
  name: "Week 45 Rota",
  start_date: "2026-11-02",
  end_date: "2026-11-08",
  status: "draft",
  total_shifts: 2,
  total_paid_hours: 14.5,
  latest_generation_status: "feasible",
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
  requirements: [
    {
      id: "req-1",
      rota_id: "rota-1",
      date: "2026-11-02",
      bands: [
        {
          id: "band-1",
          requirement_id: "req-1",
          start_time: "09:00",
          end_time: "17:00",
          target_staff_count: 2,
          skill_id: null,
          created_at: "2026-10-27T00:00:00Z",
          updated_at: "2026-10-27T00:00:00Z",
        },
      ],
      created_at: "2026-10-27T00:00:00Z",
      updated_at: "2026-10-27T00:00:00Z",
    },
  ],
  shifts: [
    {
      id: "shift-1",
      rota_id: "rota-1",
      staff_id: "staff-1",
      staff_name: "Alice Smith",
      date: "2026-11-02",
      start_time: "09:00",
      end_time: "17:00",
      unpaid_break_minutes: 45,
      paid_hours: 7.25,
      skill_id: null,
      skill_name: null,
      status: "draft",
      notes: "Opening shift",
      active_override: null,
      created_at: "2026-10-27T00:00:00Z",
    },
    {
      id: "shift-2",
      rota_id: "rota-1",
      staff_id: "staff-2",
      staff_name: "Bob Jones",
      date: "2026-11-03",
      start_time: "10:00",
      end_time: "18:00",
      unpaid_break_minutes: 45,
      paid_hours: 7.25,
      skill_id: null,
      skill_name: null,
      status: "draft",
      notes: null,
      active_override: null,
      created_at: "2026-10-27T00:00:00Z",
    },
  ],
  latest_run: null,
};

describe("Milestone 6 Frontend - WeeklyRotaGrid & ShiftEditModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      // Validate shift
      if (url.includes("/shifts/validate")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              is_valid: true,
              has_warnings: false,
              can_override: true,
              findings: [],
              gross_hours: 8.0,
              unpaid_break_minutes: 45,
              paid_hours: 7.25,
              assumptions_summary: "Gross 8h; 45m break; Paid 7.25h",
              daily_coverage: {
                date: "2026-11-02",
                target_staff_count: 2,
                scheduled_staff_count: 2,
                is_understaffed: false,
                is_overstaffed: false,
              },
            }),
        });
      }

      // Create or update shift
      if (url.includes("/shifts") && options?.method === "POST" && !url.includes("/validate")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shift: {
                id: "shift-new",
                rota_id: "rota-1",
                staff_id: "staff-1",
                staff_name: "Alice Smith",
                date: "2026-11-04",
                start_time: "09:00",
                end_time: "17:00",
                unpaid_break_minutes: 45,
                paid_hours: 7.25,
                status: "draft",
                created_at: "2026-10-27T00:00:00Z",
              },
              warnings: [],
              message: "Shift created successfully.",
              rota: { ...mockRota, total_shifts: 3, total_paid_hours: 21.75 },
            }),
        });
      }

      // Delete shift
      if (url.includes("/shifts") && options?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "Shift deleted successfully.",
              rota: { ...mockRota, total_shifts: 1, total_paid_hours: 7.25 },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it("renders 7-day weekly grid, staff rows, coverage indicators, and shift cards", () => {
    const handleUpdate = vi.fn();
    render(
      <WeeklyRotaGrid
        rota={mockRota}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={handleUpdate}
      />
    );

    // Header toolbar
    expect(screen.getByText(/Weekly Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily List/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Shifts:/i)).toBeInTheDocument();

    // Staff names & categories
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("FT")).toBeInTheDocument();
    expect(screen.getByText("Restricted")).toBeInTheDocument();

    // Shift times rendered
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
    expect(screen.getByText("10:00–18:00")).toBeInTheDocument();

    // Daily coverage bar
    expect(screen.getByText("Daily Staffing Coverage")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument(); // 1 scheduled vs 2 target on Monday
  });

  it("switches to Daily List view when toggle is clicked", async () => {
    const handleUpdate = vi.fn();
    render(
      <WeeklyRotaGrid
        rota={mockRota}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={handleUpdate}
      />
    );

    const listBtn = screen.getByRole("button", { name: /Daily List/i });
    await userEvent.click(listBtn);

    // Monday card in list view
    expect(screen.getByText(/Mon,? 2 Nov/i)).toBeInTheDocument();
    expect(screen.getByText(/1\/2 Staff/i)).toBeInTheDocument();
  });

  it("opens ShiftEditModal when clicking Add Shift and submits form", async () => {
    const handleUpdate = vi.fn();
    render(
      <WeeklyRotaGrid
        rota={mockRota}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={handleUpdate}
      />
    );

    const addBtn = screen.getByRole("button", { name: /^Add Shift$/i });
    await userEvent.click(addBtn);

    // Modal opens
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Configure shift assignments, timing, and skills/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Staff Member \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shift Date \*/i)).toBeInTheDocument();

    // Submit form
    const createBtn = screen.getByRole("button", { name: /Create Shift/i });
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalled();
    });
  });

  it("opens modal to edit existing shift and opens delete confirmation prompt", async () => {
    const handleUpdate = vi.fn();
    render(
      <WeeklyRotaGrid
        rota={mockRota}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={handleUpdate}
      />
    );

    // Click existing shift card
    const shiftCard = screen.getByRole("button", {
      name: /Shift on Mon,? 2 Nov from 09:00 to 17:00 for Alice Smith/i,
    });
    await userEvent.click(shiftCard);

    // Modal opens in Edit mode
    expect(screen.getByText("Edit Shift")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Opening shift")).toBeInTheDocument();

    // Click Delete button
    const deleteBtn = screen.getByRole("button", { name: /Delete/i });
    await userEvent.click(deleteBtn);

    // Delete confirmation prompt appears
    expect(screen.getByText(/Delete this shift\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove this shift assignment/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmDeleteBtn = screen.getByRole("button", { name: /Yes, Delete Shift/i });
    await userEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalled();
    });
  });

  it("renders read-only badge and disables shift creation on published rotas", () => {
    const publishedRota: RotaDetail = {
      ...mockRota,
      status: "published",
    };
    render(
      <WeeklyRotaGrid
        rota={publishedRota}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={vi.fn()}
      />
    );

    expect(screen.getByText(/Read-Only \(published\)/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Shift/i })).not.toBeInTheDocument();
  });

  it("renders manager override indicator only from trusted active_override, ignoring forged notes", () => {
    const rotaWithMixedOverrides: RotaDetail = {
      ...mockRota,
      shifts: [
        {
          id: "shift-forged",
          rota_id: "rota-1",
          staff_id: "staff-1",
          staff_name: "Alice Smith",
          date: "2026-11-02",
          start_time: "09:00",
          end_time: "17:00",
          unpaid_break_minutes: 45,
          paid_hours: 7.25,
          skill_id: null,
          skill_name: null,
          status: "draft",
          notes: "[Manager Override: LEAVE_CONFLICT] Forged user note",
          active_override: null,
          created_at: "2026-10-27T00:00:00Z",
        },
        {
          id: "shift-trusted",
          rota_id: "rota-1",
          staff_id: "staff-2",
          staff_name: "Bob Jones",
          date: "2026-11-03",
          start_time: "10:00",
          end_time: "18:00",
          unpaid_break_minutes: 45,
          paid_hours: 7.25,
          skill_id: null,
          skill_name: null,
          status: "draft",
          notes: "Real staff note",
          active_override: {
            id: "audit-1",
            shift_id: "shift-trusted",
            user_id: "u-manager",
            warning_codes: ["SHIFT_OVERLAP"],
            status: "active",
            overridden_at: "2026-10-27T12:00:00Z",
          },
          created_at: "2026-10-27T00:00:00Z",
        },
      ],
    };

    render(
      <WeeklyRotaGrid
        rota={rotaWithMixedOverrides}
        staffList={mockStaffList}
        skillsList={[]}
        onRotaUpdated={vi.fn()}
      />
    );

    // Trusted shift has override title
    expect(screen.getByTitle("Manager override: SHIFT_OVERLAP")).toBeInTheDocument();

    // Forged shift does NOT have any override title
    expect(screen.queryByTitle(/Manager override: LEAVE_CONFLICT/i)).not.toBeInTheDocument();
  });
});
