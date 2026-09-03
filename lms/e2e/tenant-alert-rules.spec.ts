import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type {
  TenantAlertRuleRequest,
  TenantAlertRuleResponse,
} from "../src/apis/types/courseOperations";

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
const envelope = (data: unknown) => ({ status: 200, code: "SUCCESS", data });
const directory = ".impeccable/review/alert-rules";
async function install(page: Page, initial = policy) {
  await page.addInitScript(() => {
    const user = {
      id: 1,
      userId: 1,
      tenantId: 7,
      firstName: "Grace",
      lastName: "Tan",
      name: "Grace Tan",
      role: "TENANT_ADMIN",
      level: null,
      accessToken: "isolated-alert-preview-fixture",
    };
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("accToken", user.accessToken);
  });
  let saved = { ...initial };
  const writes: TenantAlertRuleRequest[] = [];
  const unknown: string[] = [];
  await page.route("**/v2/**", (route) => {
    if (
      !new URL(route.request().url()).pathname.endsWith(
        "/v2/tenant/alert-rules",
      )
    ) {
      unknown.push(route.request().url());
      return route.fulfill({
        status: 404,
        json: { message: "Unexpected preview request" },
      });
    }
    if (route.request().method() === "PUT") {
      const request: TenantAlertRuleRequest = route.request().postDataJSON();
      writes.push(request);
      saved =
        request.mode === "TENANT_OVERRIDE"
          ? { ...saved, ...request, version: saved.version + 1 }
          : {
              tenantId: saved.tenantId,
              mode: request.mode,
              version: saved.version + 1,
            };
    }
    return route.fulfill({ json: envelope(saved) });
  });
  return { writes, unknown };
}

test("low-density rules and focused editor work across device widths", async ({
  page,
}) => {
  const { unknown, writes } = await install(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(directory, { recursive: true });
  for (const viewport of [
    { width: 1856, height: 1400 },
    { width: 1440, height: 1000 },
    { width: 1024, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin?section=alerts");
    const list = page.getByRole("list", { name: "Alert rule categories" });
    await expect(list.getByRole("listitem")).toHaveCount(8);
    await expect(page.locator("details")).toHaveCount(0);
    await expect(list.getByRole("switch")).toHaveCount(3);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    if (viewport.width === 390)
      await expect(
        list.getByText("Learning inactivity", { exact: true }),
      ).toBeInViewport({ ratio: 1 });
    expect(
      await page
        .locator("main")
        .first()
        .evaluate((main) => main.scrollWidth - main.clientWidth),
      `overflow at ${viewport.width}`,
    ).toBeLessThanOrEqual(1);
    for (const row of await list.getByRole("listitem").all()) {
      expect(
        await row.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    if ([1856, 390].includes(viewport.width)) {
      await page.screenshot({
        path: `${directory}/list-${viewport.width}.png`,
        animations: "disabled",
      });
    }
    const edit = list.getByRole("button", {
      name: "Edit completion",
      exact: true,
    });
    await edit.click();
    const drawer = page.getByRole("dialog", {
      name: "Completion",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("spinbutton")).toHaveCount(3);
    expect(
      await drawer.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    if ([1856, 390].includes(viewport.width)) {
      await page.screenshot({
        path: `${directory}/editor-${viewport.width}.png`,
        animations: "disabled",
      });
    }
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(edit).toBeFocused();
    if (viewport.width === 390) {
      await list
        .getByRole("switch", { name: "Overdue tasks" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${directory}/switches-390.png`,
        animations: "disabled",
      });
    }
  }
  expect(unknown).toEqual([]);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test("editor drafts, real switch fields, whole-policy save, and reload stay consistent", async ({
  page,
}) => {
  const { writes } = await install(page);
  await page.goto("/admin?section=alerts");
  await page.getByRole("button", { name: "Edit learning inactivity" }).click();
  await page.getByLabel("Inactivity (days)", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Apply to draft" }).click();
  await expect(page.getByText("Inactivity: 12 days")).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("switch", { name: "Overdue tasks" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible();
  expect(writes).toEqual([
    expect.objectContaining({
      mode: "TENANT_OVERRIDE",
      expectedVersion: 2,
      inactivityDays: 12,
      absenceCount: 3,
      overdueTaskEnabled: null,
    }),
  ]);
  expect(writes[0]).not.toHaveProperty("inactivityEnabled");
  expect(writes[0]).not.toHaveProperty("tenantId");
  await page.reload();
  await expect(page.getByText("Inactivity: 12 days")).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Overdue tasks" }),
  ).not.toBeChecked();
});

test("missing system defaults remain quiet, read only, and free of invented thresholds", async ({
  page,
}) => {
  const { writes } = await install(page, {
    tenantId: 7,
    mode: "SYSTEM_DEFAULT",
    version: 3,
  });
  await page.setViewportSize({ width: 1856, height: 1400 });
  await page.goto("/admin?section=alerts");
  await expect(
    page
      .getByRole("list", { name: "Alert rule categories" })
      .getByRole("listitem"),
  ).toHaveCount(8);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByText(/Unavailable/)).toHaveCount(0);
  await expect(page.getByText(/Inactivity: 7/)).toHaveCount(0);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/system-default-1856.png`,
    animations: "disabled",
  });
  await page.getByRole("radio", { name: /Disabled/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText(/Tenant alert evaluation is paused/),
  ).toBeVisible();
  expect(writes).toEqual([{ mode: "DISABLED", expectedVersion: 3 }]);
});

test("failed saves keep edits and pending saves block duplicate writes", async ({
  page,
}) => {
  await install(page);
  let finish: (() => void) | undefined;
  let writes = 0;
  await page.route("**/v2/tenant/alert-rules", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    writes++;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return route.fulfill({
      status: 409,
      json: {
        status: 409,
        message: "Policy version changed. Reload the latest policy.",
      },
    });
  });
  await page.goto("/admin?section=alerts");
  await page.getByRole("switch", { name: "Negative hours" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: /System default/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Negative hours" }),
  ).toBeDisabled();
  await expect.poll(() => Boolean(finish)).toBe(true);
  finish!();
  await expect(page.getByRole("alert")).toContainText(
    "Your draft is preserved",
  );
  await expect(
    page.getByRole("switch", { name: "Negative hours" }),
  ).toBeChecked();
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Cancel changes" }).click();
  await expect(
    page.getByRole("switch", { name: "Negative hours" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Refresh alert rules" }),
  ).toBeEnabled();
});
