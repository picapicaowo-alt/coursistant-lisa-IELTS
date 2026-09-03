import { expect, test, type Page } from "@playwright/test";

const response = (data: unknown) => ({ status: 200, code: "SUCCESS", data });
async function identity(page: Page, role = "USER", level = "PARENT") {
  await page.addInitScript(
    (user) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accToken", user.accessToken);
    },
    {
      id: 901,
      userId: 901,
      role,
      level,
      accessToken: "isolated-client-delivery-fixture",
    },
  );
}

test("parent sees later linked students, nested academic data and independent learning errors", async ({
  page,
}, info) => {
  await identity(page);
  const linkedPages: number[] = [];
  const reads: string[] = [];
  await page.route("**/v2/**", (route) => {
    const url = new URL(route.request().url());
    reads.push(url.pathname);
    let data: unknown = [];
    if (url.pathname.endsWith("/linked-students")) {
      const page = Number(url.searchParams.get("page") ?? 0);
      linkedPages.push(page);
      data = {
        items: [{ studentUserId: page === 0 ? 301 : 302 }],
        page,
        size: 1,
        total: 2,
      };
    } else if (url.pathname.endsWith("/profile"))
      data = {
        firstName: "Alex",
        lastName: "Chen",
        targetGoal: "Build academic confidence",
      };
    else if (url.pathname.endsWith("/study-plan"))
      data = {
        strategySummary: "Practice, review and reflect each week.",
        checkpoints: [
          {
            description: "Build the foundations",
            tasks: [{ title: "Draft an introduction", status: "NOT_STARTED" }],
          },
        ],
      };
    else if (url.pathname.endsWith("/courses"))
      data = [
        {
          title: "Academic Writing",
          status: "Active",
          lectureCompleted: 6,
          lectureTotal: 12,
        },
      ];
    else if (url.pathname.endsWith("/hours"))
      data = {
        purchasedMinutes: 720,
        consumedMinutes: 0,
        remainingMinutes: 720,
      };
    else if (url.pathname.endsWith("/attendance"))
      return route.fulfill({
        status: 503,
        json: {
          status: 503,
          code: "UNAVAILABLE",
          message: "Attendance temporarily unavailable",
        },
      });
    else if (url.pathname.endsWith("/risk")) data = { riskStatus: "ON_TRACK" };
    else if (url.pathname.endsWith("/unread-count")) data = { unreadCount: 0 };
    return route.fulfill({ json: response(data) });
  });
  await page.goto("/parent?section=learning&studentUserId=999");
  await expect(
    page.getByRole("combobox", { name: "Student", exact: true }),
  ).toHaveValue("301");
  expect(linkedPages).toEqual([0, 1]);
  await expect(page.getByText("Draft an introduction")).toBeVisible();
  await page.getByRole("link", { name: "Attendance & hours", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Course hours" })
      .getByText("0", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Attendance" }).getByRole("alert"),
  ).toContainText("Attendance temporarily unavailable");
  for (const width of [320, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`parent-learning-${width}.png`),
        fullPage: true,
      });
  }
  await page
    .getByRole("combobox", { name: "Student", exact: true })
    .selectOption("302");
  await expect(page).toHaveURL(/studentUserId=302/);
  await expect
    .poll(() => reads.some((path) => path.endsWith("/students/302/hours")))
    .toBe(true);
  expect(reads.some((path) => path.includes("/students/999/"))).toBe(false);
});

test("parent report pagination and attachment failures preserve student boundaries", async ({
  page,
}) => {
  await identity(page);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/v2/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    let data: unknown = [];
    if (url.pathname.endsWith("/linked-students"))
      data = {
        items: [{ studentUserId: 301 }, { studentUserId: 302 }],
        page: 0,
        size: 20,
        total: 2,
      };
    else if (url.pathname.endsWith("/reports"))
      data = {
        items: [
          {
            reportId: 501,
            title:
              url.searchParams.get("page") === "1"
                ? "Earlier learning report"
                : "Latest learning report",
          },
        ],
        page: Number(url.searchParams.get("page")),
        size: 20,
        total: 21,
      };
    else if (url.pathname.endsWith("/conversation/messages")) {
      if (url.pathname.includes("/302/"))
        return route.fulfill({
          status: 503,
          json: {
            status: 503,
            code: "UNAVAILABLE",
            message: "Conversation temporarily unavailable",
          },
        });
      data = {
        items: [
          {
            messageId: 51,
            body: "Your learning update",
            attachments: [{ attachmentId: 61, originalName: "Report.pdf" }],
          },
        ],
        hasMore: false,
      };
    } else if (url.pathname.includes("/attachments/"))
      return route.fulfill({
        status: 503,
        json: {
          status: 503,
          code: "UNAVAILABLE",
          message: "Attachment temporarily unavailable",
        },
      });
    else if (url.pathname.endsWith("/unread-count")) data = { unreadCount: 0 };
    return route.fulfill({ json: response(data) });
  });
  await page.goto("/parent?section=reports");
  await expect(page.getByText("Latest learning report")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Report pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect(page.getByText("Earlier learning report")).toBeVisible();
  await page.getByRole("link", { name: "Messages", exact: true }).click();
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/attachment/i);
  await page
    .getByLabel("Message", { exact: true })
    .fill("Draft for the first student");
  await page
    .getByRole("combobox", { name: "Student", exact: true })
    .selectOption("302");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "Conversation temporarily unavailable",
  );
  expect(errors).toEqual([]);
  expect(
    requests.some((url) => url.includes("/students/301/reports?page=1")),
  ).toBe(true);
});

test("system administration uses the managed-user contract without speculative tenant calls", async ({
  page,
}) => {
  await identity(page, "SYSTEM_ADMIN", "NOT_APPLICABLE");
  const requests: string[] = [];
  let created: Record<string, unknown> | undefined;
  await page.route("**/v2/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (
      url.pathname.endsWith("/system/managed-users") &&
      request.method() === "POST"
    ) {
      created = request.postDataJSON();
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      return route.fulfill({ json: response(21) });
    }
    return route.fulfill({
      json: response(
        url.pathname.endsWith("/unread-count") ? { unreadCount: 0 } : [],
      ),
    });
  });
  await page.goto("/admin");
  await page.getByLabel("First name", { exact: true }).fill("Alex");
  await page.getByLabel("Last name", { exact: true }).fill("Chen");
  await page.getByLabel("Email", { exact: true }).fill("alex@example.test");
  await expect(
    page.getByRole("button", { name: "Create user", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Tenant ID", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect
    .poll(() => created)
    .toMatchObject({
      firstName: "Alex",
      lastName: "Chen",
      email: "alex@example.test",
      tenantId: 7,
      role: "USER",
      level: "STUDENT",
    });
  await page.getByRole("button", { name: "Tenants", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tenant management" }),
  ).toBeVisible();
  expect(requests.some((path) => path.includes("/admin/tenants"))).toBe(false);
});

test('writing grades keep drafts with their script and reuse the same request on retry', async ({page}) => {
  await identity(page, 'USER', 'INSTRUCTOR');
  const writes: Array<{key?: string; body: Record<string, unknown>; path: string}> = [];
  await page.route('**/v2/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/writing-grades')) data = [{gradeId: 51, title: 'First script'}, {gradeId: 52, title: 'Second script'}];
    else if (/\/writing-grades\/\d+$/.test(path)) {
      if (request.method() === 'POST') {
        writes.push({key: request.headers()['idempotency-key'], body: request.postDataJSON(), path});
        if (writes.length === 1) return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Grading temporarily unavailable'}});
        data = {gradeId: 52, status: 'GRADED'};
      } else data = {gradeId: Number(path.split('/').at(-1)), title: 'Writing response', content: 'The candidate makes a supported argument.'};
    } else if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    return route.fulfill({json: response(data)});
  });
  await page.goto('/mock-exams');
  await page.getByRole('button', {name: /First script/}).click();
  await page.getByLabel('Score', {exact: true}).fill('5.5');
  await page.getByLabel('Feedback', {exact: true}).fill('Feedback for the first script');
  await page.getByRole('button', {name: /Second script/}).click();
  await expect(page.getByLabel('Score', {exact: true})).toHaveValue('');
  await expect(page.getByLabel('Feedback', {exact: true})).toHaveValue('');
  await page.getByLabel('Score', {exact: true}).fill('6.5');
  await page.getByLabel('Feedback', {exact: true}).fill('Feedback for the second script');
  await page.getByRole('button', {name: 'Submit result', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Grading temporarily unavailable');
  await page.getByRole('button', {name: 'Submit result', exact: true}).click();
  await expect(page.getByRole('status').filter({hasText: 'Writing result submitted.'})).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0]).toMatchObject({path: expect.stringMatching(/\/writing-grades\/52$/), body: {score: 6.5, feedback: 'Feedback for the second script'}});
  expect(writes[0].key).toBeTruthy();
});
