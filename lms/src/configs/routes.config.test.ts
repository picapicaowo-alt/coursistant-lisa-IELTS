import {describe, expect, it} from "vitest";
import {getSidebarIndex, shouldShowAppShell} from "./routes.config";

describe("app shell routing", () => {
  it("keeps the shell visible throughout course routes", () => {
    expect(getSidebarIndex("/course/19/assignments/37")).toBe(1);
    expect(shouldShowAppShell("/course/19/assignments/37")).toBe(true);
  });

  it("does not treat unrelated prefixes as configured routes", () => {
    expect(shouldShowAppShell("/coursework")).toBe(false);
    expect(shouldShowAppShell("/login")).toBe(false);
  });

  it("only selects dashboard for the root URL", () => {
    expect(getSidebarIndex("/")).toBe(0);
    expect(getSidebarIndex("/profile")).toBe(-1);
    expect(getSidebarIndex("/settings")).toBe(-1);
  });

  it("shows shell for settings, profile, operations, and admin routes", () => {
    expect(shouldShowAppShell("/settings")).toBe(true);
    expect(shouldShowAppShell("/profile")).toBe(true);
    expect(shouldShowAppShell("/admin")).toBe(true);
    expect(shouldShowAppShell("/admin/users")).toBe(true);
    expect(shouldShowAppShell("/my-operations")).toBe(true);
  });
});

// Figma checkpoint details deliberately use the full viewport, at any width.
it('hides navigation only for the focused student checkpoint view', () => {
  expect(shouldShowAppShell('/my-plan')).toBe(true);
  expect(shouldShowAppShell('/my-plan', '?checkpoint=91&task=101')).toBe(false);
  expect(shouldShowAppShell('/my-plan', '?checkpoint=')).toBe(true);
  expect(shouldShowAppShell('/advisor/students', '?checkpoint=91')).toBe(true);
});
