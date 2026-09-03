import type {AdvisorActionTaskTarget} from './advisorWorkspace';
import type {SessionDayOfWeek, SessionType} from './course';
/** Advising contracts from docs/api/advising.openapi.yaml. */

export type StudentType = 'VIP' | 'STANDARD';
export type IntakeLifecycleStatus = 'OPEN' | 'CANCELLED';
export type IntakeAssignmentStatus = 'UNASSIGNED' | 'ASSIGNED';
export type AdvisorCandidateLevel = 'ADVISOR' | 'INSTRUCTOR_ADVISOR';
export type StudyPlanRevisionAction = 'STUDY_PLAN_CREATED' | 'STUDY_PLAN_UPDATED';

export interface AdvisingPage<T> {
  page: number;
  size: number;
  total: number;
  items: T[];
}

export interface CreateStudentIntakeRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  studentType: StudentType;
  courseRequest: string;
  contactPhone?: string;
  basicBackground?: string;
}

export interface PatchStudentIntakeRequest {
  expectedIntakeVersion: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  studentType?: StudentType;
  courseRequest?: string;
  contactPhone?: string;
  basicBackground?: string;
}

export interface AssignAdvisorRequest {
  advisorUserId: number;
  expectedIntakeVersion: number;
}

export interface ReassignAdvisorRequest {
  advisorUserId: number;
  expectedAssignmentVersion: number;
  reason?: string;
}

export interface CancelStudentIntakeRequest {
  expectedIntakeVersion: number;
  reason: string;
}

export interface StudentIntakeResponse {
  intakeId: number;
  studentUserId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  studentType?: StudentType;
  courseRequest?: string;
  contactPhone?: string;
  basicBackground?: string;
  lifecycleStatus: IntakeLifecycleStatus;
  assignmentStatus: IntakeAssignmentStatus;
  intakeVersion: number;
  activationMethod?: 'PASSWORD_RESET';
  advisorUserId?: number;
  assignmentVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdvisorCandidateResponse {
  advisorUserId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  level: AdvisorCandidateLevel;
}

export interface CounsellorDashboardResponse {
  createdCount: number;
  assignedCount: number;
  unassignedCount: number;
}

export interface AdvisorStudentSummaryResponse {
  studentUserId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  studentType: StudentType;
  assignmentVersion: number;
  targetGoal?: string;
  riskStatus?: string;
  riskReasons?: string[];
  lastActivityAt?: string;
  highestPriority?: string;
}

export interface TenantIntakeListParams {
  page?: number;
  size?: number;
  lifecycleStatus?: IntakeLifecycleStatus;
  assignmentStatus?: IntakeAssignmentStatus;
  advisorUserId?: number;
  q?: string;
  intakeId?: number;
  studentUserId?: number;
}

export interface ProfileSkillRequest {
  skillCode: string;
  displayName: string;
  scale: string;
  currentValue?: string;
  targetValue?: string;
  gapSummary?: string;
  position: number;
}

export interface ProfileSkillResponse {
  skillCode?: string;
  displayName?: string;
  scale?: string;
  currentValue?: string;
  targetValue?: string;
  gapSummary?: string;
  position?: number;
}

export interface AcademicPerformanceSummaryResponse {
  releasedAssignmentCount?: number;
  releasedScoreAverage?: number;
  presentCount?: number;
  absentCount?: number;
  approvedAbsenceCount?: number;
  unapprovedAbsenceCount?: number;
  completedSessionCount?: number;
  completedAdvisorTaskCount?: number;
  reachedIncompleteCheckpointCount?: number;
  publishedReportCount?: number;
  activityHistory?: unknown[];
}

export interface CreateStudentProfileRequest {
  contactPhone?: string;
  academicBackground?: string;
  priorTestExperience?: string;
  baselineAssessment?: string;
  targetGoal?: string;
  targetMetric?: string;
  targetValue?: string;
  targetDate?: string;
  advisorInterpretation?: string;
  advisorPrivateNotes?: string;
  skills?: ProfileSkillRequest[];
}

export interface UpdateStudentProfileRequest extends CreateStudentProfileRequest {
  expectedProfileVersion: number;
  skills: ProfileSkillRequest[];
}

export interface AdvisorStudentProfileResponse {
  profileId: number;
  studentUserId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  studentType?: StudentType;
  advisorUserId?: number;
  contactPhone?: string;
  academicBackground?: string;
  priorTestExperience?: string;
  baselineAssessment?: string;
  targetGoal?: string;
  targetMetric?: string;
  targetValue?: string;
  targetDate?: string;
  advisorInterpretation?: string;
  advisorPrivateNotes?: string;
  skills?: ProfileSkillResponse[];
  performanceSummary?: AcademicPerformanceSummaryResponse;
  profileVersion: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Student and tenant reads omit advisorPrivateNotes. */
export interface StudentFacingProfileResponse {
  profileId: number;
  studentUserId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  studentType?: StudentType;
  contactPhone?: string;
  academicBackground?: string;
  priorTestExperience?: string;
  baselineAssessment?: string;
  targetGoal?: string;
  targetMetric?: string;
  targetValue?: string;
  targetDate?: string;
  advisorInterpretation?: string;
  enrollmentStatus?: string;
  assignedAdvisorUserId?: number;
  assignedAdvisorFirstName?: string;
  assignedAdvisorMiddleName?: string;
  assignedAdvisorLastName?: string;
  skills?: ProfileSkillResponse[];
  performanceSummary?: AcademicPerformanceSummaryResponse;
  profileVersion: number;
}

export interface TenantStudentProfileResponse extends StudentFacingProfileResponse {
  advisorUserId?: number;
}

export interface AdvisorTaskRequest {
  id?: number;
  title: string;
  description?: string;
  dueDate?: string;
  submissionRequirement?: string;
  position: number;
}

export interface CheckpointRequest {
  id?: number;
  description: string;
  goal: string;
  dueDate: string;
  position: number;
  tasks?: AdvisorTaskRequest[];
}

export interface CreateStudyPlanRequest {
  expectedProfileVersion: number;
  strategySummary: string;
  startDate: string;
  planEndDate: string;
  checkpoints: CheckpointRequest[];
}

export interface UpdateStudyPlanRequest extends CreateStudyPlanRequest {
  expectedStudyPlanVersion: number;
}

export interface AdvisorTaskResponse {
  id?: number;
  title?: string;
  description?: string;
  dueDate?: string;
  submissionRequirement?: string;
  position?: number;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  submissionText?: string;
  submissionFileObjectKey?: string;
  advisorFeedback?: string;
  version?: number;
}

export interface CompleteAdvisorTaskRequest {
  expectedVersion: number;
  submissionText?: string;
  fileObjectKey?: string;
}

export interface AdvisorTaskFeedbackRequest {
  expectedVersion?: number;
  feedback?: string;
}

export interface CheckpointResponse {
  id?: number;
  description?: string;
  goal?: string;
  dueDate?: string;
  position?: number;
  tasks?: AdvisorTaskResponse[];
}

export interface StudyPlanProfileContext {
  targetGoal?: string;
  skills?: ProfileSkillResponse[];
  currentProfileVersion?: number;
}

export interface StudyPlanAggregate {
  studyPlanId?: number;
  strategySummary?: string;
  startDate?: string;
  planEndDate?: string;
  checkpoints?: CheckpointResponse[];
  studyPlanVersion?: number;
  basedOnProfileVersion?: number;
  profileChangedSincePlanUpdate?: boolean;
}

export interface AdvisorStudyPlanResponse {
  studentUserId: number;
  profileContext: StudyPlanProfileContext;
  plan: StudyPlanAggregate;
}

export type StudentFacingStudyPlanResponse = AdvisorStudyPlanResponse;
export type TenantStudyPlanResponse = AdvisorStudyPlanResponse;

export interface StudyPlanRevisionResponse {
  entityVersion?: number;
  action?: StudyPlanRevisionAction;
  snapshot?: Record<string, unknown>;
  createdAt?: string;
  actorId?: number;
}

export interface LaunchTransitionRequest {
  expectedCourseLaunchVersion?: number;
}

export interface ReconfirmCourseLinkRequest {
  expectedCourseLinkVersion?: number;
  expectedStudyPlanVersion?: number;
}

export interface CourseReadinessBlocker {
  code?: string;
  message?: string;
}

export interface CourseDeliveryConfigResponse {
  courseId?: number;
  deliveryMode?: string;
  capacity?: number;
  catalogCode?: string;
  launchState?: string;
  courseLaunchVersion?: number;
  blockers?: CourseReadinessBlocker[];
}

export interface PutCourseDeliveryConfigRequest {
  catalogCode?: string;
  capacity?: number;
  expectedCourseLaunchVersion?: number;
}

export interface StudyPlanCourseLink {
  courseLinkVersion?: number;
  basedOnStudyPlanVersion?: number;
  alignmentNotes?: string;
  status?: string;
  planChangedSinceCourseLink?: boolean;
}

export interface LinkGroupCourseRequest {
  courseId?: number;
  expectedStudyPlanVersion?: number;
  alignmentNotes?: string;
}

export interface WithdrawGroupCourseRequest {
  expectedCourseLinkVersion?: number;
  reason?: string;
}

export interface CompleteStudentCourseRequest {
  expectedCompletionVersion?: number;
}

export interface AdvisingSessionRequest {
  type: SessionType;
  dayOfWeek: SessionDayOfWeek;
  startTime: string;
  endTime: string;
  location: string;
}

export interface CreateOneOnOneCourseRequest {
  primaryInstructorUserId?: number;
  expectedStudyPlanVersion?: number;
  courseCode?: string;
  title?: string;
  termStartDate?: string;
  termEndDate?: string;
  description?: string;
  location?: string;
  alignmentNotes?: string;
  sessions?: AdvisingSessionRequest[];
}

export interface ReassignOneOnOneInstructorRequest {
  primaryInstructorUserId?: number;
  expectedCourseLaunchVersion?: number;
}

export interface ReplaceOneOnOneSessionsRequest {
  expectedCourseLaunchVersion?: number;
  sessions?: AdvisingSessionRequest[];
}

export interface GroupCourseSchedulePreviewResponse {
  sessionId?: number;
  type?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

export interface AdvisorStudentCourseResponse {
  courseId?: number;
  courseCode?: string;
  title?: string;
  catalogCode?: string;
  deliveryMode?: string;
  launchState?: string;
  status?: string;
  courseLinkVersion?: number;
  basedOnStudyPlanVersion?: number;
  planChangedSinceCourseLink?: boolean;
  alignmentNotes?: string;
  courseLaunchVersion?: number;
  instructorUserId?: number;
  instructorFirstName?: string;
  instructorMiddleName?: string;
  instructorLastName?: string;
  lifecycleStatus?: string;
  lectureTotal?: number;
  lectureCompleted?: number;
  completionVersion?: number;
  completedAt?: string;
  schedule?: GroupCourseSchedulePreviewResponse[];
  instructors?: GroupCourseInstructorPreviewResponse[];
}

export interface GroupCourseInstructorPreviewResponse {
  userId?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

export interface GroupCourseOptionResponse {
  courseId?: number;
  courseCode?: string;
  title?: string;
  catalogCode?: string;
  capacity?: number;
  activeStudents?: number;
  remainingCapacity?: number;
}

export interface InstructorStudentProfileContextResponse {
  studentUserId?: number;
  targetGoal?: string;
  skills?: ProfileSkillResponse[];
  strategySummary?: string;
  startDate?: string;
  planEndDate?: string;
  checkpoints?: unknown[];
  profileVersion?: number;
  studyPlanVersion?: number;
  basedOnProfileVersion?: number;
  profileChangedSincePlanUpdate?: boolean;
  courseLinkVersion?: number;
  basedOnStudyPlanVersion?: number;
  planChangedSinceCourseLink?: boolean;
  alignmentNotes?: string;
  academicBackground?: string;
  performanceSummary?: unknown;
}

export interface AdvisorActionTaskResponse {
  target?: AdvisorActionTaskTarget | null;
  taskId?: number;
  studentUserId?: number;
  taskType?: string;
  category?: string;
  description?: string;
  priority?: string;
  status?: string;
  version?: number;
  sourceType?: string;
  sourceId?: number;
  sourceReference?: string;
  createdAt?: string;
  startedAt?: string;
  resolvedAt?: string;
}

export interface ActionTaskMutationRequest {
  expectedVersion?: number;
  resolutionNote?: string;
}

export interface AdvisorConversationAttachmentResponse {
  attachmentId?: number;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
  previewAvailable?: boolean;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface AdvisorConversationMessageResponse {
  messageId?: number;
  senderUserId?: number;
  body?: string;
  createdAt?: string;
  attachments?: AdvisorConversationAttachmentResponse[];
}

export interface SendAdvisorMessageRequest {
  clientMessageId: string;
  body?: string;
  fileObjectKey?: string;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface SendAdvisorMessageMultipartRequest {
  clientMessageId: string;
  body?: string;
  files?: File[];
}

export interface MarkConversationReadRequest {
  messageId?: number;
}

/** New dashboard, hub and conversation-list responses lack response schemas. */
export type AdvisingOpenApiRead = unknown;

export const ADVISING_ERROR_CODES = {
  featureDisabled: 'ADVISING_FEATURE_DISABLED',
  idempotencyMismatch: 'IDEMPOTENCY_KEY_MISMATCH',
  userAlreadyExists: 'USER_ALREADY_EXISTS',
  intakeNotFound: 'STUDENT_INTAKE_NOT_FOUND',
  intakeVersionConflict: 'STUDENT_INTAKE_VERSION_CONFLICT',
  alreadyAssigned: 'STUDENT_ALREADY_ASSIGNED',
  advisorNotEligible: 'ADVISOR_NOT_ELIGIBLE',
  intakeNotCancellable: 'STUDENT_INTAKE_NOT_CANCELLABLE',
  assignmentVersionConflict: 'ADVISOR_ASSIGNMENT_VERSION_CONFLICT',
  profileAlreadyExists: 'STUDENT_PROFILE_ALREADY_EXISTS',
  profileRequired: 'STUDENT_PROFILE_REQUIRED',
  profileNotFound: 'STUDENT_PROFILE_NOT_FOUND',
  profileVersionConflict: 'STUDENT_PROFILE_VERSION_CONFLICT',
  intakeRequired: 'STUDENT_INTAKE_REQUIRED',
  studyPlanAlreadyExists: 'STUDY_PLAN_ALREADY_EXISTS',
  studyPlanNotFound: 'STUDY_PLAN_NOT_FOUND',
  studyPlanVersionConflict: 'STUDY_PLAN_VERSION_CONFLICT',
  studyPlanInvalidTimeline: 'STUDY_PLAN_INVALID_TIMELINE',
  studyPlanChildInvalid: 'STUDY_PLAN_CHILD_INVALID',
} as const;
