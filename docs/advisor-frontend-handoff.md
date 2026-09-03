# Advisor 前端 API 与业务联调说明

本文面向 xLearn Advisor 前端，说明当前业务、API、权限边界和实际接入缺口。

## 1. 合同与环境

Advisor 功能跨多个权威 OpenAPI，不要只读取 `advising.openapi.yaml`：

| 模块 | 权威合同 |
|---|---|
| Core、Profile、Study Plan、Course orchestration、Dashboard、Action Center、Communication | `docs/api/advising.openapi.yaml` |
| Course、Schedule、Attendance、Hours、Report、Instructor Availability | `docs/api/course.openapi.yaml` |
| Mock Exam | `docs/api/mockexam.openapi.yaml` |
| Parent Link 只读 | `docs/api/parent.openapi.yaml` |
| Notification | `docs/api/notification.openapi.yaml` |
| 登录与 Session | `docs/api/auth.openapi.yaml` |

| 环境 | Base URL |
|---|---|
| Local | `http://localhost:8080/api` |
| Dev | `https://dev.xlearnedu.com:8083/api` |
| 健康检查 | `GET {base}/v1` |

所有业务请求带 `Authorization: Bearer {accessToken}`。Advisor 登录结果必须是 `role=USER`，且 `level=ADVISOR` 或 `INSTRUCTOR_ADVISOR`。不要使用 `MANAGER`、`TEACHER`，也不要把 Advisor 当成 `TENANT_ADMIN`。

## 2. 业务边界与主流程

```text
Dashboard / Action Center
→ 当前分配给自己的 Student
→ Intake
→ Profile
→ Study Plan
→ Group Course 或 1-on-1 Course
→ Schedule / Attendance / Hours / Report
→ Communication 与持续干预
→ Mock Exam
→ 手动将 Student-Course 标记为 COMPLETED
```

- Advisor 只能处理当前分配给自己的 Student，不能领取、首次分配或改派 Student。
- 改派生效后，旧 Advisor 立即得到 `404`；新 Advisor 读取原 Profile、Study Plan 和历史，不复制 aggregate。
- Course 由 owner Advisor 负责。其他 Advisor 可以把自己负责的 Student link 到已发布的 Group Course，但不能管理该 Course。
- `TENANT_ADMIN` 只做账户与治理，不读取或修改 learning progress。
- `advisorPrivateNotes` 只能出现在当前 Advisor 的 Profile 响应，不能展示给 Student、Parent、Instructor 或 `TENANT_ADMIN`。

## 3. 页面和 API

### 3.1 Advisor Home / Action Center

| Method | Path | operationId | 用途 |
|---|---|---|---|
| GET | `/v2/advisor/dashboard` | `advisorGetDashboard` | 学生数、风险分布、待审批、紧急任务 |
| GET | `/v2/advisor/action-tasks` | `advisorListActionTasks` | 任务分页和筛选 |
| GET | `/v2/advisor/action-tasks/{taskId}` | `advisorGetActionTask` | 任务详情 |
| POST | `/v2/advisor/action-tasks/{taskId}/start` | `advisorStartActionTask` | 开始任务 |
| POST | `/v2/advisor/action-tasks/{taskId}/resolve` | `advisorResolveActionTask` | 完成任务 |
| GET | `/v2/me/notifications/unread-count` | `meNotificationUnreadCount` | 顶部未读数 |

Action Task 支持 `status`、`priority`、`type`、`studentType`、`studentUserId`、`page`、`size`。状态为 `PENDING / IN_PROGRESS / RESOLVED`，优先级为 `HIGH / MEDIUM / LOW`。

任务 mutation 提交当前 `version` 和新的 `Idempotency-Key`。遇到 `ACTION_TASK_VERSION_CONFLICT` 时重新 GET，不要在旧 version 上自动重试。

### 3.2 My Students / Student Workspace

| Method | Path | operationId | 用途 |
|---|---|---|---|
| GET | `/v2/advisor/students` | `advisorListStudents` | 当前在管 Student |
| GET | `/v2/advisor/students/{studentUserId}/hub` | `advisorGetStudentHub` | Workspace 顶部聚合 |
| GET | `/v2/advisor/students/{studentUserId}/intake` | `advisorGetStudentIntake` | 招生交接快照 |
| GET | `/v2/advisor/students/{studentUserId}/parent-links` | `advisorListParentLinks` | 当前有效 Parent Links |

队列支持 `page`、`size`、`risk`、`studentType`、`activeTaskType`；`risk` 为 `ON_TRACK / AT_RISK / NEEDS_ATTENTION`。Hub 返回身份摘要、风险、active tasks、active Course 数、Published Report 数和 pending request 数。

点击 Student 后以 Hub 为入口，再按 Tab 延迟加载 Profile、Plan、Course、Report、Conversation。不要长期缓存学生归属；任一子接口因改派返回 `404` 后，立即退出 Workspace 并刷新列表。

### 3.3 Profile 与 Study Plan

| Method | Path | operationId |
|---|---|---|
| POST / GET / PUT | `/v2/advisor/students/{studentUserId}/profile` | `advisorCreateStudentProfile` / `advisorGetStudentProfile` / `advisorUpdateStudentProfile` |
| POST / GET / PUT | `/v2/advisor/students/{studentUserId}/study-plan` | `advisorCreateStudyPlan` / `advisorGetStudyPlan` / `advisorUpdateStudyPlan` |
| GET | `/v2/advisor/students/{studentUserId}/study-plan/revisions` | `advisorListStudyPlanRevisions` |
| POST | `/v2/advisor/students/{studentUserId}/study-plan/tasks/{taskId}/feedback` | `advisorFeedbackAdvisorTask` |

Profile 首次创建返回 `201`、`profileVersion=0`；更新提交 `expectedProfileVersion`。Skills 与 Profile 整棵原子提交。`STUDENT_PROFILE_ALREADY_EXISTS` 时切换到编辑模式；`STUDENT_PROFILE_VERSION_CONFLICT` 时保留输入并重新加载。

Study Plan 必须在 Profile 后创建，保存 `basedOnProfileVersion`。更新同时提交 `expectedStudyPlanVersion` 和 `expectedProfileVersion`。Plan 是包含 strategy、timeline、checkpoints、tasks 的 aggregate，前端一次提交整棵树，不分别保存 child。遇到 Plan/Profile version conflict 必须重新加载。

### 3.4 Student Course 管理

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/advisor/students/{studentUserId}/courses` | `advisorListStudentCourses` |
| GET | `/v2/advisor/students/{studentUserId}/course-options` | `advisorSearchGroupCourseOptions` |
| POST | `/v2/advisor/students/{studentUserId}/courses/group-links` | `advisorLinkGroupCourse` |
| POST | `/v2/advisor/students/{studentUserId}/courses/one-on-one` | `advisorCreateOneOnOneCourse` |
| PUT | `/v2/advisor/students/{studentUserId}/courses/{courseId}/instructor` | `advisorReassignOneOnOneInstructor` |
| PUT | `/v2/advisor/students/{studentUserId}/courses/{courseId}/sessions` | `advisorReplaceOneOnOneSessions` |
| POST | `/v2/advisor/students/{studentUserId}/courses/{courseId}/launch/ready` | `advisorReadyOneOnOneLaunch` |
| POST | `/v2/advisor/students/{studentUserId}/courses/{courseId}/launch/publish` | `advisorPublishOneOnOneLaunch` |
| POST | `/v2/advisor/students/{studentUserId}/courses/{courseId}/reconfirm` | `advisorReconfirmCourseLink` |
| POST | `/v2/advisor/students/{studentUserId}/courses/{courseId}/withdraw` | `advisorWithdrawGroupCourse` |
| POST | `/v2/advisor/students/{studentUserId}/courses/{courseId}/complete` | `advisorCompleteStudentCourse` |

推荐顺序：先 GET Study Plan 取得 `studyPlanVersion`，再选择 Group Course 或填写 1-on-1，mutation 提交 `expectedStudyPlanVersion`，后续只使用响应中的最新 `courseLinkVersion / courseLaunchVersion`。

- Group link 可能返回 `COURSE_CAPACITY_FULL` 或 `STUDY_PLAN_VERSION_CONFLICT`。
- `COMPLETED` 只结束这个 Student 与 Course 的关系，不改变共享 Group Course。
- 完成三个月后由后端进入 `HIDDEN`；前端按响应 lifecycle 展示，不自行覆盖状态。
- 已完成 Course 不允许新的相关 Request、1-on-1 Session mutation 或 withdraw。

### 3.5 Owner Advisor 创建和发布 Group Course

| Method | Path | operationId |
|---|---|---|
| POST | `/v2/courses` | `courseCreate` |
| GET / PATCH | `/v2/courses/{id}` | `courseGetById` / `coursePatch` |
| POST | `/v2/courses/{courseId}/sessions` | `courseSessionCreate` |
| POST | `/v2/courses/{courseId}/session-occurrences/generate` | `generateSessionOccurrences` |
| GET / PUT | `/v2/advisor/courses/{courseId}/delivery-config` | `advisorGetCourseDeliveryConfig` / `advisorPutCourseDeliveryConfig` |
| POST | `/v2/advisor/courses/{courseId}/launch/ready` | `advisorReadyCourseLaunch` |
| POST | `/v2/advisor/courses/{courseId}/launch/publish` | `advisorPublishCourseLaunch` |

Course owner 与 Primary Instructor 是两种责任：Advisor 管理生命周期和 Student 安排；Instructor 负责 Week、Content、Assignment、授课和批改。

READY / PUBLISH 提交当前 `courseLaunchVersion`。`COURSE_NOT_READY` 时展示后端 blocker，让 Advisor 联系 Instructor 补齐 Week / Syllabus 等内容；不能绕过 READY 直接 PUBLISH。

### 3.6 Schedule、Attendance、Hours

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/advisor/instructors/{instructorUserId}/availability` | `advisorGetInstructorAvailability` |
| GET | `/v2/advisor/schedule-requests` | `advisorScheduleRequests` |
| POST | `/v2/advisor/schedule-requests/{requestId}/decision` | `decideAdvisorScheduleRequest` |
| GET | `/v2/advisor/students/{studentUserId}/attendance` | `advisorStudentAttendanceHistory` |
| GET | `/v2/advisor/students/{studentUserId}/courses/{courseId}/session-occurrences/{occurrenceId}/attendance` | `advisorGetStudentAttendance` |
| GET / PUT | `/v2/advisor/students/{studentUserId}/courses/{courseId}/hours` | `advisorGetStudentCourseHours` / `advisorSetStudentCourseHours` |

Schedule Change 是 Instructor review 后由 Advisor decision。Hours PUT 提交当前 version、`reason` 和 `Idempotency-Key`。日期时间按租户时区展示，不要把无 offset 的本地时间直接当成浏览器时区转换。

### 3.7 Published Reports

| Method | Path | operationId | 分页 |
|---|---|---|---|
| GET | `/v2/advisor/students/{studentUserId}/student-reports` | `advisorListStudentPublishedReports` | 0-based |
| GET | `/v2/advisor/students/{studentUserId}/courses/{courseId}/student-reports` | `advisorListPublishedCourseReports` | 1-based |
| GET | `/v2/advisor/students/{studentUserId}/courses/{courseId}/student-reports/{reportId}` | `advisorGetPublishedCourseReport` | — |

Advisor 只读 Instructor 已发布的 immutable snapshot，Draft 不显示。两个列表的 page 起点不同，前端 API adapter 必须分别处理。

### 3.8 Communication

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/advisor/conversations` | `advisorListConversations` |
| GET | `/v2/advisor/students/{studentUserId}/conversation/messages?beforeId=` | `advisorListConversationMessages` |
| POST | `/v2/advisor/students/{studentUserId}/conversation/messages` | `advisorSendConversationMessage` |
| POST | `/v2/advisor/students/{studentUserId}/conversation/read` | `advisorMarkConversationRead` |
| GET | `/v2/advisor/students/{studentUserId}/conversation/attachments/{attachmentId}/preview` | `advisorPreviewConversationAttachment` |
| GET | `/v2/advisor/students/{studentUserId}/conversation/attachments/{attachmentId}/download` | `advisorDownloadConversationAttachment` |

发送支持 JSON 文本或 `multipart/form-data`。生成稳定的 `clientMessageId` 和 `Idempotency-Key`，网络重试沿用原值。消息使用 `beforeId` 向前加载；read cursor 只前进。

附件通过 preview/download API 读取，不把 object key 拼成公开 S3 URL。当前不支持 audio。上传错误时保留用户文本。改派后旧 Advisor 得到 `404 CONVERSATION_NOT_FOUND`，应立即关闭会话。

### 3.9 Mock Exam

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/advisor/mock-exam-templates` | `listAdvisorMockExamTemplates` |
| GET | `/v2/advisor/mock-exam-templates/{templateId}` | `getAdvisorMockExamTemplate` |
| GET / POST | `/v2/advisor/students/{studentUserId}/mock-exams` | `listAdvisorStudentMockExams` / `createAdvisorStudentMockExam` |
| GET | `/v2/advisor/students/{studentUserId}/mock-exams/{studentMockExamId}` | `getAdvisorStudentMockExam` |

`TENANT_ADMIN` 创建和发布 Template；Advisor 从 Published Template 给当前 Student 安排，可选择 Reading、Listening、Writing。选择 Writing 时提交 `writingInstructorUserId`。Instructor 负责 Writing grading，Advisor 读取进度和结果。

本阶段不做 Template 复制后编辑题目，也不在 Advisor 端创建、修改或删除 Template。

### 3.10 Notification

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/me/notifications` | `meNotificationList` |
| GET | `/v2/me/notifications/unread-count` | `meNotificationUnreadCount` |
| PATCH | `/v2/me/notifications/{notificationId}/read` | `meNotificationMarkRead` |
| PATCH | `/v2/me/notifications/read-all` | `meNotificationMarkAllRead` |

只使用 `/v2/me/notifications`，不要调用不存在的 `/v2/notifications`。read / read-all 必须带 `Idempotency-Key`。

## 4. 通用实现规则

- 成功以 HTTP status 和 `code=SUCCESS` 为准；创建接口可能返回 201。
- OpenAPI 要求 `Idempotency-Key` 的 mutation：同一次 timeout 重试沿用原 key；payload 改变后生成新 key；`IDEMPOTENCY_KEY_MISMATCH` 不自动重试。
- Profile、Plan、Course link、Course launch、Hours、Action Task、Completion 各用自己的 version。不要共用通用 version，也不要在前端自行 `+1`。
- `401 INVALID_TOKEN`：清 Session 并回登录页。
- `403 FORBIDDEN / ACCESS_DENIED`：显示无角色能力，不伪装成空数据。
- `404`：可能是不存在、改派或权限围栏；退出详情并刷新上级列表。
- `409 *_VERSION_CONFLICT`：保留输入，重新 GET，再让用户确认。
- `COURSE_CAPACITY_FULL`：刷新 Course options；`SCHEDULE_*_CONFLICT`：保留表单并重选 slot。

## 5. 验收状态

- Gate：`ADVISOR_FULL_LOCAL_API_BUSINESS_PASS`
- 权威轮：`adv-full-local-20260828T234408Z-ba75dc8f`
- 结果：37 PASS / 0 FAIL / 0 BLOCKED / 0 unexplained 5xx
- 覆盖：队列与改派、Profile/Plan、Group/1-on-1、Schedule、Attendance、Hours、Report、Risk/Action Task、Communication。

该 Gate 证明现有 Advisor 本地业务闭环，不等于当前全部工作区改动已重新完成 release verify，也不代替前端联调。

## 6. 实际应用审阅

本轮 `ADVISOR_FRONTEND_USABILITY_IMPLEMENTATION_GATE_PASS` 已关闭下列缺口。前端应以权威合同为准，snapshot 在 `docs/api/feature-registration/`。

### 已关闭：Instructor Directory 与 owner Course list

```http
GET /v2/advisor/instructors?q=zelinsky&page=0&size=20
```

成功 `data` 为 `{page,size,total,items}`。`items[]` 含 `instructorUserId / firstName / middleName / lastName / email / level`，`level` 仅为 `INSTRUCTOR` 或 `INSTRUCTOR_ADVISOR`。选中后再调现有 `GET /v2/advisor/instructors/{instructorUserId}/availability`。

```http
GET /v2/advisor/courses?q=alpha&launchState=DRAFT&lifecycleState=Active&page=0&size=20
```

只返回当前 Advisor 作为 `ownerAdvisorUserId` 的 Course，不按 Primary Instructor 过滤。没有 delivery config 时 `capacity` / `remainingCapacity` / `catalogCode` / `launchState` 可为 null；`activeStudents` 仍是 ACTIVE Student enrollment 计数。

### 已关闭：搜索、分页与 Action Task target

- `GET /v2/advisor/students?q=`：姓名/邮箱 substring，maxLength 100；可与 `risk` / `studentType` / `activeTaskType` 组合。
- `GET /v2/advisor/students/{studentUserId}/course-options?q=`：合同已补 `q` maxLength 120；实现仍是现有 prefix LIKE。
- `GET /v2/advisor/conversations`：成功 `data` 现为 page object（有意 breaking cutover）。`unreadCount` 只计 Student 发出且高于 Advisor read cursor 的消息；`unreadOnly=true` 只返回这些未读会话。
- `GET /v2/advisor/schedule-requests`：成功 `data` 现为 page object。`requestType=ABSENCE|SCHEDULE_CHANGE`，可选 `studentUserId`；非本 Advisor 学生返回空页。
- `AdvisorActionTaskResponse.target`：typed navigation 对象。未知/malformed `sourceReference` 时 `target=null`。仍保留 `sourceType/sourceId/sourceReference`。legacy JSON `taskId` 映射为 `target.advisorTaskId`。`GET /v2/advisor/action-tasks?type=` 未知 type 返回 `400 BAD_REQUEST`。

### 错误码（本轮新增读 API）

- 缺/非法 token → `401 INVALID_TOKEN`
- 非 Advisor 普通 USER / SYSTEM_ADMIN → `403 FORBIDDEN`
- `TENANT_ADMIN` → `403 ACCESS_DENIED`

Hours / Availability 等既有 Course 接口保持各自现有 `ACCESS_DENIED` / `COURSE_NOT_FOUND` 语义，不要换成空列表。

### 可以暂缓

- 批量 link Course、批量完成 Action Task、批量安排 Mock Exam。
- Advisor 手工创建临时 Action Task。
- 高级 Dashboard 趋势图与 Course 高级筛选。
- Template 复制后编辑 Mock Exam 题目。

## 7. 前端接入结论

Advisor 可以从搜索 Instructor、找回自己拥有的 Course、搜索 Student / Group Course、分页处理 Conversation 与 pending Schedule Request，以及按 Action Task `target` 跳转，完成正式日常工作。权威合同与 `docs/api/feature-registration/` snapshot 已同步。未授权前不 commit / push / 部署 Dev/Prod。
