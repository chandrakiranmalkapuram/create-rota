import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RotaDetailPage } from "../pages/RotaDetailPage";
import { RotasPage } from "../pages/RotasPage";
import { RotaDetail } from "../types/rota";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "manager@test.com", full_name: "Manager Test" },
    currentWorkspace: { id: "ws1", name: "Test Store", timezone: "Europe/London" },
    token: "mock-jwt-token",
  }),
}));

const mockDraftRota: RotaDetail = {
  id: "rota-1",
  workspace_id: "ws1",
  name: "Week Commencing 02 Nov 2026",
  start_date: "2026-11-02",
  end_date: "2026-11-08",
  status: "draft",
  published_at: null,
  published_by_user_id: null,
  archived_at: null,
  total_shifts: 2,
  total_paid_hours: 15.0,
  latest_generation_status: "feasible",
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
  requirements: [],
  shifts: [
    {
      id: "shift-1",
      rota_id: "rota-1",
      staff_id: "staff-1",
      staff_name: "Alice Anderson",
      date: "2026-11-02",
      start_time: "09:00",
      end_time: "17:00",
      unpaid_break_minutes: 30,
      paid_hours: 7.5,
      skill_id: "sk-1",
      skill_name: "Supervisor",
      status: "draft",
      notes: "Morning lead",
      created_at: "2026-10-27T00:00:00Z",
    },
    {
      id: "shift-2",
      rota_id: "rota-1",
      staff_id: "staff-2",
      staff_name: "Bob Builder",
      date: "2026-11-03",
      start_time: "09:00",
      end_time: "17:00",
      unpaid_break_minutes: 30,
      paid_hours: 7.5,
      skill_id: null,
      skill_name: null,
      status: "draft",
      notes: null,
      created_at: "2026-10-27T00:00:00Z",
    },
  ],
  latest_run: null,
  snapshots_count: 0,
};

const mockPublishedRota: RotaDetail = {
  ...mockDraftRota,
  id: "rota-2",
  name: "Published Week 45",
  status: "published",
  published_at: "2026-10-27T10:00:00Z",
  published_by_user_id: "user-1",
};

const mockArchivedRota: RotaDetail = {
  ...mockDraftRota,
  id: "rota-3",
  name: "Archived Week 40",
  status: "archived",
  archived_at: "2026-10-27T12:00:00Z",
};

describe("Milestone 7 Frontend - Exports, History, Clipboard & Lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderRotaDetail = (initialRota: RotaDetail) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/export")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            "content-disposition": 'attachment; filename="test_export.xlsx"',
          }),
          blob: () => Promise.resolve(new Blob(["mock-binary-data"])),
        });
      }
      if (url.includes("/approve")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...initialRota,
              status: "published",
              published_at: "2026-10-27T10:30:00Z",
            }),
        });
      }
      if (url.includes("/unpublish")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...initialRota,
              status: "draft",
              published_at: null,
            }),
        });
      }
      if (url.includes("/archive")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...initialRota,
              status: "archived",
              archived_at: "2026-10-27T11:00:00Z",
            }),
        });
      }
      if (url.includes("/unarchive")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...initialRota,
              status: "draft",
              archived_at: null,
              published_at: null,
              published_by_user_id: null,
            }),
        });
      }
      if (url.includes("/snapshots")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/staff")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], total: 0 }),
        });
      }
      // Rota detail
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(initialRota),
      });
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/rotas/${initialRota.id}`]}>
          <Routes>
            <Route path="/rotas/:rotaId" element={<RotaDetailPage />} />
            <Route path="/rotas" element={<div>Rotas List Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("opens the Export modal, allows selecting formats and layout views, and triggers export download", async () => {
    const user = userEvent.setup();
    // Mock URL create and revoke
    const createObjectUrlMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectUrlMock = vi.fn();
    window.URL.createObjectURL = createObjectUrlMock;
    window.URL.revokeObjectURL = revokeObjectUrlMock;

    renderRotaDetail(mockDraftRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Week Commencing 02 Nov 2026" })).toBeInTheDocument();
    });

    // Click Export button
    const exportBtn = screen.getByRole("button", { name: /^export$/i });
    await user.click(exportBtn);

    // Modal opens
    expect(screen.getByRole("heading", { name: "Export Schedule" })).toBeInTheDocument();
    expect(screen.getByText(/Excel Spreadsheet \(\.xlsx\)/i)).toBeInTheDocument();
    expect(screen.getByText(/CSV File \(\.csv\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF Document \(\.pdf\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Word Document \(\.docx\)/i)).toBeInTheDocument();

    // Select Day-focused view
    const dayViewRadio = screen.getByRole("radio", { name: /day-focused/i });
    await user.click(dayViewRadio);

    // Check include notes toggle
    const notesToggle = screen.getByLabelText(/Include shift notes/i);
    await user.click(notesToggle);

    // Click Download
    const downloadBtn = screen.getByRole("button", { name: /Download XLSX/i });
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/export?format=xlsx&view=day&include_notes=true"),
        expect.anything()
      );
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
  });

  it("copies TSV formatted schedule to clipboard and announces to screen readers", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    renderRotaDetail(mockDraftRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Week Commencing 02 Nov 2026" })).toBeInTheDocument();
    });

    // Click Copy button
    const copyBtn = screen.getByRole("button", { name: /^copy$/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const clipboardContent = writeTextMock.mock.calls[0][0];

    // Assert TSV format
    expect(clipboardContent).toContain("Staff Name\tDate\tDay\tStart Time\tEnd Time\tUnpaid Break (min)\tPaid Hours\tRole / Skill");
    expect(clipboardContent).toContain("Alice Anderson\t2026-11-02\tMon\t09:00\t17:00\t30\t7.5\tSupervisor");
    expect(clipboardContent).toContain("Bob Builder\t2026-11-03\tTue\t09:00\t17:00\t30\t7.5\tGeneral");

    // Check accessible feedback
    expect(screen.getByText("Copied!")).toBeInTheDocument();
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("Schedule copied to clipboard!");
  });

  it("triggers window.print when clicking Print button", async () => {
    const user = userEvent.setup();
    const printMock = vi.fn();
    window.print = printMock;

    renderRotaDetail(mockDraftRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Week Commencing 02 Nov 2026" })).toBeInTheDocument();
    });

    const printBtn = screen.getByRole("button", { name: /^print$/i });
    await user.click(printBtn);

    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it("handles publishing and unpublishing lifecycle with modal confirmations", async () => {
    const user = userEvent.setup();
    renderRotaDetail(mockDraftRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Week Commencing 02 Nov 2026" })).toBeInTheDocument();
    });

    // In draft state, Publish Rota button is available
    const publishBtn = screen.getByRole("button", { name: /Publish Rota/i });
    await user.click(publishBtn);

    // Modal explanation opens
    expect(screen.getByRole("heading", { name: "Publish Rota Schedule" })).toBeInTheDocument();
    expect(screen.getByText(/The schedule is marked official and locked from further edits/i)).toBeInTheDocument();

    // Confirm publish
    const confirmBtn = screen.getByRole("button", { name: "Confirm & Publish" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rotas/rota-1/approve"),
        expect.anything()
      );
    });
  });

  it("handles unpublishing and archiving in published state", async () => {
    const user = userEvent.setup();
    renderRotaDetail(mockPublishedRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Published Week 45" })).toBeInTheDocument();
    });

    // Status badge shows published
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText(/Published 27\/10\/2026/i)).toBeInTheDocument();

    // Unpublish to draft button is present
    const unpublishBtn = screen.getByRole("button", { name: /Unpublish to Draft/i });
    await user.click(unpublishBtn);

    expect(screen.getByRole("heading", { name: "Unpublish to Draft" })).toBeInTheDocument();
    const confirmUnpublish = screen.getByRole("button", { name: "Confirm & Unpublish" });
    await user.click(confirmUnpublish);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rotas/rota-2/unpublish"),
        expect.anything()
      );
    });
  });

  it("handles restoring archived rotas back to draft state", async () => {
    const user = userEvent.setup();
    renderRotaDetail(mockArchivedRota);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Archived Week 40" })).toBeInTheDocument();
    });

    expect(screen.getByText("archived")).toBeInTheDocument();
    expect(screen.getByText(/Archived 27\/10\/2026/i)).toBeInTheDocument();

    const restoreBtn = screen.getByRole("button", { name: /Restore to Draft/i });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rotas/rota-3/unarchive"),
        expect.anything()
      );
    });

    // Check that success notification appears and no Published badge is shown
    await waitFor(() => {
      expect(screen.getByText("Rota restored from archive to draft.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Published/i)).not.toBeInTheDocument();
  });

  it("does not render stale Published badge when a draft rota has residual published_at timestamp", async () => {
    const draftWithResidualPublish: RotaDetail = {
      ...mockDraftRota,
      id: "rota-residual",
      name: "Draft With Stale Timestamp",
      status: "draft",
      published_at: "2026-10-27T10:00:00Z",
    };

    renderRotaDetail(draftWithResidualPublish);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Draft With Stale Timestamp" })).toBeInTheDocument();
    });

    // Confirms draft status badge is shown
    expect(screen.getByText("draft")).toBeInTheDocument();
    // Confirms stale published badge is guarded and NOT rendered
    expect(screen.queryByText(/Published 27\/10\/2026/i)).not.toBeInTheDocument();
  });

  it("renders status filters and duplicate button in RotasPage", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/rotas")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: "rota-1",
                  workspace_id: "ws1",
                  name: "Week Commencing 02 Nov 2026",
                  start_date: "2026-11-02",
                  end_date: "2026-11-08",
                  status: "draft",
                  total_shifts: 2,
                  total_paid_hours: 15.0,
                  latest_generation_status: "feasible",
                  created_at: "2026-10-27T00:00:00Z",
                  updated_at: "2026-10-27T00:00:00Z",
                },
                {
                  id: "rota-2",
                  workspace_id: "ws1",
                  name: "Week Commencing 09 Nov 2026",
                  start_date: "2026-11-09",
                  end_date: "2026-11-15",
                  status: "published",
                  total_shifts: 4,
                  total_paid_hours: 30.0,
                  latest_generation_status: "feasible",
                  created_at: "2026-10-27T00:00:00Z",
                  updated_at: "2026-10-27T00:00:00Z",
                },
              ],
              total: 2,
              page: 1,
              page_size: 20,
              total_pages: 1,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/rotas"]}>
          <Routes>
            <Route path="/rotas" element={<RotasPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Week Commencing 02 Nov 2026")).toBeInTheDocument();
      expect(screen.getByText("Week Commencing 09 Nov 2026")).toBeInTheDocument();
    });

    // Check status filter buttons
    expect(screen.getByRole("button", { name: "all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "published" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "archived" })).toBeInTheDocument();

    // Check duplicate button on row
    const duplicateBtns = screen.getAllByRole("button", { name: /duplicate rota/i });
    expect(duplicateBtns.length).toBeGreaterThan(0);

    // Click duplicate on first rota
    await user.click(duplicateBtns[0]);

    // DuplicateRotaModal opens
    expect(screen.getByRole("heading", { name: "Duplicate Rota" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Copy of Week Commencing 02 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText(/Copy staffing demand requirements & time bands/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy scheduled shifts/i)).toBeInTheDocument();
  });
});
