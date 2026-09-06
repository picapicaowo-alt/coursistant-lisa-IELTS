import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentAttachment } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import {
  InstructorAttachmentRow,
  RubricEmptyState,
  StudentGradeSummary,
} from "./index";
import { uploadRubricWithReplaceConfirmation } from "./rubricUpload";

vi.mock("@/apis/services/assignment-api", () => ({
  assignmentApiService: {
    downloadAttachment: vi.fn(),
    previewAttachment: vi.fn(),
    uploadRubric: vi.fn(),
  },
}));

vi.mock("@/utils/downloadBlob", () => ({
  isPreviewableFile: vi.fn(() => true),
  openPreviewWindow: vi.fn(),
  saveBlob: vi.fn(),
  showBlobInPreviewWindow: vi.fn(),
}));

const attachment: AssignmentAttachment = {
  id: 33,
  assignmentId: 9,
  originalName: "attach2.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  uploadedBy: 7,
  createdAt: "2026-08-18T12:00:00Z",
  downloadUrl: "/v2/courses/4/assignments/9/attachments/33/download",
};

describe("InstructorAttachmentRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads a previewable file when its filename is clicked", async () => {
    const blob = new Blob(["assignment"], { type: "application/pdf" });
    vi.mocked(assignmentApiService.downloadAttachment).mockResolvedValue(blob);
    render(
      <InstructorAttachmentRow
        courseId={4}
        assignmentId={9}
        attachment={attachment}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download attach2.pdf" }),
    );

    await waitFor(() => {
      expect(assignmentApiService.downloadAttachment).toHaveBeenCalledWith(
        4,
        9,
        33,
      );
      expect(saveBlob).toHaveBeenCalledWith(blob, "attach2.pdf");
    });
  });

  it("uses the inline preview endpoint for a previewable instructor file", async () => {
    const blob = new Blob(["assignment"], { type: "application/pdf" });
    const close = vi.fn();
    const previewWindow = { close } as unknown as Window;
    vi.mocked(openPreviewWindow).mockReturnValue(previewWindow);
    vi.mocked(assignmentApiService.previewAttachment).mockResolvedValue(blob);
    render(
      <InstructorAttachmentRow
        courseId={4}
        assignmentId={9}
        attachment={attachment}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(assignmentApiService.previewAttachment).toHaveBeenCalledWith(
        4,
        9,
        33,
      );
      expect(showBlobInPreviewWindow).toHaveBeenCalledWith(previewWindow, blob);
    });
    expect(close).not.toHaveBeenCalled();
  });
});

describe("RubricEmptyState", () => {
  it("does not show instructor upload guidance to students", () => {
    render(<RubricEmptyState canConfigureAssignments={false} />);

    expect(
      screen.queryByText(
        "Upload a PDF rubric to keep grading criteria with this assignment.",
      ),
    ).toBeNull();
  });

  it("keeps the upload guidance available to assignment managers", () => {
    render(<RubricEmptyState canConfigureAssignments />);

    expect(
      screen.getByText(
        "Upload a PDF rubric to keep grading criteria with this assignment.",
      ),
    ).toBeTruthy();
  });
});

describe("uploadRubricWithReplaceConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for confirmation and retries when the server reports existing grades", async () => {
    const file = new File(["valid pdf"], "rubric.pdf", {
      type: "application/pdf",
    });
    const success = {
      status: 200,
      code: "SUCCESS",
      message: "ok",
      timestamp: "2026-08-18T12:00:00Z",
      data: { posted: true, originalName: "rubric.pdf" },
    };
    vi.mocked(assignmentApiService.uploadRubric)
      .mockRejectedValueOnce({
        code: 409,
        message: "Request failed",
        details: { code: "RUBRIC_REPLACE_CONFIRM_REQUIRED" },
      })
      .mockResolvedValueOnce(success);
    const confirm = vi.fn(async () => true);

    await expect(
      uploadRubricWithReplaceConfirmation(4, 9, file, false, confirm),
    ).resolves.toBe(success);
    expect(confirm).toHaveBeenCalledOnce();
    expect(assignmentApiService.uploadRubric).toHaveBeenNthCalledWith(
      1,
      4,
      9,
      file,
      false,
    );
    expect(assignmentApiService.uploadRubric).toHaveBeenNthCalledWith(
      2,
      4,
      9,
      file,
      true,
    );
  });

  it("does not retry when the user declines replacement", async () => {
    const file = new File(["valid pdf"], "rubric.pdf", {
      type: "application/pdf",
    });
    const error = {
      code: 409,
      message: "Request failed",
      details: { code: "RUBRIC_REPLACE_CONFIRM_REQUIRED" },
    };
    vi.mocked(assignmentApiService.uploadRubric).mockRejectedValueOnce(error);
    const confirm = vi.fn(async () => false);

    await expect(
      uploadRubricWithReplaceConfirmation(4, 9, file, false, confirm),
    ).rejects.toBe(error);
    expect(assignmentApiService.uploadRubric).toHaveBeenCalledTimes(1);
  });
});

describe("StudentGradeSummary", () => {
  it("keeps the score and feedback private before release", () => {
    render(
      <StudentGradeSummary
        gradeReleased={false}
        score={19}
        pointsPossible={20}
        feedback="<p>Excellent database verification.</p>"
      />,
    );

    expect(screen.getByRole("heading", { name: "Grade" })).toBeTruthy();
    expect(screen.getByText("Grade pending release")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.queryByLabelText("Score 19 / 20")).toBeNull();
    expect(screen.queryByText("Excellent database verification.")).toBeNull();
  });

  it("shows the released score and safely rendered feedback", () => {
    render(
      <StudentGradeSummary
        gradeReleased
        score={19}
        pointsPossible={20}
        feedback="<p>Excellent database verification.</p><p>Clear screenshots.</p>"
      />,
    );

    expect(screen.getByRole("heading", { name: "Grade" })).toBeTruthy();
    expect(screen.getByText("Released")).toBeTruthy();
    expect(screen.getByLabelText("Score 19 / 20").textContent).toBe("19 / 20");
    expect(
      screen.getByText(/Excellent database verification/).textContent,
    ).toBe("Excellent database verification.\nClear screenshots.");
  });

  it("uses an explicit empty feedback state for released grades", () => {
    render(
      <StudentGradeSummary gradeReleased score={19} pointsPossible={20} />,
    );
    expect(screen.getByText("No feedback was provided.")).toBeTruthy();
  });
});
