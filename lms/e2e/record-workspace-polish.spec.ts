import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fixture, reply, tasks } from "./workspace-fixtures";

const reviewDirectory = ".impeccable/review/record-workspaces";
const student = {
  tenantId: 1,
  id: 301,
  studentUserId: 301,
  firstName: "Mia",
  lastName: "Watson",
  email: "mia@example.test",
  role: "USER",
  level: "STUDENT",
  status: "ACTIVE",
};
const intake = {
  ...student,
  intakeId: 1348,
  lifecycleStatus: "OPEN",
  assignmentStatus: "ASSIGNED",
  advisorUserId: 801,
  assignmentVersion: 2,
  intakeVersion: 3,
  studentType: "STANDARD",
  courseRequest: "IELTS Intensive Academic Prep",
  contactPhone: "+65 9123 4567",
  basicBackground:
    "Completed secondary education in Singapore. Preparing for admission to a university programme.",
  activationMethod: "PASSWORD_RESET",
};
const profile = {
  ...student,
  profileId: 40,
  profileVersion: 2,
  contactPhone: intake.contactPhone,
  academicBackground: intake.basicBackground,
  priorTestExperience: "Completed a timed mock writing exam last year.",
  baselineAssessment:
    "Strong grammar foundation; vocabulary range needs attention.",
  targetGoal: "Reach overall band 7.5 for university application",
  targetMetric: "IELTS Band",
  targetValue: "7.5",
  targetDate: "2026-10-12",
  advisorInterpretation:
    "Highly motivated. Focus on fluency, coherence and developing a clear argument.",
  advisorPrivateNotes:
    "Responds well to structured practice. Review progress during the next check-in.",
  skills: ["Reading", "Writing", "Speaking", "Listening"].map(
    (name, index) => ({
      skillCode: name.toUpperCase(),
      displayName: name,
      scale: "IELTS 0–9",
      currentValue: ["6.5", "5.5", "5.5", "4.5"][index],
      targetValue: "7.5",
      position: index + 1,
    }),
  ),
};

async function advisorFixture(page: Page) {
  await fixture(page, "ADVISOR");
  await page.route("**/v2/advisor/students/301/hub", (route) =>
    route.fulfill({
      json: reply({
        ...student,
        studentType: "STANDARD",
        activeCourseCount: 2,
        pendingRequestCount: 1,
      }),
    }),
  );
  await page.route("**/v2/advisor/students/301/profile", (route) =>
    route.fulfill({ json: reply(profile) }),
  );
  await page.route("**/v2/advisor/students/301/intake", (route) =>
    route.fulfill({ json: reply(intake) }),
  );
  await page.route("**/v2/advisor/students/301/study-plan", (route) =>
    route.fulfill({
      json: reply({
        studentUserId: 301,
        profileContext: { currentProfileVersion: 2 },
        plan: {
          studyPlanId: 81,
          studyPlanVersion: 1,
          basedOnProfileVersion: 2,
          strategySummary:
            "Build confidence through guided practice and regular feedback.",
          startDate: "2026-09-01",
          planEndDate: "2026-10-12",
          checkpoints: [
            {
              id: 91,
              description: "Foundations and diagnostic",
              goal: "Build a clear argument",
              dueDate: "2026-09-07",
              tasks,
            },
          ],
        },
      }),
    }),
  );
  await page.route("**/v2/advisor/students/301/courses", (route) =>
    route.fulfill({
      json: reply([
        {
          courseId: 71,
          title: "Academic Writing Studio",
          courseCode: "WR101",
          lifecycleStatus: "ONGOING",
          deliveryMode: "GROUP",
          instructorFirstName: "Ivy",
          instructorLastName: "Lee",
          lectureCompleted: 4,
          lectureTotal: 10,
          courseLinkVersion: 1,
          schedule: [
            {
              dayOfWeek: "MONDAY",
              startTime: "09:00:00",
              endTime: "10:00:00",
              location: "Room 3A",
            },
          ],
        },
      ]),
    }),
  );
  await page.route(
    "**/v2/advisor/students/301/conversation/messages*",
    (route) =>
      route.fulfill({
        json: reply([
          {
            messageId: 901,
            senderUserId: 301,
            body: "Hello! I submitted my updated essay structure. Could you review the thesis statement?",
            createdAt: "2026-09-03T12:00:00Z",
          },
          {
            messageId: 902,
            senderUserId: 801,
            body: "Your supporting arguments are well organized. Let’s refine the central claim during our next check-in.",
            createdAt: "2026-09-03T13:00:00Z",
          },
        ]),
      }),
  );
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const nav = page.getByRole("navigation", {
    name: "Student advising sections",
  });
  if (await nav.count()) {
    expect(
      await nav.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    for (const link of await nav.getByRole("link").all()) {
      expect(
        await link.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
    }
  }
}

test("advisor record pages share aligned panels and discoverable navigation at desktop and phone sizes", async ({
  page,
}) => {
  await advisorFixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(reviewDirectory, { recursive: true });
  for (const width of [1588, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await page.goto("/advisor/students/301/profile");
    const context = page.getByRole("region", {
      name: "Student context",
      exact: true,
    });
    const target = page.getByRole("region", {
      name: "Primary target",
      exact: true,
    });
    await expect(context).toBeVisible();
    await expect(target).toBeVisible();
    const [left, right] = await Promise.all([
      context.boundingBox(),
      target.boundingBox(),
    ]);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    if (width > 700) {
      expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(left!.width - right!.width)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(left!.y + left!.height - right!.y - right!.height),
      ).toBeLessThanOrEqual(1);
    } else expect(right!.y).toBeGreaterThanOrEqual(left!.y + left!.height);
    const nav = page.getByRole("navigation", {
      name: "Student advising sections",
    });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(
      page.getByRole("region", { name: "Private advisor notes", exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `${reviewDirectory}/profile-${width}.png` });
    if (width === 1588) {
      await context.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${reviewDirectory}/profile-cards-${width}.png`,
      });
    }
    if (width === 390) {
      await context.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${reviewDirectory}/profile-fields-${width}.png`,
      });
    }
  }
  for (const section of [
    "study-plan",
    "courses",
    "exams",
    "support",
    "intake",
  ]) {
    for (const width of [1588, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.goto(`/advisor/students/301/${section}`);
      await expect(
        page.getByRole("heading", { name: "Mia Watson", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Student advising sections" })
          .locator('[aria-current="page"]'),
      ).toHaveCount(1);
      await noOverflow(page);
      await page.screenshot({
        path: `${reviewDirectory}/${section}-${width}.png`,
      });
      if (section === "intake") {
        await expect(
          page.getByRole("region", { name: "Counsellor intake" }),
        ).toContainText(intake.basicBackground);
        await expect(
          page.getByRole("region", { name: "Parent or guardian access" }),
        ).toContainText("No parent or guardian linked");
        await expect(
          page.getByRole("button", {
            name: "Create or reuse Parent",
            exact: true,
          }),
        ).toHaveCount(0);
      }
      if (width === 390 && (section === "support" || section === "intake")) {
        await page
          .getByRole("region", {
            name: section === "support" ? "Conversation" : "Counsellor intake",
            exact: true,
          })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${reviewDirectory}/${section}-content-${width}.png`,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("profile saves its reviewed version and support attachments retain the actual send contract", async ({
  page,
}) => {
  await advisorFixture(page);
  let saved: Record<string, unknown> | undefined;
  await page.route("**/v2/advisor/students/301/profile", (route) => {
    if (route.request().method() === "PUT")
      saved = route.request().postDataJSON();
    return route.fulfill({ json: reply(profile) });
  });
  await page.goto("/advisor/students/301/profile");
  await page.getByLabel("Contact phone", { exact: true }).fill("+65 9876 5432");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => saved?.expectedProfileVersion).toBe(2);
  expect(saved?.contactPhone).toBe("+65 9876 5432");
  await page.goto("/advisor/students/301/support");
  await page
    .getByLabel("Reply to student")
    .fill("Please review the attached feedback.");
  await page.getByLabel("Attach message files").setInputFiles({
    name: "feedback.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Feedback for the student."),
  });
  const request = page.waitForRequest(
    (request) =>
      request.url().includes("/conversation/messages") &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const sent = await request;
  expect(sent.headers()["idempotency-key"]).toBeTruthy();
  expect(sent.headers()["content-type"]).toContain("multipart/form-data");
  expect(sent.postData()).toContain("feedback.txt");
  expect(sent.postData()).toContain("Please review the attached feedback.");
});

test("tenant record combines same-student intake and parent management with versioned reassignment", async ({
  page,
}) => {
  await fixture(page, "", "Student", "TENANT_ADMIN");
  let current = { ...intake };
  let reassignment: Record<string, unknown> | undefined;
  let parentRequest: Record<string, unknown> | undefined;
  let conflict = true;
  await page.route("**/v2/tenant/users/*", (route) =>
    route.fulfill({
      json: reply(
        route.request().url().endsWith("/301")
          ? student
          : {
              id: 801,
              firstName: "Emma",
              lastName: "Wilson",
              email: "emma@example.test",
              role: "USER",
              level: "ADVISOR",
              status: "ACTIVE",
            },
      ),
    }),
  );
  await page.route("**/v2/tenant/users?*", (route) =>
    route.fulfill({
      json: reply({
        items: [
          {
            id: 802,
            firstName: "Daniel",
            lastName: "Koh",
            email: "daniel@example.test",
            role: "USER",
            level: "ADVISOR",
            status: "ACTIVE",
          },
        ],
        total: 1,
        page: 0,
        size: 20,
      }),
    }),
  );
  await page.route("**/v2/tenant/student-intakes?*", (route) => {
    expect(
      new URL(route.request().url()).searchParams.get("studentUserId"),
    ).toBe("301");
    return route.fulfill({
      json: reply({ items: [current], total: 1, page: 0, size: 20 }),
    });
  });
  await page.route("**/v2/tenant/student-intakes/1348", (route) =>
    route.fulfill({ json: reply(current) }),
  );
  await page.route("**/v2/tenant/students/301/parent-links", (route) => {
    if (route.request().method() === "POST")
      parentRequest = route.request().postDataJSON();
    return route.fulfill({ json: reply([]) });
  });
  await page.route("**/v2/tenant/students/301/advisor", (route) => {
    reassignment = route.request().postDataJSON();
    if (conflict) {
      conflict = false;
      current = { ...current, assignmentVersion: 3 };
      return route.fulfill({
        status: 409,
        json: { status: 409, code: "ADVISOR_ASSIGNMENT_VERSION_CONFLICT" },
      });
    }
    current = { ...current, advisorUserId: 802, assignmentVersion: 4 };
    return route.fulfill({ json: reply(current) });
  });
  await mkdir(reviewDirectory, { recursive: true });
  for (const width of [1448, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1272 });
    await page.goto("/admin/students/301");
    await expect(
      page.getByRole("region", { name: "Counsellor intake" }),
    ).toContainText(intake.basicBackground);
    await expect(
      page.getByRole("region", { name: "Advisor assignment", exact: true }),
    ).toContainText("Emma Wilson");
    await expect(
      page.getByRole("region", { name: "Parent or guardian access" }),
    ).toBeVisible();
    const account = await page.getByRole("region", {name: "Account", exact: true}).boundingBox();
    const context = await page.getByRole("region", {name: "Counsellor intake", exact: true}).boundingBox();
    const parents = await page.getByRole("region", {name: "Parent or guardian access", exact: true}).boundingBox();
    const assignment = await page.getByRole("region", {name: "Advisor assignment", exact: true}).boundingBox();
    if (width > 700) {
      expect(Math.abs(account!.y - parents!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(context!.y + context!.height - assignment!.y - assignment!.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(account!.width - parents!.width)).toBeLessThanOrEqual(1);
    } else expect(parents!.y).toBeGreaterThanOrEqual(context!.y + context!.height);
    await noOverflow(page);
    await page.screenshot({
      path: `${reviewDirectory}/tenant-record-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1410, height: 1100 });
  await page
    .getByRole("button", { name: "Reassign advisor", exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Reassign advisor",
    exact: true,
  });
  await drawer
    .getByRole("button", { name: "Choose advisor", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Choose the replacement advisor" })
    .getByRole("radio", { name: /Daniel Koh/ })
    .check();
  await page
    .getByRole("dialog", { name: "Choose the replacement advisor" })
    .getByRole("button", { name: "Use selected person" })
    .click();
  await drawer
    .getByRole("textbox", { name: /Reason/ })
    .fill("A new teaching schedule.");
  await drawer
    .getByRole("button", { name: "Reassign advisor", exact: true })
    .click();
  await expect.poll(() => reassignment?.expectedAssignmentVersion).toBe(2);
  await expect(
    drawer.getByRole("button", { name: "Reassign advisor", exact: true }),
  ).toBeDisabled();
  await drawer.getByRole("button", { name: "Load latest intake" }).click();
  await expect(drawer.getByRole("textbox", { name: /Reason/ })).toHaveValue(
    "A new teaching schedule.",
  );
  await drawer
    .getByRole("button", { name: "Reassign advisor", exact: true })
    .click();
  await expect.poll(() => reassignment?.expectedAssignmentVersion).toBe(3);
  await expect(drawer.getByRole("status")).toContainText(
    "Advisor assignment saved.",
  );
  await drawer.getByRole("button", { name: "Close reassign advisor" }).click();
  await page
    .getByLabel("Parent email", { exact: true })
    .fill("parent@example.test");
  await page.getByLabel("First name", { exact: true }).fill("Taylor");
  await page.getByLabel("Last name", { exact: true }).fill("Watson");
  await page
    .getByRole("button", { name: "Create or reuse Parent", exact: true })
    .click();
  await expect.poll(() => parentRequest?.email).toBe("parent@example.test");
  expect(parentRequest).toMatchObject({
    firstName: "Taylor",
    lastName: "Watson",
  });
});

test("support report links and course changes retain their own IDs and reviewed versions", async ({
  page,
}) => {
  await advisorFixture(page);
  const report = {
    id: 901,
    courseId: 71,
    title: "September learning review",
    overallSummary: "Evidence-backed writing progress.",
  };
  const writes: { courseId: string; body: Record<string, unknown> }[] = [];
  let feedback: Record<string, unknown> | undefined;
  await page.route("**/v2/advisor/students/301/courses", (route) =>
    route.fulfill({
      json: reply([
        { courseId: 71, title: "Academic Writing Studio" },
        { courseId: 72, title: "Speaking Practice" },
      ]),
    }),
  );
  await page.route("**/v2/advisor/students/301/student-reports?*", (route) =>
    route.fulfill({ json: reply({ items: [report], total: 1 }) }),
  );
  await page.route("**/v2/advisor/students/301/courses/*/hours", (route) => {
    const courseId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    if (route.request().method() === "PUT")
      writes.push({ courseId, body: route.request().postDataJSON() });
    return route.fulfill({
      json: reply({
        purchasedMinutes: courseId === "71" ? 600 : 300,
        remainingMinutes: 240,
        version: courseId === "71" ? 0 : 4,
      }),
    });
  });
  await page.route(
    "**/v2/advisor/students/301/courses/71/student-reports/901",
    (route) => route.fulfill({ json: reply(report) }),
  );
  await page.route(
    "**/v2/advisor/students/301/study-plan/tasks/101/feedback",
    (route) => {
      feedback = route.request().postDataJSON();
      return route.fulfill({
        json: reply({
          ...tasks[0],
          version: 2,
          advisorFeedback: feedback?.feedback,
        }),
      });
    },
  );
  await page.goto("/advisor/students/301/support?courseId=71&reportId=901");
  await page.getByRole("button", { name: report.title, exact: true }).click();
  const reportDrawer = page.getByRole("dialog", {
    name: "Published report",
    exact: true,
  });
  await expect(reportDrawer).toContainText(report.overallSummary);
  await reportDrawer
    .getByRole("button", { name: "Close published report" })
    .click();
  const purchasedMinutes = page.getByLabel("Purchased minutes", {
    exact: true,
  });
  await expect(purchasedMinutes).toHaveValue("600");
  await page
    .getByLabel("Reason for adjustment")
    .fill("Reviewed writing allocation.");
  await page.getByRole("button", { name: "Save purchased hours" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    courseId: "71",
    body: { expectedVersion: 0, purchasedMinutes: 600 },
  });
  await page.getByText("Advanced record lookup", { exact: true }).click();
  await expect(
    page.getByLabel("Published report ID", { exact: true }),
  ).toHaveValue("901");
  await page.getByRole("combobox", { name: "Course", exact: true }).selectOption("72");
  await expect(purchasedMinutes).toHaveValue("300");
  await expect(page.getByLabel("Reason for adjustment")).toHaveValue("");
  await expect(
    page.getByLabel("Published report ID", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("Reason for adjustment")
    .fill("Reviewed speaking allocation.");
  await page.getByRole("button", { name: "Save purchased hours" }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({
    courseId: "72",
    body: { expectedVersion: 4, purchasedMinutes: 300 },
  });
  await page.getByLabel("Learning plan task").selectOption("101");
  await page
    .getByRole("textbox", {name: "Feedback", exact: true})
    .fill("Use a specific example in each paragraph.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await expect.poll(() => feedback?.expectedVersion).toBe(1);
  await page.getByRole("textbox", {name: "Feedback", exact: true}).fill("Add the strongest example first.");
  await page.getByRole("button", {name: "Save feedback", exact: true}).click();
  await expect.poll(() => feedback?.expectedVersion).toBe(2);
});
