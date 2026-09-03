export interface FileResponse {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  entityId: number;
  entityType: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
}

export interface AssignmentSettings {
  allowLateSubmission: boolean;
  allowedResubmissionCount: number;
}

export interface AssignmentForEditResponse {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string;
  type: string;
  dueTime: Date;
  settings: AssignmentSettings;
  attachments: FileResponse[];
}

export interface EditAssignmentRequest {
  title?: string;
  description?: string;
  type?: string;
  dueTime?: Date;
  settings?: AssignmentSettings;
}

export interface SubmissionResponse {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  assignmentId: number;
  submissionCount: number;
  submissionContent: string;
  files: FileResponse[];
}

export interface AssignmentForSubmissionResponse {
  assignment: AssignmentForEditResponse;
  submission?: SubmissionResponse;
  review?: Review
}

export interface AssignmentSubmissionRequest {
  submissionContent?: string;
}

export interface Assignment {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string;
  type: string;
  dueTime: Date;
  settings: AssignmentSettings;
}

export interface Submission {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  assignmentId: number;
  studentName: string;
  submissionCount: number;
  submissionContent: string;
}

export interface Review {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  submissionId: number;
  grade: number;
  teacherComment: string;
}

export interface AssignmentForReviewResponse {
  assignment: Assignment;
  submissions: Submission[];
  reviews: Review[];
  files: FileResponse[];
}

export interface CreateSubmissionReviewRequest {
  grade?: number;
  teacherComment?: string;
}

export interface UpdateSubmissionReviewRequest {
  grade?: number;
  teacherComment?: string;
}
/**
 * A list card for an assignment —
 * `GET /v2/courses/{courseId}/assignments/summaries`.
 *
 * Any course member can call it. Students receive Published assignments only
 * and see their own `submissionStatus`; staff see drafts too and get no
 * status, since there is no single caller status to report.
 *
 * The consumed contract also describes Lecture context and learning category.
 * Keep optional named fields when returned; the generic response schema does
 * not yet define a safe shape for projecting the Lecture context.
 */
export interface AssignmentSummary {
  /** Optional category described by assignmentListSummaries. */
  learningType?: string;
  studentListGroup?: string;
  id: number;
  title: string;
  /** UTC instant. */
  dueAtUtc: string;
  /** The same instant as tenant wall-clock time. Display only. */
  dueAtLocal: string;
  timezone: string;
  submissionType: 'Individual' | 'Group';
  /** Student callers only; omitted for staff. */
  submissionStatus?: 'NotSubmitted' | 'Submitted' | 'SubmittedLate' | 'NotSubmittedClosed';
}

export type AssignmentState = 'Draft' | 'Published' | 'Unpublished' | string;
export type AssignmentSubmissionType = 'Individual' | 'Group';

export interface AssignmentAttachment {
  id: number;
  assignmentId: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: number;
  downloadUrl: string;
  previewUrl?: string;
  previewAvailable?: boolean;
  createdAt: string;
}

export interface AssignmentAttachmentManifestItem {
  assignmentId?: number;
  assignmentState?: string;
  attachmentId?: number;
  contentType?: string;
  createdAt?: string;
  originalName?: string;
  sizeBytes?: number;
}

/** The full role-shaped assignment list has no data schema in the supplied YAML. */
export type AssignmentListRead = unknown;

export interface AssignmentDetail {
  id: number;
  courseId: number;
  weekId?: number;
  learningType?: AssignmentLearningType;
  title: string;
  description: string;
  pointsPossible?: number;
  dueAtUtc: string;
  dueAtLocal: string;
  lateUntilUtc?: string;
  lateUntilLocal?: string;
  timezone: string;
  submissionType: AssignmentSubmissionType;
  groupSetId?: number;
  allowedFileTypes?: string[];
  maxFileSizeBytes?: number;
  maxFileCount?: number;
  state: AssignmentState;
  attachments: AssignmentAttachment[];
  version?: number;
  createdAt: string;
  updatedAt: string;

  // Staff-only fields.
  activeStudentCount?: number;
  submissionCount?: number;
  gradedCount?: number;
  releasedCount?: number;
  canEditStructure?: boolean;

  // Student-only fields.
  submissionStatus?: string;
  submissionEligibility?: string;
  submittedAt?: string;
  versionNo?: number;
  windowOpen?: boolean;
  acceptingSubmissions?: boolean;
  stagedFileCount?: number;
  gradeReleased?: boolean;
  score?: number;
  gradeDisplay?: string;
  feedback?: string;
}

export interface StagingFile {
  id: number;
  assignmentId: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  expiresAt: string;
}

export interface SubmissionFile {
  id: number;
  submissionVersionId: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  sortOrder: number;
  previewAvailable: boolean;
  downloadUrl: string;
  previewUrl?: string;
  createdAt: string;
}

export interface SubmissionVersion {
  id: number;
  submissionId: number;
  assignmentId: number;
  ownerUserId: number;
  versionNo: number;
  submittedAt: string;
  usedGraceBuffer: boolean;
  submissionStatus: string;
  fileCount: number;
  receiptIssuedAt?: string;
  files: SubmissionFile[];
}

export interface SubmissionState {
  submissionId?: number;
  assignmentId: number;
  ownerUserId: number;
  groupId?: number;
  groupName?: string;
  submissionEligibility?: string;
  submissionStatus: string;
  dueAtUtc: string;
  lateUntilUtc?: string;
  dueAtLocal: string;
  lateUntilLocal?: string;
  timezone: string;
  windowOpen: boolean;
  acceptingSubmissions: boolean;
  graceWindowActive: boolean;
  submitFrozen: boolean;
  maxFileCount?: number;
  maxFileSizeBytes?: number;
  allowedFileTypes?: string[];
  totalVersions: number;
  currentVersion?: SubmissionVersion;
  deadlineOutcome?: string;
  usedGraceBuffer?: boolean;
  stagingFiles: StagingFile[];
}

export const ASSIGNMENT_LEARNING_TYPES = ['PRE_CLASS', 'HOMEWORK', 'PRACTICE'] as const;
export type AssignmentLearningType = typeof ASSIGNMENT_LEARNING_TYPES[number];

export interface CreateAssignmentPayload {
  weekId: number;
  learningType: AssignmentLearningType;
  title: string;
  description?: string;
  pointsPossible?: number;
  /** Course-local wall-clock time with no `Z`, offset, or fractional seconds. */
  dueAt: string;
  /** Course-local wall-clock time with no `Z`, offset, or fractional seconds. */
  lateUntil?: string;
  allowedFileTypes?: string[];
  maxFileSizeBytes?: number;
  maxFileCount?: number;
  submissionType?: AssignmentSubmissionType;
  groupSetId?: number;
}

export type PatchAssignmentPayload = Partial<CreateAssignmentPayload> & {
  expectedVersion: number;
  clearLateUntil?: boolean;
  confirmShortenDueDate?: boolean;
};

export interface DueDateChangePreview {
  /** Course-local wall-clock values; do not parse them as UTC instants. */
  currentDueAt: string;
  currentLateUntil?: string;
  newDueAt: string;
  newLateUntil?: string;
  timezone: string;
  shortening: boolean;
  confirmationRequired: boolean;
  activeStudentCount: number;
  submittedCount: number;
  notSubmittedCount: number;
  submissionsBecomingLateCount: number;
  gradedCount: number;
}

export interface RubricState {
  posted: boolean;
  assignmentId?: number;
  versionId?: number;
  versionNo?: number;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedBy?: number;
  uploadedAt?: string;
  totalVersions?: number;
  canRestorePrevious?: boolean;
  downloadUrl?: string;
  previewUrl?: string;
  gradedAgainstPreviousRubricCount?: number;
}

export interface SubmitAssignmentPayload {
  /** Omit to submit every active staging file. */
  stagingFileIds?: number[];
}

export type GradeStatus = 'Ungraded' | 'Entered' | 'Released' | string;

export interface GradingRosterItem {
  studentUserId?: number;
  studentName?: string;
  studentEmail?: string;
  groupId?: number;
  groupName?: string;
  memberCount?: number;
  actualSubmitterUserId?: number;
  submissionStatus: string;
  submissionId?: number;
  submissionVersionId?: number;
  versionNo?: number;
  submittedAt?: string;
  usedGraceBuffer?: boolean;
  fileCount?: number;
  gradeStatus: GradeStatus;
  score?: number;
  releasedAt?: string;
  hasAnnotatedFile?: boolean;
}

export interface GradingRoster {
  assignmentId: number;
  assignmentTitle: string;
  pointsPossible?: number;
  dueAtUtc: string;
  lateUntilUtc?: string;
  dueAtLocal: string;
  lateUntilLocal?: string;
  timezone: string;
  totalStudents: number;
  submittedCount: number;
  lateCount: number;
  notSubmittedCount: number;
  ungradedCount: number;
  enteredCount: number;
  releasedCount: number;
  gradingWritable: boolean;
  gradingWritableUntil?: string;
  items: GradingRosterItem[];
}

export interface UpsertGradePayload {
  score: number;
  feedbackHtml?: string;
  submissionVersionId?: number;
  rubricVersionId?: number;
  aiAssisted?: boolean;
  aiProvenanceJson?: string;
}

export interface GradeRecord {
  id: number;
  assignmentId: number;
  studentUserId?: number;
  groupId?: number;
  submissionVersionId?: number;
  rubricVersionId?: number;
  score: number;
  pointsPossible?: number;
  feedbackHtml?: string;
  status: GradeStatus;
  hasAnnotatedFile?: boolean;
  annotatedOriginalName?: string;
  annotatedContentType?: string;
  annotatedSizeBytes?: number;
  annotatedFileUrl?: string;
  enteredBy?: number;
  enteredAt?: string;
  editedBy?: number;
  updatedAt?: string;
  releasedAt?: string;
  aiAssisted?: boolean;
}

export interface GradeSelectionPayload {
  studentUserIds?: number[];
  groupIds?: number[];
}

/**
 * GET .../students/{id}/grading and .../groups/{id}/grading.
 * Roster rows do not include feedbackHtml; this view is the source for prefill.
 */
export interface GradingView {
  assignmentId: number;
  assignmentTitle?: string;
  student?: GradingRosterItem;
  currentVersion?: SubmissionVersion;
  versions?: SubmissionVersion[];
  rubric?: RubricState;
  grade?: GradeRecord;
  gradingWritable?: boolean;
  prevStudentId?: number;
  nextStudentId?: number;
}

/** A student's assignment result from GET /v2/courses/{courseId}/my-grades. */
export interface MyGradeItem {
  assignmentId: number;
  assignmentTitle?: string;
  title?: string;
  itemType?: string;
  pointsPossible?: number;
  dueAtUtc: string;
  dueAtLocal?: string;
  timezone?: string;
  submissionStatus?: string;
  submittedAt?: string;
  versionNo?: number;
  released: boolean;
  gradeDisplay?: string;
  score?: number;
  pointsEarned?: number;
  feedbackHtml?: string;
  hasFeedback?: boolean;
  releasedAt?: string;
  hasAnnotatedFile?: boolean;
  annotatedOriginalName?: string;
  annotatedFileUrl?: string;
}
