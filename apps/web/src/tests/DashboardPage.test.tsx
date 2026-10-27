import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { DashboardPage } from "../pages/DashboardPage";
import * as AuthContextModule from "../context/AuthContext";

describe("DashboardPage Component", () => {
  it("renders exact greeting 'Hi, [first name]! 😊' with subtle smile animation", () => {
    // Mock authenticated user
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-123",
        email: "alex@example.com",
        first_name: "Alex",
        last_name: "Taylor",
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Alex's Store",
          timezone: "Europe/London",
          role: "owner",
          created_at: new Date().toISOString(),
        },
      ],
      currentWorkspace: {
        id: "ws-1",
        name: "Alex's Store",
        timezone: "Europe/London",
        role: "owner",
        created_at: new Date().toISOString(),
      },
      token: "mock-token",
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

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Exact specification requirement: "Hi, [first name]! 😊"
    expect(screen.getByText("Hi, Alex!")).toBeInTheDocument();
    
    // Check subtle smile animation element
    const smileElement = screen.getByRole("img", { name: "smiling face" });
    expect(smileElement).toBeInTheDocument();
    expect(smileElement).toHaveClass("animate-subtle-smile");
  });

  it("renders onboarding checklist and workspace details", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-123",
        email: "jordan@example.com",
        first_name: "Jordan",
        last_name: "Miller",
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Jordan's Workspace",
          timezone: "Europe/London",
          role: "owner",
          created_at: new Date().toISOString(),
        },
      ],
      currentWorkspace: {
        id: "ws-1",
        name: "Jordan's Workspace",
        timezone: "Europe/London",
        role: "owner",
        created_at: new Date().toISOString(),
      },
      token: "mock-token",
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

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Workspace Setup Checklist")).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Create your manager account and personal workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Add your team members & work contracts/i)).toBeInTheDocument();
    expect(screen.getByText("Jordan's Workspace")).toBeInTheDocument();
  });

  it("shows email verification warning banner when user is not verified", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "u-123",
        email: "unverified@example.com",
        first_name: "Unverified",
        last_name: "User",
        is_active: true,
        is_verified: false,
        created_at: new Date().toISOString(),
      },
      workspaces: [],
      currentWorkspace: null,
      token: "mock-token",
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

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Email verification pending:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });
});
