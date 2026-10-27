import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { LandingPage } from "../pages/LandingPage";

describe("LandingPage Component", () => {
  it("renders the primary headline and value proposition", () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: /Build a fair, clear staff rota in minutes/i,
      })
    ).toBeInTheDocument();
  });

  it("renders primary call-to-action buttons", () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const ctaButtons = screen.getAllByRole("link", { name: /start planning free/i });
    expect(ctaButtons.length).toBeGreaterThan(0);
    expect(ctaButtons[0]).toHaveAttribute("href", "/register");
  });

  it("renders the sample rota preview card with staffing indicators", () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Sample Week Rota — Monday Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Jordan M\./i)).toBeInTheDocument();
    expect(screen.getByText(/Alex K\./i)).toBeInTheDocument();
    expect(screen.getByText(/Coverage: 100% Met/i)).toBeInTheDocument();
  });

  it("renders the four-step workflow guidance", () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/How Create Rota works/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Staff & Contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Period Demand/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Draft/i)).toBeInTheDocument();
    expect(screen.getByText(/Adjust & Export/i)).toBeInTheDocument();
  });
});
