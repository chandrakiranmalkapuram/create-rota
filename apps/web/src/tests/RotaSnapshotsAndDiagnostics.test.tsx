import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RotaDetailPage } from "../pages/RotaDetailPage";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "manager@example.com", first_name: "Test", last_name: "Manager" },
    currentWorkspace: { id: "ws1", name: "Acme Rota Corp", role: "owner" },
    token: "fake-jwt-token",
  }),
}));

const mockRotaDetail = {
  id: "rota-101",
  workspace_id: "ws1",
  name: "Summer Week 28",
  start_date: "2026-11-02",
  end_date: "2026-11-08",
  status: "draft",
  total_shifts: 5,
  total_paid_hours: 36.25,
  latest_generation_status: "partially_feasible",
  requirements: [
    {
      id: "req-1",
      rota_id: "rota-101",
      date: "2026-11-02",
      bands: [
        {
          id: "band-1",
          requirement_id: "req-1",
          start_time: "09:00",
          end_time: "17:00",
          target_staff_count: 1,
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
      rota_id: "rota-101",
      staff_id: "staff-1",
      staff_name: "Alice Anderson",
      date: "2026-11-02",
      start_time: "09:00",
      end_time: "17:00",
      unpaid_break_minutes: 45,
      paid_hours: 7.25,
      skill_id: null,
      skill_name: null,
      status: "draft",
      notes: "Generated automatically",
      created_at: "2026-10-27T00:00:00Z",
    },
  ],
  latest_run: {
    id: "run-999",
    rota_id: "rota-101",
    status: "partially_feasible",
    solve_time_seconds: 0.12,
    shifts_created: 1,
    coverage_score: 50.0,
    diagnostics: [
      {
        type: "warning",
        message: "Unmet coverage on Mon, 02 Nov: 10:00–18:00 short by 1 staff.",
        date: "2026-11-02",
        band: "10:00–18:00",
        is_proven: true,
      },
    ],
    relaxation_suggestions: [
      {
        id: "sug-1",
        category: "skill",
        is_confirmed: true,
        title: "No Qualified Staff in Workspace",
        description: "Zero active staff possess skill 'Head Chef'.",
        affected_date: "2026-11-02",
        affected_band: "10:00–18:00",
        potential_impact: "Will unblock 1 required slot",
      },
      {
        id: "sug-2",
        category: "max_shifts",
        is_confirmed: false,
        title: "Consider Relaxing Max Shifts for Gordon",
        description: "Gordon is capped at 3 shifts per week.",
        affected_date: "2026-11-02",
        affected_band: "10:00–18:00",
        affected_staff_name: "Gordon Ramsay",
        potential_impact: "Permits additional shift allocation",
      },
    ],
    assumptions: {
      break_policy_name: "standard",
      break_tiers_summary: "6h+ -> 30m (unpaid), 8h+ -> 45m (unpaid)",
      rest_period_hours: 11.0,
      random_seed: 42,
      compliance_disclaimer: "Configured rules do not constitute legal advice.",
    },
    created_at: "2026-10-27T00:00:00Z",
  },
  snapshots_count: 1,
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};

const mockSnapshots = [
  {
    id: "snap-abc-123",
    rota_id: "rota-101",
    workspace_id: "ws1",
    snapshot_reason: "pre_generation",
    description: "Automatic snapshot before solver run",
    shifts_count: 5,
    coverage_score: 100.0,
    created_at: "2026-10-27T01:30:00Z",
  },
];

describe("Milestone 5 Frontend - Rota Snapshots, Diagnostics & Transparency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/snapshots") && !url.includes("/restore")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSnapshots),
        });
      }
      if (url.includes("/restore")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "Successfully restored 5 shift(s) from snapshot.",
              restored_shifts_count: 5,
              safety_snapshot_id: "safety-1",
              rota: mockRotaDetail,
            }),
        });
      }
      if (url.includes("/staff")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], total: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRotaDetail),
      });
    });
  });

  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/workspaces/ws1/rotas/rota-101"]}>
          <Routes>
            <Route path="/workspaces/:workspaceId/rotas/:rotaId" element={<RotaDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("renders the employment-law compliance disclaimer and solver options", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Summer Week 28")).toBeInTheDocument();
    });

    const engineTabBtn = screen.getByRole("button", { name: /Generation Engine/i });
    await userEvent.click(engineTabBtn);

    // Assert compliance disclaimer
    expect(
      screen.getByText(/They do not constitute formal employment-law advice or an official guarantee of statutory compliance/i)
    ).toBeInTheDocument();

    // Assert solver options
    expect(screen.getByText(/Random Seed \(Deterministic\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Break Calculation Policy:/i)).toBeInTheDocument();
  });

  it("displays relaxation suggestions distinguishing confirmed findings from recommendations", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Summer Week 28")).toBeInTheDocument();
    });

    const engineTabBtn = screen.getByRole("button", { name: /Generation Engine/i });
    await userEvent.click(engineTabBtn);

    // Suggestions heading
    expect(screen.getByText("Actionable Constraint Relaxation Suggestions")).toBeInTheDocument();

    // Suggestion 1: Confirmed Finding
    expect(screen.getByText("No Qualified Staff in Workspace")).toBeInTheDocument();
    expect(screen.getByText("Confirmed Finding")).toBeInTheDocument();

    // Suggestion 2: Recommendation
    expect(screen.getByText("Consider Relaxing Max Shifts for Gordon")).toBeInTheDocument();
    expect(screen.getByText("Recommendation")).toBeInTheDocument();
  });

  it("renders the Version History (Snapshots) tab and handles restore confirmation modal", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Summer Week 28")).toBeInTheDocument();
    });

    // Switch to Version History tab
    const snapshotsTabBtn = screen.getByRole("button", { name: /Version History/i });
    await userEvent.click(snapshotsTabBtn);

    // Snapshot row should be visible
    expect(screen.getByText("Draft Version Snapshots")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("5 shifts")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    // Click Restore Draft button
    const restoreBtn = screen.getByRole("button", { name: /Restore Draft/i });
    await userEvent.click(restoreBtn);

    // Confirm modal opens with warning
    expect(screen.getByText("Confirm Draft Restoration")).toBeInTheDocument();
    expect(
      screen.getByText(/Restoring will replace the current draft shifts with the 5 shifts/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A safety snapshot of your current draft shifts will be taken automatically/i)
    ).toBeInTheDocument();

    // Click Confirm & Restore button
    const confirmBtn = screen.getByRole("button", { name: /Confirm & Restore/i });
    await userEvent.click(confirmBtn);

    // Feedback message
    await waitFor(() => {
      expect(screen.getByText(/Successfully restored 5 shift\(s\) from snapshot/i)).toBeInTheDocument();
    });
  });

  it("displays transparent paid-hour and unpaid break breakdown in the shifts tab", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Summer Week 28")).toBeInTheDocument();
    });

    const shiftsTabBtn = screen.getByRole("button", { name: /Generated Draft Shifts/i });
    await userEvent.click(shiftsTabBtn);

    // Check transparent breakdown banner
    expect(screen.getByText(/Gross Shift Hours/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unpaid Breaks/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Net Paid Hours/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Includes 45m unpaid break deduction/i)).toBeInTheDocument();
  });
});
