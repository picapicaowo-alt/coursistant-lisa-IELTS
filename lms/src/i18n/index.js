import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import translation files
import enCommon from "./resources/en/common.json";
import enAuth from "./resources/en/auth.json";
import enCourse from "./resources/en/course.json";
import enDetailWorkspace from "./resources/en/detailWorkspace.json";

import zhCommon from "./resources/zh-CN/common.json";
import zhAuth from "./resources/zh-CN/auth.json";
import zhCourse from "./resources/zh-CN/course.json";
import zhDetailWorkspace from "./resources/zh-CN/detailWorkspace.json";

// Chinese resources stay in the repository for the eventual full translation,
// but the product currently exposes English only. A partial language mode is
// more confusing than useful because large parts of the LMS are still English.
export const SUPPORTED_LOCALES = ["en"];
export const DEFAULT_LOCALE = "en";
export const LANGUAGE_SWITCHER_ENABLED = false;

// Language labels for UI display
export const LOCALE_LABELS = {
  en: "English",
  "zh-CN": "简体中文",
};

i18n
  .use(initReactI18next) // Passes i18n to react-i18next
  .init({
    resources: {
      en: { 
        common: enCommon,
        auth: enAuth,
        course: enCourse,
        detailWorkspace: enDetailWorkspace
      },
      "zh-CN": {
         common: zhCommon,
         auth: zhAuth,
         course: zhCourse,
         detailWorkspace: zhDetailWorkspace
        },
    },
    lng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    fallbackLng: "en", // Fallback to English if translation missing

    defaultNS: "common", // Default namespace
    ns: ["common", "auth", "course", "detailWorkspace"], // Available namespaces

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    react: {
      useSuspense: false, // Disable suspense to avoid loading states
    },
  });

export default i18n;
