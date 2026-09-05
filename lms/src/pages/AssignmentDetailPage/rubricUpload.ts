import { assignmentApiService } from "@/apis/services/assignment-api";
import { getApiErrorCode } from "@/utils/apiError";

export const uploadRubricWithReplaceConfirmation = async (
  courseId: number,
  assignmentId: number,
  file: File,
  alreadyConfirmed: boolean,
  confirmReplacement: () => Promise<boolean>,
) => {
  try {
    return await assignmentApiService.uploadRubric(
      courseId,
      assignmentId,
      file,
      alreadyConfirmed,
    );
  } catch (error) {
    // The rubric summary only reports grades tied to an older version. A
    // grade can therefore be created after the summary was fetched (or be
    // tied to the current version) and the server becomes the authoritative
    // source for whether replacing the rubric needs explicit confirmation.
    if (
      !alreadyConfirmed &&
      getApiErrorCode(error) === "RUBRIC_REPLACE_CONFIRM_REQUIRED" &&
      (await confirmReplacement())
    ) {
      return assignmentApiService.uploadRubric(
        courseId,
        assignmentId,
        file,
        true,
      );
    }
    throw error;
  }
};
