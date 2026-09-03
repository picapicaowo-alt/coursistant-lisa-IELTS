import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantAlertRuleRequest, TenantAlertRuleResponse } from "@/apis";
import { AlertRulesPanel } from "./AlertRulesPanel";

const mocks = vi.hoisted(() => ({
  getTenantAlertRules: vi.fn(),
  putTenantAlertRules: vi.fn(),
}));
vi.mock("@/apis/services/course-operations-api", () => ({
  courseOperationsApiService: mocks,
}));
const response = <T,>(data: T) => ({ status: 200, code: "SUCCESS", data });
const policy: TenantAlertRuleResponse = {
  tenantId: 7,
  mode: "TENANT_OVERRIDE",
  version: 2,
  inactivityDays: 7,
  absenceCount: 3,
  absenceWindowDays: 14,
  completionPercentage: 60,
  completionWindowDays: 30,
  completionMinimumSample: 5,
  performancePercentage: 50,
  performanceMinimumGradedSample: 3,
  deadlineWindowDays: 7,
  gradingDelayDays: 3,
  overdueTaskEnabled: 1,
  checkpointIncompleteEnabled: 1,
  negativeHoursEnabled: null,
};
const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AlertRulesPanel />
    </QueryClientProvider>,
  );
  return client;
};
const editInactivity = async (value: string) => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit learning inactivity" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Learning inactivity",
  });
  fireEvent.change(within(dialog).getByLabelText("Inactivity (days)"), {
    target: { value },
  });
  return dialog;
};
describe("Tenant alert rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantAlertRules.mockResolvedValue(response(policy));
    mocks.putTenantAlertRules.mockImplementation(
      async (request: TenantAlertRuleRequest) =>
        response({ ...policy, ...request, version: 3 }),
    );
  });
  it("shows eight flat rows, five editors and only the three contracted switches", async () => {
    renderPanel();
    const list = await screen.findByRole("list", {
      name: "Alert rule categories",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(
      within(list).getAllByRole("button", { name: /^Edit / }),
    ).toHaveLength(5);
    expect(within(list).getAllByRole("switch")).toHaveLength(3);
    expect(document.querySelector("details")).toBeNull();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
  it("edits one category, preserves unrelated values, and waits for explicit policy save", async () => {
    renderPanel();
    const dialog = await editInactivity("9");
    expect(within(dialog).getAllByRole("spinbutton")).toHaveLength(1);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply to draft" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Inactivity: 9 days")).toBeInTheDocument();
    expect(mocks.putTenantAlertRules).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "Overdue tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved");
    expect(mocks.putTenantAlertRules).toHaveBeenCalledExactlyOnceWith({
      mode: policy.mode,
      expectedVersion: 2,
      inactivityDays: 9,
      absenceCount: 3,
      absenceWindowDays: 14,
      completionPercentage: 60,
      completionWindowDays: 30,
      completionMinimumSample: 5,
      performancePercentage: 50,
      performanceMinimumGradedSample: 3,
      deadlineWindowDays: 7,
      gradingDelayDays: 3,
      overdueTaskEnabled: null,
      checkpointIncompleteEnabled: 1,
      negativeHoursEnabled: null,
    });
  });
  it("cancels drawer changes separately from the page draft", async () => {
    renderPanel();
    let dialog = await editInactivity("9");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Inactivity: 7 days")).toBeInTheDocument();
    dialog = await editInactivity("11");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply to draft" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByText("Inactivity: 7 days")).toBeInTheDocument();
    expect(mocks.putTenantAlertRules).not.toHaveBeenCalled();
  });
  it("keeps system defaults read-only and does not invent missing values or off states", async () => {
    mocks.getTenantAlertRules.mockResolvedValue(
      response({ tenantId: 7, version: 1, mode: "SYSTEM_DEFAULT" }),
    );
    renderPanel();
    await screen.findByRole("list");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Edit / }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inactivity: 7/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).queryByText("Disabled"),
    ).not.toBeInTheDocument();
  });
  it("sends only mode and version for system/disabled policies and hides stale custom values", async () => {
    renderPanel();
    await screen.findByRole("list");
    fireEvent.click(screen.getByRole("radio", { name: /System default/ }));
    expect(screen.queryByText("Inactivity: 7 days")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved");
    expect(mocks.putTenantAlertRules).toHaveBeenLastCalledWith({
      mode: "SYSTEM_DEFAULT",
      expectedVersion: 2,
    });
    fireEvent.click(screen.getByRole("radio", { name: /Disabled/ }));
    expect(
      screen.getByText("Save changes to pause tenant alert evaluation."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocks.putTenantAlertRules).toHaveBeenLastCalledWith({
        mode: "DISABLED",
        expectedVersion: 3,
      }),
    );
  });
  it("pins the editor baseline across cache updates and preserves the draft on conflict", async () => {
    mocks.putTenantAlertRules.mockRejectedValue(
      new Error("Policy changed. Refresh and try again."),
    );
    const client = renderPanel();
    const dialog = await editInactivity("12");
    act(() =>
      client.setQueryData(["tenant", "alert-rules"], {
        ...policy,
        version: 8,
        inactivityDays: 20,
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply to draft" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Inactivity: 12 days")).toBeInTheDocument();
    expect(mocks.putTenantAlertRules).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedVersion: 2, inactivityDays: 12 }),
    );
    expect(
      screen.getByRole("button", { name: "Refresh alert rules" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByText("Inactivity: 20 days")).toBeInTheDocument();
  });
  it.each(["cancel", "revert"])(
    "refreshes a clean %s snapshot and saves against the newer version",
    async (action) => {
      renderPanel();
      let dialog = await editInactivity("9");
      if (action === "cancel") {
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      } else {
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Apply to draft" }),
        );
        dialog = await editInactivity("7");
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Apply to draft" }),
        );
      }
      mocks.getTenantAlertRules.mockResolvedValue(
        response({ ...policy, version: 8, inactivityDays: 20 }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh alert rules" }),
      );
      await screen.findByText("Inactivity: 20 days");
      dialog = await editInactivity("21");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Apply to draft" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        expect(mocks.putTenantAlertRules).toHaveBeenLastCalledWith(
          expect.objectContaining({ expectedVersion: 8, inactivityDays: 21 }),
        ),
      );
    },
  );
  it("shows a retryable load failure without displaying controls", async () => {
    mocks.getTenantAlertRules.mockRejectedValueOnce(new Error("Offline"));
    renderPanel();
    await screen.findByRole("alert");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("list");
  });
});
