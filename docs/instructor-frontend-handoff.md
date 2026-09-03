# Instructor 前端联调说明

权威合同：`docs/api/course.openapi.yaml`、`assignment.openapi.yaml`、`quiz.openapi.yaml`、`mockexam.openapi.yaml`。不要另建 `instructor.openapi.yaml`。

本分支前端快照：`docs/api/feature-registration/`（快照不是第二事实来源）。

Advisor 发布 configured course 的走查：`docs/advising-frontend-walkthrough.md`。

Instructor 已交付业务流 A–G 的本地 API 走查：`docs/instructor-api-walkthrough.md`。

## 环境

| 项 | 值 |
|---|---|
| Local base | `http://localhost:8080/api` |
| 健康检查 | `GET {base}/v1` → 200 |
| 登录 | `POST {base}/v1/auth/login`，`role=USER` |
| Milestone I | configured-course 运营 fence 始终生效 |
| Notification email | `lms.notification.email.enabled`（xLearn 默认 false，仅 IN_APP） |

账号密码向后端负责人索取，不要写进前端仓库。

身份：`role=USER` + `level=INSTRUCTOR` 或 `INSTRUCTOR_ADVISOR`。不存在独立 Teacher/Manager 身份。

Teaching / Collaboration / Schedule 写入部署后默认可用。Instructor 调用最终排课写入口仍 `403 ACCESS_DENIED`。Assignment / Quiz 现有写入不受影响。

## 本轮可联调

1. **Foundation**：Advisor READY/PUBLISH configured Group 或 1-on-1 → Instructor Dashboard / My Classes → Student context → Week/Material → Assignment / course-bound Quiz
2. **Teaching Operations**：Assignment `weekId`、日期课次 generate/create/reschedule/cancel（**仅 owner Advisor**）、Attendance（Instructor）
3. **Collaboration & Reports**：课程讨论一层回复、Draft/Published Course Report
4. **Availability**：本人 weekly windows；Advisor 只读已有 workflow 的 Instructor；**没有** Tenant Admin Availability 路径
5. **Schedule Request**：Student 创建；Instructor 只审核 `SCHEDULE_CHANGE + PENDING_INSTRUCTOR`；ABSENCE 直接进 Advisor
6. **Dashboard**：`today-classes`、`activities/upcoming`、`grading-queue`、`grading-items`
7. **Mock Exam Writing**：独立 Tab。`GET/POST /v2/instructor/mock-exams/writing-grades`

**还不能联调：** Global Exam 人工批改（与 Mock Exam 分开，尚未实现）、AI assistant、Announcement/generic Course Event 新流程。Parent 已有独立的 Published Report 只读接口，详见 `docs/parent-frontend-handoff.md`，不属于 Instructor 页面。Quiz 现有 course-bound 批改仍可用，但不在 xLearn Student/Instructor inventory。

xLearn Student/Instructor 暴露边界：`XlearnStudentInstructorInventoryContractTest`。

## 分页基准

| 表面 | 基准 | 默认 | 越界 |
|---|---|---|---|
| `meTeachingGradingItems` | **zero-based** | `page=0,size=20`，`size=1..100` | `page<0`、非法 `size`、或 `page*size` 溢出 int → `400 BAD_REQUEST`；超末页 `200` 空 `items`，保留 `total` |
| `meTeachingScheduleRequests` | **zero-based** | 同上 | 同上 |
| `listInstructorWritingGrades` | **zero-based** | 同上 | 同上 |
| `courseMemberList` | **zero-based** | `page=0,size=20`，size 上限 100 | 非法 size 被夹到 1..100（既有行为） |
| Discussion posts/replies | **1-based** | 省略/`<1` 归一到 1 | 本轮不改 |
| Course Report list | **1-based** | 省略/`0`/负数归一到 1 | 本轮不改 |

三个工作队列是有意的 coordinated cutover：同一路径不再返回裸数组。响应信封：`{page,size,total,items}`。

显式 `courseId` 不属于当前 Instructor 时返回 `200 SUCCESS` 空页，不泄漏 Course 是否存在。

姓名一律 `firstName / middleName / lastName`。

## 接口清单

所有请求带 `Authorization: Bearer {accessToken}`。成功信封：`status` 等于 HTTP status，`code=SUCCESS`。缺/非法 token：`401 INVALID_TOKEN`。

### Dashboard

| 方法 | 路径 | operationId | 页面用途 | 错误 |
|---|---|---|---|---|
| GET | `/v2/me/teaching/courses` | `meTeachingCourses` | **My Classes** | 非 Instructor `403 ACCESS_DENIED` |
| GET | `/v2/me/teaching/today-classes` | `meTeachingTodayClasses` | **今日课程卡片** | 同上 |
| GET | `/v2/me/teaching/activities/upcoming?days=` | `meTeachingActivitiesUpcoming` | **未来日程** | 同上 |
| GET | `/v2/me/teaching/grading-queue` | `meTeachingGradingQueue` | **Assignment/Quiz 聚合卡片**。无 Global Exam、无 Mock Exam Writing | 同上 |
| GET | `/v2/me/teaching/grading-items?page=&size=&courseId=&status=` | `meTeachingGradingItems` | **逐条评分**。Individual 一行一学生；Group 一行一组。`status` 仅 `PENDING/IN_PROGRESS/COMPLETED` | 非法 status/page/size/`page*size` 溢出 `400` |
| GET | `/v2/me/teaching/students-needing-support` | `meTeachingStudentsNeedingSupport` | 租户阈值；未配置则空列表 | 非 Instructor `403 FORBIDDEN` |
| GET | `/v2/me/teaching/alerts` | `meTeachingAlerts` | `PENDING_GRADING` / `UPCOMING_CLASS` / `SCHEDULE_CONFLICT` | `403 ACCESS_DENIED` |
| GET | `/v2/me/teaching/deadlines/upcoming` | `meTeachingDeadlinesUpcoming` | 已有 | 同上 |
| GET | `/v2/me/teaching/activity/recent` | `meTeachingActivityRecent` | 已有 | 同上 |

`grading-items` 排序：urgency → dueAt UTC（null last）→ `assignmentId` → `studentUserId` → `groupId`。响应含 `dueAtUtc` / `dueAtLocal` / `timezone`，不再返回含义不明的 `dueAt`。Individual `gradingDeepLink` 为 `/courses/{courseId}/assignments/{assignmentId}/grading/{studentUserId}`；Group 为 `/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grading`。不要把 Mock Exam Writing 塞进这个 queue。

### Student context

| 方法 | 路径 | operationId |
|---|---|---|
| GET | `/v2/instructor/courses/{courseId}/students/{studentUserId}/profile-context` | `instructorGetStudentProfileContext` |

任一 guard 或 tenant 边界不满足时统一 `404 COURSE_NOT_FOUND`。JSON **没有** `email` / `phone` / `address` / `contactPhone` / `advisorPrivateNotes`。

### 授课内容 / 作业 / Quiz

继续用现有 Course Week / Material / Syllabus、Assignment、Quiz API。Syllabus 仅后端兼容，新 xLearn 前端 Phase 1 不展示。

### 日期课次：Instructor 可调用

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v2/courses/{courseId}/session-occurrences` | 默认不含 `RESCHEDULED` 历史；`includeHistory=true` 可追溯 |
| GET | `.../{occurrenceId}` | 单条 |
| GET/PUT | `.../{occurrenceId}/attendance` | Instructor 填写。首次保存冻结 roster；整批 `attendanceVersion` CAS。状态仅 `PRESENT`/`ABSENT` |
| GET | `.../{occurrenceId}/attendance/me` | Student 只读自己 |
| POST | `.../{occurrenceId}/attendance/roster-sync` | 已打开 roster 后加入后来学生 |

Instructor 页面 **不得** 显示最终排课按钮。

### 日期课次：owner Advisor-only

以下对 Instructor 一律 `403 ACCESS_DENIED`。前端不要画 create / generate / reschedule / cancel。

| 方法 | 路径 | operationId |
|---|---|---|
| POST | `/v2/courses/{courseId}/session-occurrences/generate` | `generateSessionOccurrences` |
| POST | `/v2/courses/{courseId}/session-occurrences` | `createSessionOccurrence` |
| POST | `.../{occurrenceId}/reschedule` | `rescheduleSessionOccurrence` |
| POST | `.../{occurrenceId}/cancel` | `cancelSessionOccurrence` |

均需 `Idempotency-Key`（cancel 除外）。

### Schedule Request

| 方法 | 路径 | operationId | 说明 |
|---|---|---|---|
| POST | `/v2/courses/{courseId}/session-occurrences/{occurrenceId}/schedule-requests` | `createCourseScheduleRequest` | Student。需 `Idempotency-Key` |
| GET | `/v2/me/teaching/schedule-requests?page=&size=&courseId=` | `meTeachingScheduleRequests` | Instructor queue：只含 `SCHEDULE_CHANGE + PENDING_INSTRUCTOR`。item 含 Course/Student/原 occurrence/proposed 时间/`timezone` |
| POST | `/v2/courses/{courseId}/schedule-requests/{requestId}/instructor-review` | `reviewCourseScheduleRequest` | 需 `expectedVersion` CAS。`APPROVE` → `PENDING_ADVISOR`；`REJECT` 需 `rejectionReason`。冲突 `409 SCHEDULE_REQUEST_STATE_CONFLICT` |

ABSENCE 不进 Instructor queue。排序 `createdAt ASC, id ASC`。

### Mock Exam Writing grading

独立 Tab，不要并入 `grading-queue` / `grading-items`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v2/instructor/mock-exams/writing-grades?page=&size=` | 当前 Instructor 的 `PENDING`。list item 含 Student 姓名、Template/Test Version、`submittedAt`。**不含** `tasks` |
| GET | `/v2/instructor/mock-exams/writing-grades/{gradeId}` | 打开单条：同一 Student/Template 上下文 + 完整 `tasks` |
| POST | `/v2/instructor/mock-exams/writing-grades/{gradeId}` | 一次性评分。必填 `Idempotency-Key`。score 0.0–9.0、0.5 step。`201 SUCCESS` |

错误：非 Instructor `403 FORBIDDEN`；他人/跨租户 gradeId `404 MOCK_EXAM_NOT_FOUND`；已评分 `409 MOCK_EXAM_WRITING_ALREADY_GRADED`。分配/重分配后原 Instructor 也是 404 隐藏。本轮无 regrade / 历史列表。

List item 字段：`id`（不要改成 `gradeId`）、`studentMockExamId`、`writingSubmissionId`、`studentUserId`、`studentFirstName/middleName/lastName`、`templateId/templateTitle/templateLabel`、`testVersionId/versionNo`、`status=PENDING`、`submittedAt`。

### 课程讨论

仅该课 **active Instructor / active Student**。分页 **1-based**。无 delete、无嵌套回复。

### Course Report

同一 course + student + `MID_TERM|FINAL` 只有一份。list **1-based**。DRAFT 可 CAS 更新；PUBLISHED 只读。无 delete。

### Availability

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/PUT | `/v2/me/teaching/availability` | 本人 weekly windows。`expectedVersion` CAS |
| GET | `/v2/advisor/instructors/{instructorUserId}/availability` | Advisor 只读；调用者须与该 Instructor 已有 workflow |

**没有** `/v2/tenant/instructors/{instructorUserId}/availability`。不要请求该路径。

整组 replace。同日窗口不可 overlap。无窗口 = 不冲突。有窗口时 session 必须被某一窗口完全覆盖，否则 `409 SCHEDULE_AVAILABILITY_CONFLICT`。

## configured course 边界

Instructor **没有** configured course 运营权。以下 generic API 对存在 `course_delivery_config` 的课返回 `409`：

| 行为 | 错误码 |
|---|---|
| 改 Student membership | `COURSE_ENROLLMENT_ORCHESTRATED` |
| patch / archive / unarchive / delete、改 session template、改 primary instructor | `COURSE_MUTATION_ORCHESTRATED` |

没有 delivery config 的 legacy course 行为不变。资源隐藏 → `404`。无 Instructor 能力 → Teaching Dashboard `403 ACCESS_DENIED`，Mock Exam Writing `403 FORBIDDEN`。

## Lecture 映射

前端把 `CourseWeek` 当作 Lecture。不要等待独立 `LectureController` 或 `lectureId`。`lectureNumber` 在 Dashboard 上是 term start 起算的周序号，不是 week 表主键。

### Calendar / Personal Event / Hours

| 方法 | 路径 | operationId |
|---|---|---|
| GET | `/v2/me/calendar` | `meCalendar` |
| GET/POST | `/v2/me/personal-events` | `listMyPersonalEvents` / `createMyPersonalEvent` |
| GET/PATCH/DELETE | `/v2/me/personal-events/{eventId}` | `getMyPersonalEvent` / `patchMyPersonalEvent` / `deleteMyPersonalEvent` |
| GET | `/v2/me/courses/{courseId}/hours` | `meCourseHours` |

Personal Event 仅 owner 可读写。创建 Personal Event 必须带 `Idempotency-Key`。

xLearn Student/Instructor 批准的 operationId 以 `XlearnStudentInstructorInventoryContractTest` 为准。

## Runtime config

| Flag | 默认 | 控制 |
|---|---|---|
| `lms.notification.email.enabled` | false | xLearn 仅 IN_APP；email 代码保留但默认关 |
