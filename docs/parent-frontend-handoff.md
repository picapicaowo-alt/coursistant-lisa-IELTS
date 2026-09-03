# Parent 前端联调说明

契约入口（给前端生成类型，不要读 Java）：

- Parent core：`docs/api/feature-registration/parent.openapi.yaml`（权威手写源是 `docs/api/parent.openapi.yaml`，二者必须字节一致）
- Mock Exam 只读：`docs/api/feature-registration/mockexam.openapi.yaml`（权威源 `docs/api/mockexam.openapi.yaml`）

实现保持 `/v2/parent/**`、`USER + PARENT + ACTIVE`、每个 Student 资源都过当前 active `parent_student_link`。前端决定当前 Student；后端不保存 selected Student。

本轮范围：Parent 身份与 link、linked Student 只读、Request、Published Report / public risk / IN_APP、同一 Advisor Conversation cursor、Course lifecycle / Calendar 与 Student 共用规则。不做网课、AI、Payment、Submission 文件、Discussion、Parent 自助注册、Email/SMS/Push、Mock Exam 创建/作答/评分。

## 环境

| 项 | 值 |
|---|---|
| Local base | `http://localhost:8080/api` |
| Dev base | 获授权后再用；不要用本地账号打 Prod |
| 健康检查 | `GET {base}/v1` → 200 |
| 登录 | `POST {base}/v1/auth/login`，Parent 的 `role=USER` |

Counsellor 创建/复用的 Parent **没有临时明文密码**。必须通过现有 Password Reset 设密后才能登录；设密前登录失败。不要引导 Parent 调用 `PUT /v1/auth/password` 作为首次设密。

Parent / Counsellor / Advisor / Instructor / Schedule 业务写入部署后默认可用，不再依赖环境变量写开关。失败时回滚应用。真实 403/404/409 仍按身份、tenant、active-link、assignment、CAS 和业务 fence 返回。

## 身份与 Link

- 唯一身份：`USER` + `PARENT`。非幂等 Parent identity 转换一律 `409 IDENTITY_LEVEL_TRANSITION_FORBIDDEN`。
- Counsellor：`GET /v2/counsellor/student-intakes/{intakeId}/parent-links` 读取本人仍持有的 `OPEN + UNASSIGNED` Intake 的 active links（空列表为 `200` + `[]`）。刷新页面应重新 GET，不要依赖前端本地缓存。`POST` 按 email create/reuse + link；`PUT/DELETE .../parent-links/{parentUserId}`。没有 Parent Directory/Search。
- TENANT_ADMIN：`PUT/DELETE/GET /v2/tenant/students/{studentUserId}/parent-links...`
- 当前 Advisor：只读 `GET /v2/advisor/students/{studentUserId}/parent-links`

## Parent 只读

所有 Student-scoped 路由显式 `{studentUserId}`。未关联 / 已解绑 / 跨租户统一 `404`。非 Parent `403`。

| 方法 | 路径 |
|---|---|
| GET | `/v2/parent/linked-students` |
| GET | `/v2/parent/students/{studentUserId}/dashboard` |
| GET | `/v2/parent/students/{studentUserId}/profile` |
| GET | `/v2/parent/students/{studentUserId}/study-plan` |
| GET | `/v2/parent/students/{studentUserId}/courses` |
| GET | `/v2/parent/students/{studentUserId}/assignments` |
| GET | `/v2/parent/students/{studentUserId}/calendar` |
| GET | `/v2/parent/students/{studentUserId}/attendance` |
| GET | `/v2/parent/students/{studentUserId}/hours` |
| GET | `/v2/parent/students/{studentUserId}/risk` |
| GET | `/v2/parent/students/{studentUserId}/reports` |
| GET | `/v2/parent/students/{studentUserId}/reports/{reportId}` |

DTO 不含 `advisorPrivateNotes`、object key、version/CAS、link watermark。Course 隐藏 HIDDEN/draft；Assignment 只 Published + released grade；Report 只 Published `MID_TERM/FINAL`。

### Course lifecycle

Parent 与 Student 共用 `StudentCourseLifecycle.project()`。只有 `SCHEDULED`/`COMPLETED` 且通过 Week publication fence 的课次能把 Course 推成 `ONGOING`。`RESCHEDULED`、`CANCELLED`、Draft Week 不会。`COMPLETED/HIDDEN` 只由 `study_plan_course_link.completed_at` 与三个月规则决定，不能由 occurrence `COMPLETED` 推导。`HIDDEN` Course 从 list / dashboard 省略，不返回 `lifecycleStatus=HIDDEN`。日期边界使用 Tenant IANA timezone。

### Calendar

`GET /v2/parent/students/{studentUserId}/calendar?from=&to=&timezone=`

- `from` inclusive local date，`to` exclusive local date；默认 `[tenantToday, tenantToday + 14 days)`，最长 90 天。
- `200 data` 固定 `{timezone, fromUtc, toUtc, items}`，不再是裸数组。
- item 字段：`eventType/sourceId/startsAtUtc/endsAtUtc/timezone/courseId/courseCode/courseTitle/title/weekId/lectureId/lectureNumber/instructorUserId/instructorFirstName/instructorMiddleName/instructorLastName/assignmentId/occurrenceId`。
- 一次改期只保留 replacement Session；原 `RESCHEDULED` 课次与重复的 `APPROVED_SCHEDULE_CHANGE` 卡片不返回。
- Assignment deadline：`startsAtUtc = endsAtUtc = dueAtUtc`。
- Dashboard `upcomingSchedule` 用同一 projector，再过滤 `startsAtUtc >= nowUtc`，最多 8 条。

## Request

`POST/GET /v2/parent/students/{studentUserId}/schedule-requests`。Parent 无 approve/reject。需要 `Idempotency-Key`。

## Notifications

`GET /v2/parent/notifications`、`/unread-count`、`PATCH /{id}/read`、`PATCH /read-all`。只显示当前仍 active 的 `context_parent_link_id`。解绑后 relink 不会复活旧通知。availability 使用该 link，不是 enrollment。

## Conversation

Student、当前 Advisor、active Parent 共享同一 thread / message id。

| 方法 | 路径 |
|---|---|
| GET | `/v2/parent/students/{studentUserId}/conversation/messages` |
| POST multipart | 同上 |
| POST | `.../conversation/read` |
| GET | `.../attachments/{attachmentId}/preview\|download` |

`GET /v2/parent/students/{studentUserId}/conversation/messages?beforeId=&size=`

- `size` 默认 50，范围 1–100。
- `200 data` 固定 `{items, nextBeforeId, hasMore}`，不再是裸数组。
- 排序 `createdAt DESC, messageId DESC`。用 `size + 1` 判断 `hasMore`；`nextBeforeId` 指向本页最后一条。加载下一页：带上上一页的 `nextBeforeId`。
- 空 thread：`200` + `{items:[], nextBeforeId:null, hasMore:false}`。
- 非法 / 跨 thread / watermark 之前的 `beforeId`：`404 CONVERSATION_NOT_FOUND`。
- unlink 后 list/send/preview/download：`404 NOT_FOUND`。

Parent **只开放 multipart**，不要发 JSON `fileObjectKey`。响应不含 `clientMessageId` / objectKey / checksum。`clientMessageId` 仅作请求幂等字段。可见窗口是当前 link watermark。Advisor 改派只切 Advisor 权限，Parent link 与 thread 不变。

## Mock Exam 只读

权威合同在 Mock Exam OpenAPI，不要把 path 复制进 `parent.openapi.yaml`。

| 方法 | 路径 |
|---|---|
| GET | `/v2/parent/students/{studentUserId}/mock-exams` |
| GET | `/v2/parent/students/{studentUserId}/mock-exams/{studentMockExamId}` |

Parent 可读公开成绩。不得查看 Instructor-only Writing feedback。没有创建、提交、评分或 Template 管理能力。unlink 后这两个 GET 为 `404 NOT_FOUND`。

## 权限与 404

- 非 Parent 调 Parent 路由：`403 FORBIDDEN`
- not-linked / unlinked / cross-tenant / stale link：`404`
- 当前 Advisor 改派后立即 `404`；Parent 不受改派影响，直到 Tenant/Counsellor unlink

## Dev Promotion

未获授权不得：commit、push、PR、共享环境执行 SQL 或部署。本地 `application.yml` 保持用户现有值。

## 验收

以当前 `docs/api/parent.openapi.yaml` + Mock Exam OpenAPI 和 targeted / verify 结果为准。不要把历史 smoke 数字或旧 Gate 描述当成实时合同。历史本地 run 可能仍是裸数组 Calendar / Conversation，已 coordinated cutover。

未授权不得 commit / push / PR / 共享环境 SQL / 部署。
