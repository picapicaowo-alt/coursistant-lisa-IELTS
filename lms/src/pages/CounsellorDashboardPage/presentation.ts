import {generatePath} from 'react-router-dom';
import type {AdvisorCandidateLevel, IntakeAssignmentStatus, StudentType} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {VIP: 'VIP', STANDARD: 'Standard'};
export const ASSIGNMENT_LABELS: Record<IntakeAssignmentStatus, string> = {UNASSIGNED: 'Unassigned', ASSIGNED: 'Assigned'};
export const ADVISOR_LEVEL_LABELS: Record<AdvisorCandidateLevel, string> = {ADVISOR: 'Advisor', INSTRUCTOR_ADVISOR: 'Instructor · Advisor'};

export const intakePath = (intakeId: number) => generatePath(APP_ROUTE_PATHS.counsellorIntakesIntakeId, {intakeId: String(intakeId)});
export const assignmentPath = (intakeId: number) => generatePath(APP_ROUTE_PATHS.counsellorIntakesIntakeIdAssign, {intakeId: String(intakeId)});
