import type { RubricState } from "@/apis";
import { unwrapData } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import { getApiErrorCode } from "@/utils/apiError";

export const loadRubricState = async (
  courseId: number,
  assignmentId: number,
): Promise<RubricState> => {
  try {
    return unwrapData(
      await assignmentApiService.getRubric(courseId, assignmentId),
      "getRubric",
    );
  } catch (error) {
    if (getApiErrorCode(error) === "RUBRIC_NOT_FOUND") {
      return {
        posted: false,
        assignmentId,
        totalVersions: 0,
        canRestorePrevious: false,
      };
    }
    throw error;
  }
};
