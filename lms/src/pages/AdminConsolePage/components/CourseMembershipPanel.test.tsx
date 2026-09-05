import "@testing-library/jest-dom";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browseCourses: vi.fn(),
  listCourseMembers: vi.fn(),
  enrolStudents: vi.fn(),
  promoteToTa: vi.fn(),
  demoteTa: vi.fn(),
}));

vi.mock("@/apis/services/course-api", () => ({
  courseApiService: mocks,
}));

import { CourseMembershipPanel } from "./CourseMembershipPanel";

const success = <T,>(data: T) => ({
  status: 200,
  code: "SUCCESS",
  data,
  message: "Success",
  timestamp: "2026-08-24T12:00:00Z",
});

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CourseMembershipPanel />
    </QueryClientProvider>,
  );
};

describe("CourseMembershipPanel", () => {
  beforeEach(() => {
    mocks.browseCourses.mockResolvedValue(
      success({
        items: [
          {
            id: 31,
            courseId: 31,
            tenantId: 1,
            courseCode: "CSCI-101",
            title: "Foundations of Computing",
            state: "Active",
            instructorId: 7,
            primaryInstructor: {
              userId: 7,
              name: "Professor Ada",
              email: "ada@example.edu",
            },
          },
        ],
        page: 0,
        size: 100,
        total: 1,
      }),
    );
    mocks.listCourseMembers.mockResolvedValue(
      success({
        items: [
          {
            id: 1,
            courseId: 31,
            userId: 7,
            userName: "Professor Ada",
            userEmail: "ada@example.edu",
            courseRole: "Instructor",
            active: true,
            level: "INSTRUCTOR",
          },
          {
            id: 2,
            courseId: 31,
            userId: 485,
            userName: "Jiarui Zhang",
            userEmail: "jiarui@example.edu",
            courseRole: "Student",
            active: true,
            level: "STUDENT",
          },
          {
            id: 3,
            courseId: 31,
            userId: 486,
            userName: "Taylor Assistant",
            userEmail: "taylor@example.edu",
            courseRole: "TA",
            active: true,
            level: "STUDENT",
          },
        ],
        page: 0,
        size: 20,
        total: 3,
      }),
    );
    mocks.enrolStudents.mockResolvedValue(
      success({
        requestedCount: 1,
        successCount: 1,
        failureCount: 0,
        items: [
          {
            userId: 490,
            status: "SUCCESS",
            errorType: null,
            message: null,
            member: null,
          },
        ],
      }),
    );
    mocks.promoteToTa.mockResolvedValue(success({}));
    mocks.demoteTa.mockResolvedValue(success({}));
  });

  it("anchors enrollment to a course and its primary instructor", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(
      await screen.findByRole("option", {
        name: "CSCI-101 — Foundations of Computing · Professor Ada",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Teacher: Professor Ada")).toBeInTheDocument();
    expect(await screen.findByText("Taylor Assistant")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Return to student" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add course member" }));
    await user.type(
      screen.getByRole("textbox", { name: "User email or ID" }),
      "new.student@example.edu",
    );
    await user.click(screen.getByRole("button", { name: "Enroll student" }));

    await waitFor(() =>
      expect(mocks.enrolStudents).toHaveBeenCalledWith(31, {
        emails: ["new.student@example.edu"],
      }),
    );
    expect(
      await screen.findByText("Student enrolled in the selected course."),
    ).toBeInTheDocument();
  });

  it("enrolls a user and assigns the course-scoped TA role in one action", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("Professor Ada");
    await user.click(screen.getByRole("button", { name: "Add course member" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course role" }),
      "TA",
    );
    await user.type(
      screen.getByRole("textbox", { name: "User email or ID" }),
      "new.ta@example.edu",
    );
    await user.click(
      screen.getByRole("button", { name: "Enroll and assign TA" }),
    );

    await waitFor(() =>
      expect(mocks.enrolStudents).toHaveBeenCalledWith(31, {
        emails: ["new.ta@example.edu"],
      }),
    );
    await waitFor(() =>
      expect(mocks.promoteToTa).toHaveBeenCalledWith(31, 490),
    );
    expect(
      await screen.findByText(
        "User enrolled and assigned as a TA for the selected course.",
      ),
    ).toBeInTheDocument();
  });

  it("reports partial success when enrollment succeeds but TA assignment fails", async () => {
    const user = userEvent.setup();
    mocks.promoteToTa.mockRejectedValueOnce({
      code: 409,
      message: "Request failed with status code 409",
      details: { message: "The course rejected the TA role change." },
    });
    renderPanel();

    await screen.findByText("Professor Ada");
    await user.click(screen.getByRole("button", { name: "Add course member" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course role" }),
      "TA",
    );
    await user.type(
      screen.getByRole("textbox", { name: "User email or ID" }),
      "partial.ta@example.edu",
    );
    await user.click(
      screen.getByRole("button", { name: "Enroll and assign TA" }),
    );

    expect(
      await screen.findByText(
        "The user was enrolled, but TA access was not assigned. The course rejected the TA role change.",
      ),
    ).toBeInTheDocument();
  });

  it("requires review before changing a student into a course-scoped TA", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("Jiarui Zhang");
    await user.click(screen.getByRole("button", { name: "Set as TA" }));

    expect(
      screen.getByText(
        /Existing student submissions in this course will be frozen/,
      ),
    ).toBeInTheDocument();
    expect(mocks.promoteToTa).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Confirm TA assignment" }),
    );

    await waitFor(() =>
      expect(mocks.promoteToTa).toHaveBeenCalledWith(31, 485),
    );
    expect(
      await screen.findByText("TA assigned for the selected course."),
    ).toBeInTheDocument();
  });
});
