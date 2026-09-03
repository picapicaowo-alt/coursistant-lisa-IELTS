import React from "react";

export type ScreenSize = 'small' | 'medium' | 'large';

export interface ScreenSizeInfo {
  isLarge: boolean;
  isMedium: boolean;
  isSmall: boolean;
  size: ScreenSize;
}

export interface GridConstraints {
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

export interface WidgetConfig {
  key: string;
  component: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
}

export interface LayoutOptions {
  screenSize: ScreenSizeInfo;
  containerWidth: number;
}

/**
 * A course as the My Course widget renders it, mapped from `MyCourse`.
 *
 * The Figma card also shows "8 WEEKS · 95 SKILLS" under the title, but neither
 * week count nor skill count exists in any dashboard endpoint, so there is
 * nothing to populate it with. Showing a made-up number would be a false state
 * (PRIN-03); the card falls back to the course code until an API provides it.
 */
export interface DashboardCourse {
  lectureTotal?: number | null;
  lectureCompleted?: number | null;
  id: number;
  courseCode: string;
  title: string;
  /** Null when the payload carried only `userId` for the instructor. */
  instructorName: string | null;
  instructorAvatar: string;
  courseRole: 'Student' | 'TA' | 'Instructor';
}

export type WidgetId = 'chat' | 'course' | 'assignments' | 'learning-schedule' | 'posts' | 'average-score' | 'instructor-work';

export interface WidgetLayoutConfig {
  default: { w: number; h: number };
  small?: { w: number; h: number };
  medium?: { w: number; h: number };
  large?: { w: number; h: number };
  constraints?: GridConstraints;
  id: WidgetId;
  defaultPosition?: { x: number; y: number };
}

export interface OccupiedSpace {
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  bottom: number;
}
