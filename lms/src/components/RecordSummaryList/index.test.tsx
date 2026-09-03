import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordSummaryList } from "./index";

describe("academic record presentation", () => {
  it("retains zero, booleans and nested learning data while withholding internal fields", () => {
    render(
      <RecordSummaryList
        value={{
          purchasedMinutes: 0,
          active: false,
          valid: true,
          studyPlan: {
            checkpoints: [
              {
                description: "Build a clear argument",
                tasks: [
                  { title: "Draft an introduction", status: "NOT_STARTED" },
                ],
              },
            ],
          },
          expectedVersion: 8,
          privateNotes: "staff only",
          objectKey: "private-storage",
          accessToken: "hidden-token",
        }}
      />,
    );
    expect(screen.getByText("Purchased Minutes")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Draft an introduction")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    for (const hidden of ["staff only", "private-storage", "hidden-token", "8"])
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });
  it("does not report a successful update when an empty page is read", () => {
    render(
      <RecordSummaryList
        value={{ items: [], total: 0, page: 0 }}
        emptyMessage="No reports yet."
      />,
    );
    expect(screen.getByText("No reports yet.")).toBeInTheDocument();
    expect(screen.queryByText(/successfully/i)).not.toBeInTheDocument();
  });
});
