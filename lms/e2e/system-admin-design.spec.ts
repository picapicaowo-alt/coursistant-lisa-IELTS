import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({ status: 200, code: "SUCCESS", data });
const users = Array.from({ length: 23 }, (_, index) => ({
  id: index + 1,
  tenantId: index < 13 ? 1 : 2,
  firstName: ["Maya", "Daniel", "Emily"][index % 3],
  lastName: `Chen ${index + 1}`,
  email: `person${index + 1}@example.test`,
  role: "USER",
  level: index % 2 ? "INSTRUCTOR" : "STUDENT",
  status: index === 5 ? "DISABLED" : "ACTIVE",
}));
const courses = [
  {
    id: 71,
    tenantId: 1,
    courseCode: "IELTS-W01",
    title: "Academic Writing Studio",
    state: "Active",
    primaryInstructor: { userId: 2, name: "Daniel Chen" },
  },
  {
    id: 72,
    tenantId: 2,
    courseCode: "IELTS-S02",
    title: "Speaking with Confidence",
    state: "Active",
    primaryInstructor: { userId: 4, name: "Maya Lee" },
  },
];
async function fixture(page: Page, locale = "en") {
  const writes: { path: string; body: unknown }[] = [];
  const reads: string[] = [];
  await page.addInitScript(
    ({ locale }) => {
      localStorage.setItem("coursistant.locale", locale);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: 900,
          userId: 900,
          name: "System Reviewer",
          email: "reviewer@example.test",
          role: "SYSTEM_ADMIN",
          level: "NOT_APPLICABLE",
          accessToken: "isolated-admin-fixture",
        }),
      );
      localStorage.setItem("accToken", "isolated-admin-fixture");
    },
    { locale },
  );
  await page.route("**/v2/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (request.method() !== "GET") {
      writes.push({ path, body: request.postDataJSON() });
      if (path === "/v2/system/managed-users") data = 99;
    } else {
      reads.push(path + url.search);
      if (path === "/v2/users") data = users;
      else if (/^\/v2\/users\/\d+$/.test(path))
        data = users.find((user) => user.id === Number(path.split("/").pop()));
      else if (path.endsWith("/unread-count")) data = { unreadCount: 0 };
      else if (path === "/v2/admins")
        data = [
          { id: 900, name: "System Reviewer", email: "reviewer@example.test" },
        ];
      else if (path === "/v2/admins/900")
        data = {
          id: 900,
          name: "System Reviewer",
          email: "reviewer@example.test",
          username: "reviewer",
        };
      else if (path === "/v2/courses") {
        const items = courses.filter(
          (course) =>
            (!url.searchParams.get("tenantId") ||
              String(course.tenantId) === url.searchParams.get("tenantId")) &&
            (!url.searchParams.get("q") ||
              course.title
                .toLowerCase()
                .includes(url.searchParams.get("q")!.toLowerCase())),
        );
        data = {
          items,
          page: 0,
          size: Number(url.searchParams.get("size")) || 20,
          total: items.length,
        };
      } else if (path.endsWith("/members"))
        data = {
          items: [
            {
              id: 1,
              userId: 2,
              userName: "Daniel Chen",
              userEmail: "daniel@example.test",
              courseRole: "Instructor",
              active: true,
            },
            {
              id: 2,
              userId: 3,
              userName: "Emily Chen",
              userEmail: "emily@example.test",
              courseRole: "Student",
              active: true,
            },
          ],
          page: 0,
          size: 20,
          total: 2,
        };
      else if (path === "/v2/system/mock-exams")
        data = [
          { testId: 51, title: "Academic Practice — September" },
          { testId: 52, title: "General Training — Practice 2" },
        ];
      else if (/\/mock-exams\/\d+$/.test(path))
        data = { testId: 51, title: "Academic Practice — September" };
      else if (/\/mock-exams\/\d+\//.test(path))
        data = {
          instructions: "Read the passage and answer the questions.",
          passages: [
            {
              title: "Urban gardens",
              text: "Community gardens bring neighbours together and create room for learning.",
            },
          ],
        };
    }
    await route.fulfill({ json: envelope(data) });
  });
  return { writes, reads };
}

for (const locale of ["en", "zh-CN", "zh-TW"]) {
  test(`system admin surfaces are localized and responsive: ${locale}`, async ({
    page,
  }, info) => {
    const { writes, reads } = await fixture(page, locale);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/admin");
    await expect(page.getByRole("table")).toBeVisible();
    const tabs = page.getByRole("navigation", {
      name: locale === "en" ? "Admin sections" : "管理功能",
    });
    const capture = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible()) {
          const bounds = await dialog.boundingBox();
          expect(bounds).not.toBeNull();
          expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
          expect(Math.abs(bounds!.y + bounds!.height / 2 - 500)).toBeLessThanOrEqual(1);
        }
        if (name.startsWith("operation-")) {
          await page.getByRole('navigation', {name: locale === 'en' ? 'System operation tasks' : locale === 'zh-CN' ? '系统操作任务' : '系統操作任務'}).locator('button[aria-pressed="false"]').first().hover();
        }
        await page.screenshot({
          path: info.outputPath(`${name}-${locale}-${width}.png`),
          fullPage: true,
        });
      }
    };
    await capture("users");
    await page.getByRole("table").getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("account");
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name: locale === "en" ? "Create user" : locale === "zh-CN" ? "创建账户" : "建立帳戶", exact: true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("create-user");
    await page.keyboard.press("Escape");
    await tabs.getByRole("button").nth(1).click();
    await expect(
      page.getByText("Academic Writing Studio", { exact: true }),
    ).toBeVisible();
    await capture("members");
    await page.getByRole("button", {name: locale === "en" ? "Add course member" : locale === "zh-CN" ? "添加课程成员" : "新增課程成員", exact: true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("add-member");
    await page.keyboard.press("Escape");
    await tabs.getByRole("button").nth(2).click();
    await capture("tenants");
    await tabs.getByRole("button").nth(3).click();
    await capture("operations-directory");
    const tasks = page.getByRole("navigation", {
      name:
        locale === "en"
          ? "System operation tasks"
          : locale === "zh-CN"
            ? "系统操作任务"
            : "系統操作任務",
    });
    for (let i = 1; i < 4; i++) {
      await tasks.getByRole("button").nth(i).click();
      await expect(tasks.locator('[aria-pressed="true"]')).toHaveCount(1);
      const unselected = tasks.getByRole("button").nth(i - 1);
      await unselected.hover();
      const selectedBackground = await tasks.getByRole("button").nth(i).evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(await unselected.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(selectedBackground);
      await capture(`operation-${i}`);
    }
    await page.goto("/mock-exams");
    await page.getByRole("button", { name: /Academic Practice/ }).click();
    await expect(page.getByText("Urban gardens")).toBeVisible();
    await capture("exams");
    await page.goto("/course");
    await expect(
      page.getByText("Academic Writing Studio").first(),
    ).toBeVisible();
    await capture("courses");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("body")).not.toContainText("common:admin.");
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    expect(reads.some((path) => path.startsWith("/v2/tenant/"))).toBe(false);
  });
}

test("system identity actions preserve confirmation and contract scope", async ({
  page,
}) => {
  const { writes, reads } = await fixture(page);
  await page.goto("/admin");
  await expect(page.getByRole("row")).toHaveCount(11);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Manage Daniel Chen 11" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search users" })
    .fill("Maya Chen 1");
  await expect(
    page.getByRole("button", { name: "Manage Maya Chen 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage Maya Chen 1", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Review role change" }).click();
  expect(writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("User role updated");
  await expect(dialog.getByRole("button", {name: "Close dialog"})).toBeEnabled();
  expect(writes[0]).toEqual({
    path: "/v2/system/managed-users/1/role",
    body: { role: "USER", level: "STUDENT" },
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await dialog.getByLabel("First name", { exact: true }).fill("Grace");
  await dialog.getByLabel("Last name", { exact: true }).fill("Lin");
  await dialog.getByLabel("Email", { exact: true }).fill("grace@example.test");
  await dialog.getByLabel("Tenant ID", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(dialog.getByRole("status")).toContainText("Account #99 created");
  expect(writes[1]).toEqual({
    path: "/v2/system/managed-users",
    body: {
      firstName: "Grace",
      lastName: "Lin",
      email: "grace@example.test",
      tenantId: 2,
      role: "USER",
      level: "STUDENT",
    },
  });
  expect(reads.some((path) => path.startsWith("/v2/tenant/"))).toBe(false);
});

test("system course search sends explicit contract filters", async ({
  page,
}) => {
  const { reads } = await fixture(page);
  await page.goto("/course");
  await page
    .getByRole("searchbox", { name: "Search courses" })
    .fill("Speaking");
  await page.getByLabel("Tenant ID", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Speaking with Confidence").first(),
  ).toBeVisible();
  await expect(page.getByText("Academic Writing Studio")).toHaveCount(0);
  expect(
    reads.some(
      (path) =>
        path.startsWith("/v2/courses?") &&
        path.includes("tenantId=2") &&
        path.includes("q=Speaking") &&
        path.includes("page=0"),
    ),
  ).toBe(true);
});
