# Frontend Handoff：Instructor → Student → Parent

更新时间：2026-09-03  
Backend branch：`feature/registration`  
Backend baseline：`4e6f521`（包含 Instructor、Student、Cross-module review fixes、Parent required fixes）

本文是前端接入的总入口。具体字段、required、enum、错误响应以 OpenAPI 为准；角色 handoff 用来解释页面业务流与调用顺序。不要从 Java DTO、历史验收报告或旧 Postman 数据反推合同。

本交付覆盖的后端提交：

| Commit | 前端相关结果 |
|---|---|
| `ed4b86b` | Instructor queue、Schedule Request、Writing grading 和 typed contracts |
| `699a2c6` | Instructor grading timezone、Group grading row/deepLink、分页 overflow |
| `04cd7ab` | Student Course/Work Queue/Request/Report/Mock Exam/Conversation 易用性 |
| `bdbc1ad` | Group submission/lifecycle 正确性、Parent unread、Mock Exam media race、email/page 边界 |
| `4e6f521` | Parent Calendar/lifecycle、Conversation cursor、typed Parent contract、Mock Exam handoff |

## 1. 发给前端的文件

### 1.1 必读 handoff

1. `docs/frontend-handoff-instructor-student-parent.md`（本文）
2. `docs/instructor-frontend-handoff.md`
3. `docs/student-frontend-handoff.md`
4. `docs/parent-frontend-handoff.md`

### 1.2 必须更新的 API contract

从 `docs/api/feature-registration/` 提供：

| Contract | 用途 |
|---|---|
| `auth.openapi.yaml` | 登录、Password Reset、structured name、身份字段 |
| `user.openapi.yaml` | 当前用户/Profile 基础读写 |
| `course.openapi.yaml` | Instructor Dashboard、Course/Week/Content、Calendar、Schedule、Attendance、Student Course/Work Queue/Progress |
| `assignment.openapi.yaml` | Assignment、submission、grading、released grade |
| `notification.openapi.yaml` | Student/Instructor 通知读面 |
| `mockexam.openapi.yaml` | Instructor Writing grading、Student Mock Exam、Parent Mock Exam 只读 |
| `advising.openapi.yaml` | Student Profile/Study Plan/Task、Advisor Conversation |
| `parent.openapi.yaml` | Parent link、读面、Calendar、Request、Notification、Conversation、Report |

`quiz.openapi.yaml` 只用于既有 course-bound Quiz compatibility，不在本轮 xLearn Student/Instructor 主页面 inventory。若前端仍接 Quiz，请使用权威 `docs/api/quiz.openapi.yaml`；不要因为 snapshot 的 CRLF/LF 差异判断 API 语义发生变化。

交付包 fingerprint：

| Contract | SHA-256 | authority/snapshot |
|---|---|---|
| auth | `D5086ED83D58FCC9E0DD2C2B00025551BF5F2C8F183AD15A40BB4A5A9557107F` | MATCH |
| user | `31835E7357C7F5D8518E71998376F45A5B138E83550E3B91C2B9CFCD96F2CC3A` | MATCH |
| course | `1667B615470AFF6E1DFA60F7BC33A42A7787C5E04A96C65362B65CDDF4D9B513` | MATCH |
| assignment | `994318D3995FBAB6163086DD33B74AC94DF41B62CE3A92FDD22F1FA138DB7865` | MATCH |
| notification | `93676A25035DC80BA02273BD97B01C705FEC38B7095B477B45E199CFA016054B` | MATCH |
| mockexam | `666850A47DD48B50D5739F47DC61AFCD40BE084A519AF6689651F015DE9461B3` | MATCH |
| advising | `3C4F7CBC038A06595C3AFB4F6F2F2159883BCD4B9961030441570AD2AF75B3DE` | MATCH |
| parent | `C8130DC3794FF043C365F953A565AF2BC1CED97C9DCBC593BA15EB2CEA41C644` | MATCH |
| quiz authority（optional） | `9343BE7AF3AC0BA01656591AEC32A167873E97F5977284993A283110CD258801` | semantic match；snapshot 仅行尾不同 |

### 1.3 不需要发给前端

- `*-acceptance-report.md`：QA/Gate 证据，不是调用合同。
- SQL、Mapper、Java DTO、Test fixture。
- `docs/api/*.openapi.yaml` 与 snapshot 两套同时发送。前端只保留一套 feature-registration snapshot，避免导入重复 operationId。

## 2. 必须协调的 breaking cutover

前端必须先移除旧的 `data: []` 假设，再切换到本版本后端。

| Role | API | 新 `data` shape | 分页 |
|---|---|---|---|
| Instructor | `GET /v2/me/teaching/grading-items` | `{page,size,total,items}` | zero-based |
| Instructor | `GET /v2/me/teaching/schedule-requests` | `{page,size,total,items}` | zero-based |
| Instructor | `GET /v2/instructor/mock-exams/writing-grades` | `{page,size,total,items}` | zero-based |
| Student | `GET /v2/me/work-queue` | `{page,size,total,items}` | zero-based |
| Student | `GET /v2/me/schedule-requests` | `{page,size,total,items}` | zero-based |
| Student | `GET /v2/student/mock-exams` | `{page,size,total,items}` | zero-based |
| Student | `GET /v2/student/advisor-conversation/messages` | `{items,nextBeforeId,hasMore}` | cursor |
| Parent | `GET /v2/parent/students/{studentUserId}/calendar` | `{timezone,fromUtc,toUtc,items}` | `[from,to)` window |
| Parent | `GET /v2/parent/students/{studentUserId}/conversation/messages` | `{items,nextBeforeId,hasMore}` | cursor |

Cursor 下一页规则：把当前响应的 `nextBeforeId` 原样放进下一次 `beforeId`；`hasMore=false` 时停止。不要用数组长度猜还有没有下一页。

## 3. Instructor：前端需要落实的变化

### 3.1 页面结构

- My Classes / Today Classes / Upcoming Activities。
- Assignment/Quiz Grading Queue 与逐条 Grading Items。
- Schedule Change Review Queue。
- Mock Exam Writing Grading 独立 Tab，不并入 Assignment Grading Queue。
- Student profile context、Week/Material、Discussion、Course Report、Availability。

### 3.2 Grading Items

- Individual：一行一个 Student。
- Group：一行一个 Group，读取 `submissionType/groupId/groupName`。
- 时间字段使用 `dueAtUtc/dueAtLocal/timezone`，不要再读取旧 `dueAt`。
- Individual deep link：`/courses/{courseId}/assignments/{assignmentId}/grading/{studentUserId}`。
- Group deep link：`/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grading`。
- `status` 只传 `PENDING/IN_PROGRESS/COMPLETED`。

### 3.3 Instructor 权限边界

Instructor 可以填写 Attendance、批改、更新教学内容、审核 `SCHEDULE_CHANGE`。最终课次 create/generate/reschedule/cancel 仍是 owner Advisor-only，Instructor 页面不要显示这些按钮。

Mock Exam Writing：list item 不含完整 tasks；打开详情后再加载 tasks。已评分不能再次评分，返回 `409 MOCK_EXAM_WRITING_ALREADY_GRADED`。

## 4. Student：前端需要落实的变化

### 4.1 Course 与 lifecycle

- `courseView=CURRENT`：`PUBLISHED/ONGOING`。
- `courseView=COMPLETED`：`COMPLETED`。
- `HIDDEN` Course 不返回且不计入 `total`。
- `lectureTotal` 只计算 Published Week。
- `lectureCompleted` 只计算有效、已结束并通过 Week publication fence 的 occurrence。
- Group Assignment 的 submission/progress/grade 必须使用后端返回结果，不要前端按个人 submission 猜测。

### 4.2 Work Queue

只显示仍需 Student 行动的 Published Assignment、Advisor Task、Alert、未读 Notification、未来七天 Session。前端使用后端 `urgency/actionAtUtc/timezone/deepLink` 排序和跳转，不自行重新计算风险与截止状态。

### 4.3 Schedule Request / Report / Mock Exam / Conversation

- Schedule Request 支持 `requestType/status/courseId/page/size`，item 已带 Course 与 occurrence 上下文。
- Published Report 使用 `GET /v2/me/student-reports` 分页聚合，再用现有 detail endpoint。
- Mock Exam list 使用 page envelope，可按 `status` 筛选。
- Advisor Conversation 使用 cursor envelope。

Student 本轮仍不支持 Global Exam、AI Study Support、Mock Exam autosave/timer、Student 自助选课/退课/换 Advisor。

## 5. Parent：前端需要落实的变化

### 5.1 Student 选择与只读边界

- 先调用 `GET /v2/parent/linked-students`。
- 当前 Student 由前端选择并放入所有 `{studentUserId}` path；后端不保存 selected Student。
- 未关联、解绑、跨租户资源返回 404。
- Parent 不能修改 Profile、Study Plan、Course、Report 或成绩。

### 5.2 Calendar

`GET /v2/parent/students/{studentUserId}/calendar?from=&to=&timezone=`

- `from` inclusive、`to` exclusive；默认 14 天、最长 90 天。
- 使用 `startsAtUtc/endsAtUtc/timezone`，不要继续读取旧 `date/startTime/endTime/deadline`。
- 改期后只显示 replacement Session，不显示原 `RESCHEDULED` 课次或重复 approval 卡片。
- Parent 与 Student 使用相同 Course lifecycle；`HIDDEN` 不显示。

### 5.3 Conversation 与 Mock Exam

- Conversation 已改为 cursor envelope；发送仍只接受 multipart。
- Parent Mock Exam 只有 list/detail 两个 GET。
- Parent 可见公开成绩，但不能看到 Instructor-only Writing feedback。

## 6. Cross-module 修复对前端的影响

以下不增加页面，但会改变边界行为：

| 行为 | 前端处理 |
|---|---|
| Parent 在有效 link 期发送消息 | Advisor unread/unreadOnly 现在会计入；无需前端补偿计数 |
| Mock Exam media upload 与 publish 并发 | 接受 `409 CONTENT_LOCKED` 或 `409 NOT_READY`，刷新 version/detail 后重试 |
| 已绑定 Mock Exam media 删除 | `409 MEDIA_STATE_CONFLICT`；刷新媒体列表，不在本地强制移除 |
| Managed User email | 前端先 trim/lowercase 并做标准 email 校验；后端非法值返回 `400 BAD_REQUEST` |
| 极大 page 导致 offset overflow | 后端返回 `400 BAD_REQUEST`；前端不得生成超大 page |
| Student Report list | 后端已消除 per-row query；响应 shape 不变 |

## 7. 通用前端规则

- 登录后的身份以 `role` + `level` 判断：Instructor/Student/Parent 都是 `role=USER`。
- Instructor level：`INSTRUCTOR` 或 `INSTRUCTOR_ADVISOR`。
- 姓名只使用 `firstName/middleName/lastName`；不要读写 `name/displayName/userName` 作为人员姓名。
- 所有请求携带 `Authorization: Bearer {accessToken}`。
- 需要幂等的 mutation 按 OpenAPI 发送唯一 `Idempotency-Key`。
- `401 INVALID_TOKEN`：清理 session 并重新登录。
- `403`：能力不足，不显示同一操作的重复重试按钮。
- `404`：按资源隐藏处理，不提示“该 ID 实际存在”。
- `409`：按具体 `code` 刷新最新状态/version 后决定是否重试。
- `page` 默认 zero-based；Discussion 与 Course Report 的既有 1-based 规则除外，详见 Instructor handoff。

## 8. 前端完成确认清单

- [ ] 已重新导入本交付包的 OpenAPI，未混用旧 generated client。
- [ ] 已适配 9 个 breaking response shape。
- [ ] Instructor Group grading 使用 group deep link。
- [ ] Instructor 不显示最终排课 mutation。
- [ ] Student Course CURRENT/COMPLETED/HIDDEN 展示正确。
- [ ] Student/Parent Conversation 使用 `nextBeforeId/hasMore`。
- [ ] Parent Calendar 使用 UTC fields 和 `[from,to)`。
- [ ] Parent Mock Exam 页面不展示 Writing feedback。
- [ ] 所有人员姓名使用三段字段。
- [ ] 已按 `ApiResponse.code` 处理 400/401/403/404/409。

完成以上项目后，再在 Dev 对 Instructor、Student、Parent 各做一轮 focused API/UI 联调；不需要前端复跑后端 Maven 测试。
