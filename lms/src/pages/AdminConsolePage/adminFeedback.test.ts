import { describe, expect, it } from "vitest";
import type { ApiError } from "@/apis";
import { getManagedUserCreateError } from "./adminFeedback";

describe("getManagedUserCreateError", () => {
  it("shows the backend domain message to the administrator", () => {
    const error: ApiError = {
      code: 409,
      message: "Request failed with status code 409",
      details: {
        code: "USER_EMAIL_EXISTS",
        message: "An account already uses this email.",
      },
    };

    expect(getManagedUserCreateError(error)).toBe(
      "Managed user was not created. An account already uses this email. The email or generated username may already belong to an existing identity.",
    );
  });

  it("uses the shared calm fallback when no domain message is available", () => {
    expect(
      getManagedUserCreateError({
        code: 503,
        message: "Request failed with status code 503",
      }),
    ).toBe("Managed user was not created. The server rejected the request without an explanation.");
  });
});
