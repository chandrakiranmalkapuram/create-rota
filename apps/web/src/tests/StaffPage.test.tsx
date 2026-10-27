import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffPage } from "../pages/StaffPage";
import * as AuthContextModule from "../context/AuthContext";
import * as StaffApi from "../services/staffApi";
import { StaffMember } from "../types/staff";

const mockStaffMembers: StaffMember[] = [
  {
    id: "staff-1",
    workspace_id: "ws-1",
    first_name: "Alice",
    last_name: "Smith",
    display_name: "Alice S",
    category: "full_time",
    is_archived: false,
    notes: "Lead supervisor",
    skills: [
      {
        id: "skill-1",
        workspace_id: "ws-1",
        name: "Supervisor",
        color: "#4F46E5",
        created_at: new Date().toISOString(),
      },
    ],
    contract: {
      id: "contract-1",
      staff_id: "staff-1",
      contracted_hours_per_week: 37.5,
      min_hours_per_week: null,
      max_hours_per_week: null,
      max_shifts_per_week: 5,
      max_consecutive_days: 6,
      min_rest_hours_between_shifts: 11.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    availability_rules: [
      {
        id: "rule-1",
        staff_id: "staff-1",
        weekday: 0,
        is_available: true,
        start_time: null,
        end_time: null,
        is_recurring_day_off: false,
        created_at: new Date().toISOString(),
      },
    ],
    unavailability_blocks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "staff-2",
    workspace_id: "ws-1",
    first_name: "Bob",
    last_name: "Jones",
    display_name: null,
    category: "restricted_hours",
    is_archived: false,
    notes: "Student, part-time",
    skills: [
      {
        id: "skill-2",
        workspace_id: "ws-1",
        name: "Barista",
        color: "#059669",
        created_at: new Date().toISOString(),
      },
    ],
    contract: {
      id: "contract-2",
      staff_id: "staff-2",
      contracted_hours_per_week: 20.0,
      min_hours_per_week: 16.0,
      max_hours_per_week: 24.0,
      max_shifts_per_week: 3,
      max_consecutive_days: 3,
      min_rest_hours_between_shifts: 11.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    availability_rules: [
      {
        id: "rule-2",
        staff_id: "staff-2",
        weekday: 1,
        is_available: false,
        start_time: null,
        end_time: null,
        is_recurring_day_off: true,
        created_at: new Date().toISOString(),
      },
    ],
    unavailability_blocks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("StaffPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "manager@test.com",
        first_name: "Manager",
        last_name: "User",
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Test Store",
          timezone: "Europe/London",
          role: "owner",
          created_at: new Date().toISOString(),
        },
      ],
      currentWorkspace: {
        id: "ws-1",
        name: "Test Store",
        timezone: "Europe/London",
        role: "owner",
        created_at: new Date().toISOString(),
      },
      token: "mock-jwt-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      switchWorkspace: vi.fn(),
      refreshMe: vi.fn(),
    });

    vi.spyOn(StaffApi, "fetchStaffList").mockResolvedValue({
      items: mockStaffMembers,
      total: 2,
      page: 1,
      page_size: 15,
      total_pages: 1,
    });

    vi.spyOn(StaffApi, "fetchSkills").mockResolvedValue([]);
  });

  it("renders page title, summary cards, and add staff button", async () => {
    render(
      <BrowserRouter>
        <StaffPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Team Members & Availability")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add staff member/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    // Check category distinction badges
    expect(screen.getAllByText("Full-Time").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Restricted Hours").length).toBeGreaterThanOrEqual(1);

    // Check contracted hours
    expect(screen.getByText("37.5 hrs/wk")).toBeInTheDocument();
    expect(screen.getByText("20 hrs/wk")).toBeInTheDocument();
  });

  it("opens add staff modal when clicking add staff button", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <StaffPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add staff member/i });
    await user.click(addBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add New Staff Member")).toBeInTheDocument();
  });

  it("opens detail modal when clicking a staff member name", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <StaffPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const aliceLink = screen.getByText("Alice Smith");
    await user.click(aliceLink);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Contract & Scheduling Parameters")).toBeInTheDocument();
  });

  it("renders empty state when workspace has no staff members", async () => {
    vi.spyOn(StaffApi, "fetchStaffList").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 15,
      total_pages: 1,
    });

    render(
      <BrowserRouter>
        <StaffPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No staff members found")).toBeInTheDocument();
      expect(screen.getByText("Add Your First Team Member")).toBeInTheDocument();
    });
  });
});
