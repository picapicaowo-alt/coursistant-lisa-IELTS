import type { UserLevel } from "@/apis";
export type ManagedLevel = Exclude<UserLevel, "NOT_APPLICABLE">;
export const SYSTEM_MANAGED_LEVEL_OPTIONS: ManagedLevel[] = [
  "STUDENT",
  "PARENT",
  "INSTRUCTOR",
  "COUNSELLOR",
  "ADVISOR",
  "INSTRUCTOR_ADVISOR",
];
