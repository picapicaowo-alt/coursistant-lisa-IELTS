import { describe, expect, it } from "vitest";
import type { ApiError } from "@/apis";
import { getManagedUserCreateError } from "./adminFeedback";
import i18n from '@/i18n';

describe("getManagedUserCreateError", () => {
  it("preserves conflict guidance without displaying an untranslated server message", () => {
    const error: ApiError = {
      code: 409,
      message: "Request failed with status code 409",
      details: {
        code: "USER_EMAIL_EXISTS",
        message: "An account already uses this email.",
      },
    };

    expect(getManagedUserCreateError(error)).toBe(
      i18n.t('common:admin.createRejected', {detail: i18n.t('common:admin.createFallback'), guidance: i18n.t('common:admin.createConflict')}),
    );
  });

  it("uses contextual guidance for a transport failure", () => {
    expect(
      getManagedUserCreateError({
        code: 503,
        message: "Request failed with status code 503",
      }),
    ).toBe(i18n.t('common:admin.createRejected', {detail: i18n.t('common:admin.createFallback'), guidance: ''}));
  });
});
