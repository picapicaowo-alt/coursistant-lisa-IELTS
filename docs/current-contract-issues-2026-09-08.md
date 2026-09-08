# Prod 当前后端问题 — Demo 复验

环境：`https://app.xlearnedu.com` → `https://api-cn.xlearnedu.com/api`；测试租户 `tenantId=1`。复验时间：2026-09-08 UTC。仅调用现有前端消费合同，未修改后端或数据库。

## P1：家长课表未生成课次的 UTC 时刻随显示时区改变

角色：Parent，userId=30，已关联 studentUserId=26。课程 2 已生成课次使用 `Asia/Shanghai`。

```http
GET /api/v2/parent/students/26/calendar?from=2026-09-21&to=2026-09-30&timezone=America%2FLos_Angeles
GET /api/v2/parent/students/26/calendar?from=2026-09-21&to=2026-09-30&timezone=Asia%2FShanghai
```

两次 HTTP 200 / SUCCESS。相同 `sourceId=SESSION:2:2026-09-22:14:00`：

| 查询时区 | startsAtUtc | endsAtUtc | 返回行 timezone |
|---|---|---|---|
| America/Los_Angeles | 2026-09-22T21:00:00Z | 2026-09-22T22:00:00Z | America/Los_Angeles |
| Asia/Shanghai | 2026-09-22T06:00:00Z | 2026-09-22T07:00:00Z | Asia/Shanghai |

9 月 29 日同一规律复现。预期：显示时区可以改变本地时间表示，不能改变同一课程事件的绝对时刻。影响：家长可能看到相差 15 小时的开课时间。

前端不能安全修复：返回行的 timezone 已被替换为查询时区；未生成事件中没有独立的课程原始时区，且日历可混合多门课程。前端不应固定使用上海时区，也不能改写已经生成课次的权威 UTC。

请后端核对未生成课次的日期、课程时区与 UTC 转换，并确保同一事件跨查询时区的绝对时刻一致。本证据不推断后端内部实现。

证据：`release-parent-calendar-la.json`、`release-parent-calendar-shanghai.json`。前端消费位置：`lms/src/apis/services/parent-api.ts`、`lms/src/pages/ParentPortalPage/ParentSchedule.tsx`。

## P2：模考试卷审计事件把模板 ID 写入 targetUserId

角色：Tenant Admin，userId=1。

```http
GET /api/v2/tenant/audit-events?page=0&size=20
```

HTTP 200 / SUCCESS，现有事件：

```json
{"eventId":"IDENTITY:39","actorUserId":1,"action":"MOCK_EXAM_TEMPLATE_PUBLISHED","resourceType":"MOCK_EXAM_TEMPLATE","targetUserId":2,"after":{"templateId":2,"versionId":2,"action":"MOCK_EXAM_TEMPLATE_PUBLISHED"}}
```

模板 2 与人员 userId=2 不属于同一种身份。预期：`targetUserId` 只指向真实人员目标；资源目标应由明确的资源身份表达。此问题也影响按 targetUserId 查询的审计语义。

前端已增加展示保护：对 `resourceType=MOCK_EXAM_TEMPLATE` 使用 after/before 中有效的 templateId 显示“模考试卷 2”，不再查询或显示无关人员。动作名及资源类型已补齐三语。该保护不修改服务器审计数据，后端字段问题仍需处理。

证据：`release-tenant-audit.json`。前端：`lms/src/pages/TenantAdminPage/AuditPanel.tsx`、`auditTarget.ts`。

## P2：顾问学生 hub 投影缺少学生类型和课程数量

角色：Owner Advisor，userId=7。

```http
GET /api/v2/advisor/students/26/hub
GET /api/v2/advisor/students/26/profile
GET /api/v2/advisor/students/26/courses
```

三次 HTTP 200 / SUCCESS。hub 仍返回 `studentType:null`、`activeCourseCount:null`；profile 返回 `studentType:"STANDARD"`；courses 返回课程 1 和 2 的真实关联，均 `status:"ACTIVE"`、`launchState:"PUBLISHED"`、`lifecycleStatus:"ONGOING"`。

前端已在 hub 的 studentType 缺失时复用已加载的 profile.studentType。课程数量保持未提供状态：合同没有说明 activeCourseCount 对有效关联、发布状态、完成/归档课程的统计规则，不能把数组长度猜成相同口径。

请后端补齐 hub 投影并明确 activeCourseCount 的口径及无课程时的 0 值语义。这不等于课程创建或关联失败。

证据：`release-advisor-hub.json`、`release-advisor-profile.json`、`release-advisor-courses.json`。合同：`docs/api/advising.openapi.yaml` → AdvisorStudentHubResponse；前端：`lms/src/pages/AdvisorStudentWorkspacePage/index.tsx`。

## P2：系统生成通知正文缺少可本地化的结构化信息

角色：Parent，userId=30。

```http
GET /api/v2/parent/notifications?page=0&size=20
Accept-Language: zh-CN
```

HTTP 200 / SUCCESS，正文仍为英文：

```json
{"notificationId":56,"notificationType":"ATTENDANCE_STATUS_CHANGED","message":"Attendance status changed to PRESENT.","subjectType":"SESSION_OCCURRENCE","subjectId":5}
```

当前响应提供 notificationType/message/subject 身份，未提供本条变更的结构化考勤状态或翻译参数。标题、时间和控件由前端正确切换语言；message 为服务端正文原样显示。

前端不能通过替换固定英文句子安全覆盖所有通知，更不能丢弃其中业务细节。请明确通知本地化合同：正文语言选择或稳定模板标识与完整参数。保留教师/用户撰写的学习内容原文。

证据：`release-parent-notifications.json`、`release-parent-notifications-zh.json`。前端：`lms/src/utils/notificationPresentation.ts`、`lms/src/pages/ParentPortalPage/index.tsx`。

## 已由前端调整：System Admin 名单读取入口

实测 System Admin 登录 role=ADMIN：

```http
GET /api/v2/courses/2/members?page=0&size=20&active=true
```

HTTP 403：`{"code":"ACCESS_DENIED","data":null,"message":"No Permission to Perform This Action"}`。

`docs/api/course.openapi.yaml` 明确将成员 GET 授权给 Owner Advisor 和 Active Primary Instructor。前端已停止从管理员控制台及管理员直接 roster URL 发起该读取，保留现有管理员选课操作，并说明名单由课程负责顾问和主讲教师查看。此项无需后端放宽现有权限；若产品未来要求管理员查看完整名单，应另行提供正式合同。

证据：`release-admin-members.json`。这项不计为当前后端违反合同的问题。
