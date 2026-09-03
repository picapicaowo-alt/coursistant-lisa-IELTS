/** Zero-based queues introduced by the September compatibility contract. */
export const OPERATION_QUEUE_PAGE_SIZE = 20;
export const WORK_QUEUE_MAX_OFFSET = 10_000;
export const GRADING_QUEUE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const SCHEDULE_REQUEST_STATUSES = ['PENDING_INSTRUCTOR', 'PENDING_ADVISOR', 'APPROVED', 'REJECTED'] as const;
export const COURSE_REPORT_TYPES = ['MID_TERM', 'FINAL'] as const;
export const STUDENT_MOCK_EXAM_STATUSES = ['READY', 'IN_PROGRESS', 'PENDING_WRITING_GRADING', 'COMPLETED'] as const;
