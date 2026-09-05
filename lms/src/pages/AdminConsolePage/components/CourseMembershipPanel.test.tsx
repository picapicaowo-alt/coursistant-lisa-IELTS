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
      screen.queryByRole("button", { name: "Return to student" }),
    ).not.toBeInTheDocument();

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

  it("does not expose TA assignment, role changes, or enrollment options", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Jiarui Zhang");
    expect(screen.queryByRole("button", {name: /Set as TA|Return to student/})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Add course member"}));
    expect(screen.queryByRole("combobox", {name: "Course role"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /assign TA/})).not.toBeInTheDocument();
    expect(mocks.promoteToTa).not.toHaveBeenCalled();
    expect(mocks.demoteTa).not.toHaveBeenCalled();
  });
});
