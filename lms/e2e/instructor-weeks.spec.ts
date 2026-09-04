import { expect, test, type Page } from "@playwright/test";
import type { CourseWeek } from "../src/apis/types/course";
import { instructorFixture, course } from "./instructor-workspace-fixture";
import { reply } from "./workspace-fixtures";

const titles = [
  "Task Response",
  "Cohesion & Coherence",
  "Lexical Resource",
  "Grammatical Range",
  "Academic Sources",
  "Data & Graph Writing",
  "Discussion Essays",
  "Review & Timed Practice",
  "Argument Development",
  "Editing & Revision",
  "Writing Workshop",
  "Final Review",
];
async function weeksFixture(
  page: Page,
  count = 12,
  options: {
    omitSummary?: boolean;
    failRead?: boolean;
    failPatch?: boolean;
  } = {},
) {
  await instructorFixture(page);
  let weeks: CourseWeek[] = titles.slice(0, count).map((title, i) => ({
    id: 81 + i,
    courseId: 71,
    title: `Week ${i + 1} ${title}`,
    summary:
      i === 0
        ? "This week focuses on understanding and responding to IELTS Academic Writing Task 1 and Task 2 prompts.\nYou will analyze sample questions, plan responses, and draft your own answers."
        : `Practise ${title.toLowerCase()} through guided writing and feedback.`,
    orderPosition: i,
    state: i < 3 ? "Published" : "Draft",
    createdAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    materials: [
      {
        id: 121 + i,
        courseId: 71,
        weekId: 81 + i,
        materialType: "FILE",
        teachingType: "DOCUMENT",
        displayName: `academic-writing-week${i + 1}.pdf`,
        originalFilename: `academic-writing-week${i + 1}.pdf`,
        contentType: "application/pdf",
        extension: "pdf",
        sizeBytes: 246784,
        linkUrl: null,
        orderPosition: 0,
        uploadedBy: 301,
        previewAvailable: true,
        publicationState: "PUBLISHED",
        downloadUrl: "",
      },
    ],
  }));
  const writes: {
    method: string;
    path: string;
    body: Record<string, unknown>;
    key?: string;
  }[] = [];
  await page.route("**/v2/courses/71/weeks**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, ""),
      method = req.method();
    const body: Record<string, unknown> = req
      .headers()
      ["content-type"]?.includes("application/json")
      ? (req.postDataJSON() ?? {})
      : {};
    const match = path.match(/\/weeks\/(\d+)/),
      week = weeks.find((item) => item.id === Number(match?.[1]));
    if (method !== "GET")
      writes.push({
        method,
        path,
        body,
        key: req.headers()["idempotency-key"],
      });
    if (method === "PATCH" && options.failPatch)
      return route.fulfill({
        status: 500,
        json: { code: "INTERNAL_SERVER_ERROR", message: "Unable to save" },
      });
    if (
      method === "GET" &&
      match &&
      !path.includes("/materials") &&
      options.failRead
    )
      return route.fulfill({
        status: 500,
        json: { code: "INTERNAL_SERVER_ERROR" },
      });
    if (path.endsWith("/download.zip"))
      return route.fulfill({
        contentType: "application/zip",
        body: "fixture-zip-bytes",
      });
    if (/\/materials\/\d+\/(download|preview)$/.test(path))
      return route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4\n%%EOF",
      });
    if (path.includes("/materials/")) {
      const materialId = Number(path.match(/\/materials\/(\d+)/)?.[1]);
      const material = week?.materials.find((item) => item.id === materialId);
      if (material && method === "PATCH") Object.assign(material, body);
      return route.fulfill({ json: reply(material) });
    }
    if (method === "POST" && path.endsWith("/weeks")) {
      const added = {
        ...weeks[0],
        id: 200,
        title: String(body.title),
        summary: typeof body.summary === "string" ? body.summary : "",
        state: "Draft" as const,
        orderPosition: weeks.length,
        materials: [],
      };
      weeks.push(added);
      return route.fulfill({ json: reply(added) });
    }
    if (
      method === "PUT" &&
      path.endsWith("/reorder") &&
      !path.includes("/materials")
    ) {
      weeks = (body.weekIds as number[]).map((id, index) => ({
        ...weeks.find((item) => item.id === id)!,
        orderPosition: index,
      }));
    } else if (week) {
      if (path.endsWith("/publish")) week.state = "Published";
      if (path.endsWith("/unpublish")) week.state = "Draft";
      if (method === "PATCH") Object.assign(week, body);
      if (method === "DELETE")
        weeks = weeks.filter((item) => item.id !== week.id);
    }
    return route.fulfill({
      json: reply(
        match
          ? week &&
              (options.omitSummary ? { ...week, summary: undefined } : week)
          : weeks,
      ),
    });
  });
  return { writes, getWeeks: () => weeks };
}
const actions = async (page: Page) => {
  await page.getByLabel("Week actions", { exact: true }).click();
};

test("Weeks use one detail with filtering, paging and persistent selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1050 });
  await weeksFixture(page);
  await page.goto("/course/71");
  const directory = page.getByRole("region", {
      name: "Course weeks",
      exact: true,
    }),
    detail = page.getByRole("region", { name: "Selected week", exact: true });
  await directory
    .getByRole("button", { name: /Week 3 Lexical Resource/ })
    .click();
  await expect(
    detail.getByRole("heading", { name: "Week 3 Lexical Resource" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("heading", { name: "Week 1 Task Response" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    detail.getByRole("heading", { name: "Week 3 Lexical Resource" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next weeks" }).click();
  await directory.getByRole("button", { name: /Week 8 Review/ }).click();
  await expect(
    detail.getByRole("heading", { name: /Week 8 Review/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    directory.getByRole("button", { name: /Week 8 Review/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox", { name: "Search weeks" }).fill("Cohesion");
  await expect(
    directory.getByRole("button", { name: /Week 2 Cohesion/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next weeks" })).toHaveCount(0);
  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Status", { exact: true }).selectOption("Published");
  await expect(directory.getByRole("button", { name: /Week 4/ })).toHaveCount(
    0,
  );
  await expect(directory.getByRole("button", { name: /Week 3/ })).toBeVisible();
});

test("Summary partial save, readback, publish and reorder use the supported contracts", async ({
  page,
}) => {
  const { writes } = await weeksFixture(page);
  await page.goto("/course/71");
  await actions(page);
  await page.getByRole("button", { name: "Edit week", exact: true }).click();
  await page
    .getByLabel("Overview (optional)")
    .fill("An overview saved through the supported contract.");
  await page.getByRole("button", { name: "Save week", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("An overview saved through the supported contract.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(writes[0].body).toEqual({
    summary: "An overview saved through the supported contract.",
  });
  await actions(page);
  await page.getByRole("button", { name: "Move week down" }).click();
  await expect
    .poll(() => writes.find((item) => item.method === "PUT")?.body.weekIds)
    .toEqual([82, 81, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92]);
  await page
    .getByRole("region", { name: "Course weeks" })
    .getByRole("button", { name: /Week 4 Grammatical/ })
    .click();
  await actions(page);
  await page.getByRole("button", { name: "Publish week", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Selected week" })
      .getByText("Published", { exact: true }),
  ).toBeVisible();
  expect(writes.every((item) => Boolean(item.key))).toBe(true);
});

for (const option of ["omitSummary", "failRead", "failPatch"] as const)
  test(`Overview ${option} preserves entered text`, async ({ page }) => {
    const { writes } = await weeksFixture(page, 4, { [option]: true });
    await page.goto("/course/71");
    await actions(page);
    await page.getByRole("button", { name: "Edit week", exact: true }).click();
    await page
      .getByLabel("Overview (optional)")
      .fill("Keep my unsaved or unconfirmed text.");
    await page.getByRole("button", { name: "Save week", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Overview (optional)")).toHaveValue(
      "Keep my unsaved or unconfirmed text.",
    );
    if (option !== "failPatch")
      await expect(
        page.getByRole("button", { name: "Save week", exact: true }),
      ).toBeDisabled();
    else
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    expect(writes).toHaveLength(1);
  });

test("Create and delete an empty week; download ZIP; archived content stays read-only", async ({
  page,
}) => {
  const { writes } = await weeksFixture(page, 4);
  await page.goto("/course/71");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await page.getByRole("button", { name: "Add week", exact: true }).click();
  await page.getByLabel("Week title").fill("Week 5 Revision");
  await page
    .getByLabel("Overview (optional)")
    .fill("Review and revise the final draft.");
  await page.getByRole("button", { name: "Create week", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Selected week" })
      .getByRole("heading", { name: "Week 5 Revision" }),
  ).toBeVisible();
  await actions(page);
  await page.getByRole("button", { name: "Delete week", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete week", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes.find((item) => item.method === "DELETE")?.path).toBe(
    "/v2/courses/71/weeks/200",
  );
  await page.route("**/v2/courses/71", (route) =>
    route.fulfill({ json: reply({ ...course, state: "Archived" }) }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add week", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Manage materials", exact: true }),
  ).toHaveCount(0);
});

for (const width of [1600, 1280, 1024, 390])
  test(`Week workspace layout and material tools at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1050 });
    const { writes } = await weeksFixture(page, width === 1280 ? 4 : 12);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/course/71");
    await expect(
      page.getByRole("heading", { name: "Academic Writing Studio", level: 1 }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Selected week" })
        .getByRole("heading", { name: "Week 1 Task Response" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    if (width > 768) {
      const left = await page
          .getByRole("region", { name: "Course weeks" })
          .boundingBox(),
        right = await page
          .getByRole("region", { name: "Selected week" })
          .boundingBox();
      expect(Math.abs(left!.y - right!.y)).toBeLessThan(1);
      expect(Math.abs(left!.height - right!.height)).toBeLessThan(1);
    }
    await page.screenshot({
      path: testInfo.outputPath(`weeks-${width}.png`),
      fullPage: true,
    });
    if (width === 390) {
      await page
        .getByRole("combobox", { name: "Selected week", exact: true })
        .selectOption("84");
      await expect(
        page
          .getByRole("region", { name: "Selected week" })
          .getByRole("heading", { name: "Week 4 Grammatical Range" }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Manage materials", exact: true })
      .click();
    await page.getByLabel(/Manage academic-writing-week/).click();
    await expect(
      page.getByRole("button", { name: /Rename academic-writing/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath(`materials-${width}.png`),
      fullPage: true,
    });
    expect(writes).toHaveLength(0);
    expect(errors).toEqual([]);
  });

test("Overview detail read fills a missing list projection without blocking materials", async ({
  page,
}) => {
  const { getWeeks } = await weeksFixture(page, 4);
  await page.route("**/v2/courses/71/weeks", (route) =>
    route.fulfill({
      json: reply(getWeeks().map((week) => ({ ...week, summary: undefined }))),
    }),
  );
  await page.goto("/course/71");
  await expect(
    page.getByText("This week focuses on understanding", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Download academic-writing-week1.pdf",
      exact: true,
    }),
  ).toBeVisible();
});

test("Material menu remains operable on a phone and sends a real rename request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { writes } = await weeksFixture(page, 4);
  await page.goto("/course/71");
  await page.getByRole("button", { name: "Search & filter" }).click();
  await page
    .getByRole("searchbox", { name: "Search weeks" })
    .fill("Grammatical");
  await page
    .getByRole("combobox", { name: "Selected week", exact: true })
    .selectOption("84");
  await page
    .getByRole("button", { name: "Manage materials", exact: true })
    .click();
  await page
    .getByLabel("Manage academic-writing-week4.pdf", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Rename academic-writing-week4.pdf",
      exact: true,
    })
    .click();
  const input = page.getByRole("textbox", {
    name: "Material name for academic-writing-week4.pdf",
    exact: true,
  });
  await input.fill("Revision guide");
  await input.press("Enter");
  await expect(
    page.getByLabel("Manage Revision guide", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => writes.filter((item) => item.method === "PATCH").length)
    .toBe(1);
  expect(writes[0]).toMatchObject({
    path: "/v2/courses/71/weeks/84/materials/124",
    body: { displayName: "Revision guide" },
  });
  expect(writes[0].key).toBeTruthy();
});

test("Course editor preserves structured instructor names and sends only changed fields", async ({
  page,
}) => {
  await weeksFixture(page, 4);
  let current = {
    ...course,
    primaryInstructor: {
      userId: 51,
      instructorFirstName: "Sarah",
      instructorMiddleName: "Mei",
      instructorLastName: "Lim",
    },
    description: "Original description",
  };
  const changes: Record<string, unknown>[] = [];
  await page.route("**/v2/courses/71", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      changes.push(body);
      current = {
        ...current,
        ...body,
        description: body.clearDescription ? "" : current.description,
      };
    }
    await route.fulfill({ json: reply(current) });
  });
  await page.goto("/course/71");
  await expect(page.getByText("Sarah Mei Lim", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit course", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(changes).toEqual([{ clearDescription: true }]);
  await expect(
    page.getByText("Original description", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Selected week" }),
  ).toBeVisible();
});

test("Unconfirmed new overview cannot repeat creation through Enter", async ({
  page,
}) => {
  const { writes } = await weeksFixture(page, 4, { omitSummary: true });
  await page.goto("/course/71");
  await page.getByRole("button", { name: "Add week", exact: true }).click();
  await page.getByLabel("Week title").fill("Revision week");
  await page
    .getByLabel("Overview (optional)")
    .fill("Keep this overview for confirmation.");
  await page.getByRole("button", { name: "Create week", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "could not be confirmed" }),
  ).toBeVisible();
  await page.getByLabel("Week title").press("Enter");
  await expect(page.getByLabel("Overview (optional)")).toHaveValue(
    "Keep this overview for confirmation.",
  );
  expect(
    writes.filter(
      (item) => item.method === "POST" && item.path.endsWith("/weeks"),
    ),
  ).toHaveLength(1);
});

test('configured delivery keeps instructor week authoring independent of course administration', async ({page}) => {
  const {writes} = await weeksFixture(page, 0);
  await page.route('**/v2/me/courses?*', route => route.fulfill({json: reply({items: [{...course, launchState: 'READY'}], total: 1, page: 0, size: 100})}));
  await page.goto('/course/71');
  await expect(page.getByRole('button', {name: 'Edit course', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Add week', exact: true}).click();
  await page.getByLabel('Week title').fill('Configured course teaching week');
  await page.getByLabel('Overview (optional)').fill('Persist the instructional overview independently of delivery configuration.');
  await page.getByRole('button', {name: 'Create week', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Configured course teaching week', exact: true})).toBeVisible();
  await expect(page.getByText('Persist the instructional overview independently of delivery configuration.', {exact: true})).toBeVisible();
  expect(writes.filter(item => item.method === 'POST')).toEqual([expect.objectContaining({path: '/v2/courses/71/weeks', body: {title: 'Configured course teaching week', summary: 'Persist the instructional overview independently of delivery configuration.'}})]);
});

test('configured course instructor can upload the required syllabus without course administration', async ({page}) => {
  await weeksFixture(page, 1);
  await page.route('**/v2/me/courses?*', route => route.fulfill({json: reply({items: [{...course, launchState: 'READY'}], total: 1, page: 0, size: 100})}));
  let uploaded = false;
  await page.route('**/v2/courses/71/syllabus', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postDataBuffer()?.toString()).toContain('name="file"');
      uploaded = true;
    }
    return route.fulfill({json: reply(uploaded ? {posted: true, versionId: 91, originalFilename: 'syllabus.pdf', sizeBytes: 28, canRestorePrevious: false} : {posted: false, canRestorePrevious: false})});
  });
  await page.goto('/course/71?tab=syllabus');
  await expect(page.getByRole('button', {name: 'Edit course', exact: true})).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({name: 'syllabus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nQA syllabus\n%%EOF')});
  await expect(page.getByText('syllabus.pdf', {exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('syllabus.pdf', {exact: true})).toBeVisible();
  expect(uploaded).toBe(true);
});
