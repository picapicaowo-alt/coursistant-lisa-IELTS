# Student 前端联调说明

权威合同：`docs/api/course.openapi.yaml`、`assignment.openapi.yaml`、`mockexam.openapi.yaml`、`advising.openapi.yaml`。本分支快照：`docs/api/feature-registration/`（快照不是第二事实来源）。

## 环境

| 项 | 值 |
|---|---|
| Local base | `http://localhost:8080/api` |
| 健康检查 | `GET {base}/v1` → 200 |
| 登录 | `POST {base}/v1/auth/login`，`role=USER` |
| 身份 | `role=USER` + `level=STUDENT` |

账号密码向后端负责人索取，不要写进前端仓库。

姓名一律 `firstName / middleName / lastName`。首次设密与 structured name 走现有 Auth / User 写入合同。

## Breaking cutover register（CUTOVER_PENDING）

四个响应 shape 已在本地切换。未获前端确认前 **禁止 Dev Promotion**，状态 `BLOCKED_ON_CONSUMER_CUTOVER`。

| 接口 | 旧 shape | 新 shape | 已知消费者 | 前端确认 | 回退 |
|---|---|---|---|---|---|
| `GET /v2/me/work-queue` | `data: Item[]` | `data: {page,size,total,items}` | 本仓库 IT / 前端 Student Work Queue | 未确认 | 恢复裸数组需后端再发 cutover |
| `GET /v2/me/schedule-requests` | `data: Item[]` | 同上，且含 course/occurrence 字段 | Student 页；Parent Schedule Request list 仍是独立裸数组合同 | 未确认 | 同上 |
| `GET /v2/student/mock-exams` | `data: Summary[]` | page envelope | Student list；Parent Mock Exam list 仍是独立只读数组合同 | 未确认 | 同上 |
| `GET /v2/student/advisor-conversation/messages` | `data: Message[]` | `data: {items,nextBeforeId,hasMore}` | Student history；Parent Conversation 现也已独立切换为 cursor envelope | 未确认 | 同上 |

## 分页 / cursor

| 表面 | 基准 | 默认 | 非法 |
|---|---|---|---|
| `meCoursesList` / `meWorkQueue` / `meScheduleRequests` / `meListPublishedStudentReports` / `listStudentMockExams` | zero-based | `page=0,size=20`，`size=1..100` | `page<0`、`size` 非法、`page*size` 溢出 → `400 BAD_REQUEST`；越界页 `200` 空 `items` + 真实 `total` |
| Work Queue | 另限 `offset<=10000` | 同上 | 超深页 `400` |
| Conversation | cursor `beforeId` + `size` | `size=50`，上限 100 | 非法 size `400`；未知/越权/低于围栏 `beforeId` → `404 CONVERSATION_NOT_FOUND` |

`401` 一律 `INVALID_TOKEN`。写接口带 `Idempotency-Key`。

## 推荐调用顺序

1. 登录 / 首次设密 / structured name
2. Profile、Advisor assignment、Study Plan / Task
3. `GET /v2/me/courses?courseView=CURRENT|COMPLETED` — Current vs Completed
4. Week / Material / Syllabus（现有 course-scoped 读）
5. Work Queue 处理作业、Advisor Task、提醒、近期 session
6. Calendar、personal event、Schedule Request
7. Attendance / Hours / Progress / Alert
8. Published Report 聚合 → 现有 detail
9. Notification inbox、Advisor conversation
10. Mock Exam 列表 → detail / attempt / 三科 submit / 媒体

## 关键读接口

### Course

`GET /v2/me/courses?state=&courseView=&page=&size=`

- `state`：`Active / Archived`（课程 state，不是 lifecycle）
- `courseView=CURRENT`：Student lifecycle `PUBLISHED|ONGOING`（legacy 无 delivery 的 `lifecycleStatus=null` 也算 CURRENT）
- `courseView=COMPLETED`：`COMPLETED`
- 省略：Student 行 = CURRENT+COMPLETED；Instructor/TA 行保持原可见性
- 传了 `courseView` 时 Instructor/TA 行不进入结果
- `HIDDEN` 永不出现也不计入 total（完成日起 Tenant 日历满 3 个月）
- Student 行含 `lifecycleStatus`、`completedAt`、`lectureTotal`、`lectureCompleted`
- 排序 `updatedAt DESC, id DESC`

### Work Queue

`GET /v2/me/work-queue?page=&size=`

只含仍需处理：未提交 Published 作业、未完成 Advisor Task、active Alert、未读 Notification、当天起 7 日内未结束 session。

排序：urgency → `actionAtUtc` ASC（null 最后）→ `sourceType` → source identity。保留 `dueAt`，用 `timezone` 解释本地时间。

### Schedule Request / Report / Mock Exam / Conversation

- `GET /v2/me/schedule-requests?requestType=&status=&courseId=&page=&size=`
- `GET /v2/me/student-reports?reportType=&courseId=&page=&size=`（仅本人 Published；detail 仍用 `/v2/courses/{courseId}/student-reports/published/me/{reportId}`）
- `GET /v2/student/mock-exams?status=&page=&size=`
- `GET /v2/student/advisor-conversation/messages?beforeId=&size=`

## 本轮不支持

Quiz、Global Exam、AI Study Support、Mock Exam autosave/timer/template 编辑、Student 自助选课退课换 Advisor、改 Profile/Study Plan、新通知类型。

## 错误处理

| HTTP | code | 处理 |
|---|---|---|
| 401 | `INVALID_TOKEN` | 重新登录 |
| 403 | `FORBIDDEN` / `ACCESS_DENIED` | 非 Student 或能力不足 |
| 404 | `CONVERSATION_NOT_FOUND` / `COURSE_NOT_FOUND` | 不泄漏资源存在性 |
| 409 | 冲突 / CAS | 用最新 version 重试 |
