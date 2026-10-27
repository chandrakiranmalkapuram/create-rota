import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

describe("App Shell Component", () => {
  it("renders the skip-to-content accessibility link", () => {
    render(<App />);
    const skipLink = screen.getByText(/Skip to main content/i);
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("renders the branding wordmark in header and footer", () => {
    render(<App />);
    const brands = screen.getAllByLabelText(/Create Rota Home/i);
    expect(brands.length).toBeGreaterThan(0);
  });

  it("renders the honest non-affiliation disclaimer in the footer", () => {
    render(<App />);
    expect(
      screen.getByText(/Create Rota is an independent planning tool and is not affiliated with/i)
    ).toBeInTheDocument();
  });
});
