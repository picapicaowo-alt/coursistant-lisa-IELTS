# Production 前端交接：跨模块合同修复（8edab3a）

## 1. 发布信息

- Production API Base URL：`https://api-cn.xlearnedu.com/api`
- Backend commit：`8edab3a2041d6fac583c31faa298db352c18ee2d`
- Release：`8edab3a-20260909064404`
- 状态：后端与数据库变更已部署，Production 健康检查通过
- 本文只描述本次 `8edab3a` 发布对前端的影响，不包含此前的 C3/C4、Advisor Task 文件上传或其他旧改动。

本次没有替换既有 API 路径，前端需要处理四组合同变化：

1. Student / Parent Calendar 的时区语义；
2. Tenant Audit 的 `resourceId` 与 `targetUserId`；
3. Advisor Student Hub 的必填字段与新错误码；
4. Student / Staff / Parent Notification 的 `templateVars` 本地化合同。

## 2. 前端必改清单

### P0：通知展示改用 `notificationType + templateVars`

受影响接口：

- `GET /v2/me/notifications`
- `GET /v2/parent/notifications`

每条通知现在必定返回：

```ts
type NotificationTemplateVars = Record<string, string>;

interface NotificationItem {
  notificationType: string;
  message: string;
  templateVars: NotificationTemplateVars; // required，永不为 null
}
```

前端应按以下顺序生成展示文案：

1. 用 `notificationType` 查找前端 i18n template；
2. 用 `templateVars` 插值；
3. 如果客户端暂未配置该类型、插值失败或遇到未知类型，显示后端 `message` 作为英文 fallback。

不要：

- 把 `message` 当作可稳定解析的结构化文本；
- 假设所有可选变量都存在；
- 发送 `Accept-Language` 并期待后端翻译；
- 因为 `templateVars` 是空对象就隐藏通知。历史通知会返回 `{}`。

示例：

```json
{
  "notificationType": "ATTENDANCE_STATUS_CHANGED",
  "message": "Your attendance status is now PRESENT.",
  "templateVars": {
    "courseCode": "WRIT-101",
    "courseTitle": "Writing 101",
    "deepLink": "/course/40/attendance",
    "attendanceStatus": "PRESENT"
  }
}
```

通用变量是 `courseCode`、`courseTitle`、`deepLink`，但事件没有对应值时会省略。各类型的额外变量如下：

| `notificationType` | 额外 `templateVars` |
|---|---|
| `ANNOUNCEMENT_POSTED` | `announcementTitle` |
| `ASSIGNMENT_PUBLISHED` / `ASSIGNMENT_GRADE_RELEASED` / `ASSIGNMENT_GRADE_CORRECTED` | `assignmentTitle` |
| `ASSIGNMENT_SUBMISSION_RECEIVED` | `assignmentTitle`, `submittedAt`, `versionNo` |
| `ASSIGNMENT_SCHEDULE_CHANGED` | `assignmentTitle`, `dueAt`；可选 `lateUntil` |
| `QUIZ_PUBLISHED` / `QUIZ_TIME_LIMIT_CHANGED` / `QUIZ_GRADE_RELEASED` / `QUIZ_GRADE_CORRECTED` | `quizTitle` |
| `QUIZ_SCHEDULE_CHANGED` | `quizTitle`, `window` |
| `WEEK_PUBLISHED` | `weekTitle` |
| `COURSE_EVENT_CREATED` / `COURSE_EVENT_UPDATED` / `COURSE_EVENT_CANCELLED` | `eventTitle`, `eventTime` |
| `GROUP_MEMBER_ADDED` / `GROUP_MEMBER_REMOVED` | `audienceVariant`, `groupSetId`, `targetUserId`, `groupId`, `groupName`；其他成员视角另有 `userName` |
| `GROUP_MEMBER_MOVED` | `audienceVariant`, `groupSetId`, `targetUserId`, `oldGroupId`, `groupId`；按视角提供 `userName`、`oldGroupName`、`newGroupName` |
| `REPORT_PUBLISHED` | `reportType` |
| `ABSENCE_REQUEST_DECIDED` | `decision` |
| `SCHEDULE_REQUEST_CREATED` | `requestType` |
| `SCHEDULE_REQUEST_DECIDED` | `decision` |
| `CHECKPOINT_REACHED_INCOMPLETE` | `checkpointDescription` |
| `ATTENDANCE_STATUS_CHANGED` | `attendanceStatus` |
| `ADVISOR_TASK_CREATED` / `ADVISOR_TASK_STATUS_CHANGED` / `ADVISOR_TASK_FEEDBACK_CHANGED` | `change` |
| `SESSION_SCHEDULE_CHANGED` / `SESSION_CANCELLED` / `COURSE_HOURS_CHANGED` | 无额外变量 |

Group 通知的 `audienceVariant` 只会是：

- `TARGET`
- `EXISTING_MEMBER`
- `OLD_GROUP_MEMBER`
- `NEW_GROUP_MEMBER`

完整冻结矩阵见 `docs/notification-template-vars-matrix.md`。

兼容提醒：`/v2/me/notifications` 的 `page` 是 1-based；`/v2/parent/notifications` 的 `page` 是 0-based。这个分页规则本次没有变化。

### P0：Calendar 必须用 UTC instant 渲染

受影响接口：

- `GET /v2/me/calendar?from=&to=&timezone=`
- `GET /v2/parent/students/{studentUserId}/calendar?from=&to=&timezone=`

字段语义：

- response envelope 的 `timezone`：本次查询使用的 display timezone；
- item 的 `startsAtUtc` / `endsAtUtc`：事件的绝对 UTC 时刻；
- Session item 的 `timezone`：Session 的源时区，不是页面 display timezone；
- `fromUtc` inclusive，`toUtc` exclusive。

正确渲染方式：

```ts
const displayZone = response.data.timezone;

const text = new Intl.DateTimeFormat(locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: displayZone,
}).format(new Date(item.startsAtUtc));
```

不要用 `item.timezone` 再解释或重新构造 `startsAtUtc`。切换 display timezone 时，同一事件的 `startsAtUtc` 必须保持不变，只改变页面显示时间。

建议前端增加一条回归测试：用 `America/Los_Angeles` 和 `Asia/Shanghai` 分别查询同一个 Session，断言 `sourceId` 相同、`startsAtUtc` 相同，但渲染文本不同。

### P1：Tenant Audit 区分资源目标和人员目标

受影响接口：

```http
GET /v2/tenant/audit-events
```

新增 query parameter：

```ts
resourceId?: number; // int64
```

规则：

- 使用 `resourceId` 查询时，必须同时传 `resourceType`；
- 只传 `resourceId` 会返回 `400 BAD_REQUEST`；
- `resourceId` 必须和 `resourceType` 一起显示、筛选和解释；
- response event 新增 `resourceId`；
- `targetUserId` 现在只表示真实人员，不再被资源 id 复用。

前端 Audit 表格建议拆为两列：

```ts
interface TenantGovernanceAuditEvent {
  resourceType: string;
  resourceId: number;
  targetUserId: number | null;
}
```

- `Resource`：显示 `${resourceType} #${resourceId}`；
- `Target user`：只显示 `targetUserId`，为 `null` 时显示 `—`；
- 不要再把 Mock Exam template id 当成 user id 请求用户资料。

例如 Mock Exam 事件中：

```json
{
  "resourceType": "MOCK_EXAM_TEMPLATE",
  "resourceId": 880088,
  "targetUserId": null
}
```

Identity `USER` / `ADMIN` 事件的 `targetUserId` 是对应人员；Advising 事件是对应 Student；Course、Mock Exam、Tenant Alert Rule 事件通常为 `null`。

### P1：Advisor Hub 更新类型和错误处理

受影响接口：

```http
GET /v2/advisor/students/{studentUserId}/hub
```

前端类型应更新为：

```ts
interface AdvisorStudentHubResponse {
  studentUserId: number;
  studentType: 'VIP' | 'STANDARD'; // required
  activeCourseCount: number;       // required，最小可为 0
  publishedReportCount: number;
  pendingRequestCount: number;
  // 其余既有字段不变
}
```

行为说明：

- `studentType` 来自 Student Intake，前端不要再从 Profile 推断；
- `activeCourseCount` 是去重后的有效课程数：link 为 `ACTIVE`、未完成、未归档且课程已 `PUBLISHED`；
- 没有有效课程时明确返回 `0`，不要把 `0` 当成缺失值；
- 当前 Advisor assignment 存在、但 Student Intake 缺失时返回 `404 STUDENT_INTAKE_NOT_FOUND`；
- `404 STUDY_PLAN_NOT_FOUND` 仍表示当前 Advisor 无可访问的 Study Plan（包括旧 Advisor 失去归属的场景）。

建议 UI 将 `STUDENT_INTAKE_NOT_FOUND` 显示为“该学生尚未完成 Intake，Student Hub 暂不可用”，不要显示成通用“学生不存在”。

## 3. OpenAPI 同步

前端应从本次 Feature Registration snapshot 重新生成或手工同步对应 API types：

- `docs/api/feature-registration/advising.openapi.yaml`
- `docs/api/feature-registration/auth.openapi.yaml`
- `docs/api/feature-registration/course.openapi.yaml`
- `docs/api/feature-registration/notification.openapi.yaml`
- `docs/api/feature-registration/parent.openapi.yaml`

重点确认生成结果中：

- 两类 notification item 的 `templateVars` 是 required、non-null 的 `Record<string, string>`；
- Advisor Hub 的 `studentType`、`activeCourseCount` 是 required；
- Tenant Audit query 和 event model 中存在 `resourceId`；
- Calendar envelope timezone 与 item timezone 的注释没有被类型生成器丢失。

## 4. 前端验收清单

- [ ] Student/Staff notification 能按 `notificationType + templateVars` 显示本地化文案。
- [ ] Parent notification 使用相同本地化策略。
- [ ] legacy `templateVars: {}`、未知 notification type 会回退到 `message`，页面不崩溃。
- [ ] Group 四种 `audienceVariant` 都有模板或安全 fallback。
- [ ] Calendar 切换 display timezone 后，UTC instant 不漂移，页面显示时间正确变化。
- [ ] Parent Calendar 与 `/v2/me/calendar` 使用同一时区渲染规则。
- [ ] Tenant Audit 的资源列与人员列分开，Mock Exam 资源不会触发用户资料查询。
- [ ] Audit 资源过滤总是同时发送 `resourceType + resourceId`。
- [ ] Advisor Hub 正确显示 `VIP` / `STANDARD` 和 `activeCourseCount=0`。
- [ ] Advisor Hub 单独处理 `STUDENT_INTAKE_NOT_FOUND` 与 `STUDY_PLAN_NOT_FOUND`。
- [ ] 所有请求继续使用 Production base URL `https://api-cn.xlearnedu.com/api`，不要重复拼接 `/api`。

## 5. 本次无需改动

- 既有登录、refresh token、CORS 和 API base URL 没有变化；
- 既有 notification read / read-all 接口没有变化，仍需 `Idempotency-Key`；
- Calendar API 路径和 query 字段没有变化，变化的是 Session item `timezone` 的合同语义；
- 前端不需要执行数据库脚本，也不需要处理后端的 `template_vars_json` 存储字段。
