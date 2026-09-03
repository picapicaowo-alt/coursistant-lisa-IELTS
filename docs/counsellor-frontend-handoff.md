# Counselor 前端 API 交接说明

## 1. 文档定位

本文档用于 xLearn 前端实现 Counselor 招生与首次交接流程。

代码、身份枚举和 API 路径统一使用英式拼写：

- 身份：`COUNSELLOR`
- 路径：`/v2/counsellor/**`
- operationId：`counsellor*`

权威合同：

- `docs/api/auth.openapi.yaml`
- `docs/api/counsellor.openapi.yaml`
- `docs/api/parent.openapi.yaml`
- `docs/api/advising.openapi.yaml`（完整 Advising 合集）

本文档是前端使用说明，不替代 OpenAPI。字段、状态码或错误码发生冲突时，以权威 OpenAPI 和当前部署版本为准。

## 2. 环境与认证

| 项目 | 地址或要求 |
|---|---|
| Local base | `http://localhost:8080/api` |
| Dev base | `https://dev.xlearnedu.com:8083/api` |
| 健康检查 | `GET {base}/v1` |
| 登录 | `POST {base}/v1/auth/login` |

Counselor 登录后的身份应为：

```json
{
  "role": "USER",
  "level": "COUNSELLOR"
}
```

所有业务请求必须携带：

```http
Authorization: Bearer {accessToken}
```

收到 HTTP `401` 时，前端应清除当前登录态并重新登录。当前 Counselor Parent Link GET 对缺失、无效或过期 token 的合同码是 `INVALID_TOKEN`；前端仍应同时判断 HTTP status，不能只依赖 `message`。

联调账号由后端负责人单独提供，不要把密码写入前端仓库、日志或提交记录。

## 3. Counselor 能力范围

Counselor 的主业务流是：

```text
创建 Student 账号和 OPEN Intake
→ 查看自己的未分配队列
→ 补充或修改 Intake
→ 可选：创建/复用/关联 Parent
→ 查看可选 Advisor
→ 完成首次分配
→ Counselor 立即失去该 Intake 的访问权
→ 当前 Advisor 接管
```

Counselor 可以：

- 创建本租户的 `USER + STUDENT` 账号和 `OPEN + UNASSIGNED` Intake。
- 查看本人创建、仍为 `OPEN + UNASSIGNED` 的 Intake。
- 在首次分配前修改学生结构化姓名和 Intake 资料。
- 在首次分配前读取当前 Intake 的 active Parent Links，并创建或复用 Parent、建立/解除 Parent–Student Link。
- 查看本租户可用的 `ADVISOR` 和 `INSTRUCTOR_ADVISOR`。
- 完成第一次 Advisor 分配。
- 查看本人创建、已分配和未分配的 Dashboard 计数。

Counselor 不可以：

- 取消 Intake。
- 修改 Student email。
- 改派 Advisor。
- 查看已经完成交接的 Intake 详情。
- 管理 Profile、Study Plan、Risk、Course、Assignment、Report 或 Mock Exam。
- 管理账号状态或身份。
- 搜索全部租户用户、批量导入或批量分配。

取消 Intake、改派和账号治理属于 `TENANT_ADMIN`；Profile、Study Plan 和后续学习干预属于当前 Advisor。

## 4. API 清单

### 4.1 Intake 与 Dashboard

| Method | Path | operationId | 用途 |
|---|---|---|---|
| `POST` | `/v2/counsellor/student-intakes` | `counsellorCreateStudentIntake` | 创建 Student 和 Intake |
| `GET` | `/v2/counsellor/student-intakes` | `counsellorListStudentIntakes` | 未分配队列 |
| `GET` | `/v2/counsellor/student-intakes/{intakeId}` | `counsellorGetStudentIntake` | 未分配 Intake 详情 |
| `PATCH` | `/v2/counsellor/student-intakes/{intakeId}` | `counsellorPatchStudentIntake` | 修改未分配 Intake |
| `GET` | `/v2/counsellor/dashboard` | `counsellorGetDashboard` | Dashboard 计数 |

### 4.2 Advisor 首次分配

| Method | Path | operationId | 用途 |
|---|---|---|---|
| `GET` | `/v2/counsellor/advisors` | `counsellorListAdvisors` | 查看本租户可选 Advisor |
| `PUT` | `/v2/counsellor/student-intakes/{intakeId}/advisor` | `counsellorAssignAdvisor` | 首次分配 Advisor |

### 4.3 Parent Link

| Method | Path | operationId | 用途 |
|---|---|---|---|
| `GET` | `/v2/counsellor/student-intakes/{intakeId}/parent-links` | `counsellorListParentLinks` | 读取当前 Intake 的 active Parent Links |
| `POST` | `/v2/counsellor/student-intakes/{intakeId}/parent-links` | `counsellorCreateOrReuseParentLink` | 按 email 创建或复用 Parent 并关联 |
| `PUT` | `/v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}` | `counsellorLinkExistingParent` | 关联已有 Parent |
| `DELETE` | `/v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}` | `counsellorUnlinkParent` | 解除 Parent 关联 |

Counselor 刷新或重新进入本人仍持有的 `OPEN + UNASSIGNED` Intake 时，使用 GET 读取当前 active Parent Links。无 active link 时返回 HTTP `200` 且 `data=[]`。GET 不需要 `Idempotency-Key`。当前仍没有 Parent Directory / Search；已知 `parentUserId` 才能调用 PUT 关联已有 Parent，不要调用 Tenant Admin 或 Advisor 接口绕过。

### 4.4 交接后的后端能力

以下接口属于 Advisor，不是 Counselor 页面接口，仅用于理解交接结果：

| Method | Path | operationId |
|---|---|---|
| `GET` | `/v2/advisor/students` | `advisorListStudents` |
| `GET` | `/v2/advisor/students/{studentUserId}/intake` | `advisorGetStudentIntake` |

## 5. 通用协议

### 5.1 响应信封

成功响应使用：

```json
{
  "status": 200,
  "code": "SUCCESS",
  "data": {},
  "message": null,
  "timestamp": "2026-09-01T00:00:00Z"
}
```

前端同时判断 HTTP status 和 `code`，不要只判断 `message`。

### 5.2 分页

Intake 和 Advisor 列表使用 zero-based 分页：

```http
GET {base}/v2/counsellor/student-intakes?page=0&size=20
GET {base}/v2/counsellor/advisors?page=0&size=20
```

约束：

- `page`：默认 `0`，最小 `0`
- `size`：默认 `20`，范围 `1..100`

分页数据：

```json
{
  "page": 0,
  "size": 20,
  "total": 1,
  "items": []
}
```

### 5.3 Idempotency-Key

以下 mutation 必须携带唯一的 `Idempotency-Key`，最长 128 字符：

- 创建 Intake
- Patch Intake
- 首次分配 Advisor
- 创建或复用 Parent Link
- 关联已有 Parent
- 解除 Parent Link
- 学生 Password Reset

```http
Idempotency-Key: {one-business-action-one-key}
```

规则：

- 网络超时后重试同一个业务动作，应重用同一个 key 和同一个 request body。
- 同一个 key 配合不同 body 会返回 `409 IDEMPOTENCY_KEY_MISMATCH`。
- 新的业务动作必须生成新的 key。

## 6. 创建 Student 与 Intake

```http
POST {base}/v2/counsellor/student-intakes
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "firstName": "Alex",
  "middleName": null,
  "lastName": "Chen",
  "email": "alex.chen@example.com",
  "studentType": "STANDARD",
  "courseRequest": "Need writing support",
  "contactPhone": "+1-555-0100",
  "basicBackground": "Transfer student"
}
```

字段规则：

| 字段 | 必填 | 规则 |
|---|---|---|
| `firstName` | 是 | trim 后 1..100 |
| `middleName` | 否 | 最大 100 |
| `lastName` | 是 | trim 后 1..100 |
| `email` | 是 | 最大 255；创建后不可由 Counselor 修改 |
| `studentType` | 是 | `VIP` 或 `STANDARD` |
| `courseRequest` | 是 | trim 后 1..2000 |
| `contactPhone` | 否 | 7..64 |
| `basicBackground` | 否 | 最大 4000 |

不要发送以下字段：

- `name`：legacy 字段，非空会被拒绝。
- `role`
- `level`
- `tenantId`
- `password`

系统固定创建当前租户的 `role=USER`、`level=STUDENT` 账号。

成功返回 HTTP `201`。关键响应字段：

```json
{
  "intakeId": 12,
  "studentUserId": 561,
  "firstName": "Alex",
  "middleName": null,
  "lastName": "Chen",
  "email": "alex.chen@example.com",
  "lifecycleStatus": "OPEN",
  "assignmentStatus": "UNASSIGNED",
  "intakeVersion": 0,
  "activationMethod": "PASSWORD_RESET",
  "advisorUserId": null,
  "assignmentVersion": null
}
```

常见错误：

- `400 PARAM_MISSING` / `BAD_REQUEST`：字段缺失或格式错误。
- `409 USER_ALREADY_EXISTS`：email 已存在，Student 和 Intake 均不会重复创建。
- `409 IDEMPOTENCY_KEY_MISMATCH`：同 key 的请求内容发生变化。

## 7. 未分配队列与详情

Counselor 只能读取同时满足以下条件的 Intake：

- 当前租户。
- 当前 Counselor 创建。
- `lifecycleStatus=OPEN`。
- 当前没有 Advisor assignment。

列表只返回上述未分配记录。已分配、他人创建或跨租户的 Intake 都不会泄漏。

```http
GET {base}/v2/counsellor/student-intakes?page=0&size=20
GET {base}/v2/counsellor/student-intakes/{intakeId}
```

不可见记录统一返回：

```text
404 STUDENT_INTAKE_NOT_FOUND
```

前端不要通过错误差异判断该 Intake 是不存在、属于他人、跨租户还是已经完成交接。

## 8. 修改未分配 Intake

```http
PATCH {base}/v2/counsellor/student-intakes/{intakeId}
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "expectedIntakeVersion": 0,
  "firstName": "Alexandra",
  "middleName": "Marie",
  "lastName": "Chen",
  "courseRequest": "Need writing and speaking support"
}
```

`expectedIntakeVersion` 必填，并且至少提供一个实际修改字段：

- `firstName`
- `middleName`
- `lastName`
- `studentType`
- `courseRequest`
- `contactPhone`
- `basicBackground`

不要发送 `name`、`email`、`role`、`level` 或 `tenantId`。

成功后 `intakeVersion + 1`。空 Patch 返回 `400 BAD_REQUEST`。

版本冲突返回：

```text
409 STUDENT_INTAKE_VERSION_CONFLICT
```

前端应重新 GET 最新 Intake，展示最新数据后再由用户重试；不要在浏览器中自行猜测或递增 version。

## 9. Parent Link

Parent Link 只能在 Counselor 仍拥有该 `OPEN + UNASSIGNED` Intake 时操作。首次分配 Advisor 后，GET 与三个 Counselor Parent Link mutation 都不再可用。

页面流程：进入或刷新 Intake 时先 GET；create/reuse、link、unlink 成功后再 GET 刷新。不要依赖前端本地缓存拼出列表。

### 9.1 读取当前 active Parent Links

```http
GET {base}/v2/counsellor/student-intakes/{intakeId}/parent-links
Authorization: Bearer {accessToken}
```

成功返回 HTTP `200`，`data` 为 `ParentStudentLinkResponse[]`，不分页。只包含 `unlinked_at IS NULL` 的 active links，顺序为 `linkedAt ASC, linkId ASC`。空列表是正常成功结果，不是 404。

允许字段：

- `linkId`
- `parentUserId`
- `studentUserId`
- `parentFirstName`
- `parentMiddleName`
- `parentLastName`
- `parentEmail`
- `linkedAt`

不要读取 `name`、`displayName`、`visibleAfterMessageId` 或 unlink 元数据。

不可见、他人持有、跨租户、不存在或已交接的 Intake 统一返回 `404 STUDENT_INTAKE_NOT_FOUND`。

### 9.2 按 email 创建或复用 Parent

```http
POST {base}/v2/counsellor/student-intakes/{intakeId}/parent-links
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "email": "parent@example.com",
  "firstName": "Taylor",
  "middleName": null,
  "lastName": "Chen",
  "reason": "Guardian confirmed during intake"
}
```

行为：

- email 不存在：创建当前租户的 `USER + PARENT`，然后关联 Student。
- email 已属于当前租户的 active Parent：复用该 Parent 并关联 Student。
- email 属于其他身份、不可复用账号或不符合租户边界：返回 404/409，不泄漏跨租户信息。
- 已存在同一 active link：返回已有 link，不重复创建。

创建新 Parent 时 `firstName` 和 `lastName` 必填；`middleName` 可选。复用已有 Parent 时，后端使用已有账号姓名。不要发送 legacy `name`。

关键响应字段：

```json
{
  "linkId": 10,
  "parentUserId": 557,
  "studentUserId": 561,
  "parentFirstName": "Taylor",
  "parentMiddleName": null,
  "parentLastName": "Chen",
  "parentEmail": "parent@example.com",
  "linkedAt": "2026-09-01T00:00:00"
}
```

### 9.3 关联已有 Parent

前端已经持有当前租户 Parent 的 `parentUserId` 时，可以调用：

```http
PUT {base}/v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "reason": "Guardian relationship verified"
}
```

当前 Counselor API 不提供 Parent Directory/Search。前端不能为了获得 `parentUserId` 而调用 `TENANT_ADMIN` 用户目录。

### 9.4 解除 Parent 关联

```http
DELETE {base}/v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "reason": "Relationship no longer authorized"
}
```

`reason` 可选，最大 1000 字符。

### 9.5 当前前端限制

当前仍没有 Counselor Parent Directory / Search。前端不能为了获得 `parentUserId` 而搜索全部用户或调用 Tenant Admin 用户目录。已知 `parentUserId` 时才能调用 PUT 关联已有 Parent；刷新列表只使用本节的 GET。

## 10. Advisor 目录与首次分配

### 10.1 Advisor 目录

```http
GET {base}/v2/counsellor/advisors?page=0&size=20
```

仅返回当前租户中 `ACTIVE` 的：

- `ADVISOR`
- `INSTRUCTOR_ADVISOR`

姓名字段是：

- `firstName`
- `middleName`
- `lastName`

不要读取旧的 `name` 或 `displayName`。

### 10.2 首次分配

```http
PUT {base}/v2/counsellor/student-intakes/{intakeId}/advisor
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "advisorUserId": 88,
  "expectedIntakeVersion": 1
}
```

成功返回 HTTP `200`：

```json
{
  "assignmentStatus": "ASSIGNED",
  "advisorUserId": 88,
  "assignmentVersion": 0,
  "intakeVersion": 1
}
```

常见错误：

- `404 STUDENT_INTAKE_NOT_FOUND`：Intake 已交接、不可见或不属于当前 Counselor。
- `404 NOT_FOUND`：目标 Advisor 不存在或跨租户。
- `409 STUDENT_NOT_ELIGIBLE`：Student 已停用或身份不合格。
- `409 ADVISOR_NOT_ELIGIBLE`：同租户目标用户不是 active Advisor。
- `409 STUDENT_ALREADY_ASSIGNED`：已经存在 assignment。
- `409 STUDENT_INTAKE_VERSION_CONFLICT`：Intake version 已变化。
- `409 IDEMPOTENCY_KEY_MISMATCH`：同 key 的请求内容变化。

## 11. 交接语义

首次分配成功后：

- Counselor 再 GET 或 PATCH 同一 Intake：`404 STUDENT_INTAKE_NOT_FOUND`。
- Counselor 不再能通过该 Intake 读取或修改 Parent Link。
- 该 Intake 应立即从 Counselor 未分配列表移除。
- Dashboard 的 `assignedCount` 增加，`unassignedCount` 减少。
- 当前 Advisor 可以在 Advisor 学生队列中看到 Student 并读取 Intake snapshot。
- 其他 Advisor 和跨租户用户不能读取该 Intake。

这是同步权限交接，不是缓存或最终一致性延迟。前端成功分配后应立即关闭编辑页并从列表移除记录，不要循环 GET 等待它重新出现。

竞态规则：

- Patch 先成功：旧 version 的 Assign 返回 `409 STUDENT_INTAKE_VERSION_CONFLICT`。
- Assign 先成功：后续 Patch 返回 `404 STUDENT_INTAKE_NOT_FOUND`。

## 12. Dashboard

```http
GET {base}/v2/counsellor/dashboard
```

| 字段 | 含义 |
|---|---|
| `createdCount` | 当前 Counselor 创建的全部 Intake，包括已分配或已取消记录 |
| `assignedCount` | 当前 Counselor 创建且当前存在 Advisor assignment 的 Student 数 |
| `unassignedCount` | 当前 Counselor 创建、`OPEN` 且当前没有 assignment 的 Intake 数 |

不要假设：

```text
createdCount = assignedCount + unassignedCount
```

因为取消记录只进入 `createdCount`。Counselor 当前没有取消 API，但 `TENANT_ADMIN` 可以取消未分配 Intake。

## 13. Student 与 Parent 首次设密

Counselor 创建 Student 或新 Parent 后：

- 后端不返回临时密码。
- 后端不要求前端展示密码。
- 当前流程不自动发送邀请邮件。
- Counselor 通过系统外渠道通知用户账号已经创建。
- 用户使用现有 Password Reset 完成首次设密。

流程：

1. `POST /v1/auth/email-verifications/reset?email={email}`
2. 用户从 email 获取验证码。
3. `POST /v1/auth/password-resets`，body 包含 `email`、`verificationCode`、`newPassword`，并带 `Idempotency-Key`。
4. `POST /v1/auth/login`。

Student 登录身份：

```json
{
  "role": "USER",
  "level": "STUDENT"
}
```

Parent 登录身份：

```json
{
  "role": "USER",
  "level": "PARENT"
}
```

## 14. 权限与隐藏矩阵

| 场景 | 结果 |
|---|---|
| 缺失、无效或过期 token | `401 INVALID_TOKEN` |
| 普通非 Counselor USER 调 Counselor API | `403 FORBIDDEN` |
| `TENANT_ADMIN` 调 Counselor Parent Link GET | `403 ACCESS_DENIED` |
| 当前 Counselor 读取本人 OPEN + UNASSIGNED Intake | HTTP `200` |
| 他人、跨租户、已分配或不可见 Intake | `404 STUDENT_INTAKE_NOT_FOUND` |
| 分配后 Counselor 再读或修改 | `404 STUDENT_INTAKE_NOT_FOUND` |
| Counselor 选择跨租户 Advisor | HTTP `404` |
| Counselor 选择同租户但不合格 Advisor | `409 ADVISOR_NOT_ELIGIBLE` |
| 当前 Advisor 接管后读取 Intake | HTTP `200` |
| 其他 Advisor 读取 Intake | HTTP `404` |
| Counselor 调 Tenant Admin / Advisor 专属治理接口 | HTTP `403` 或隐藏式 `404`，取决于接口围栏 |

前端不要通过 404 判断资源是否真实存在，也不要向用户显示其他租户或其他 Counselor 的资源信息。

## 15. 页面实现建议

建议页面拆分：

1. Counselor Dashboard。
2. 未分配 Intake 列表。
3. 创建 Student Intake。
4. Intake 详情与修改。
5. Parent Link 操作区：进入或刷新时先 GET，create/reuse/link/unlink 后再 GET 刷新。
6. Advisor 选择与首次分配确认。

前端必须遵守：

- 全部人员姓名使用 `firstName`、`middleName`、`lastName` 组合展示。
- 不发送 legacy `name` / `displayName`。
- 不在创建 Student 表单展示 `role`、`level`、`tenantId` 或 password。
- email 创建后设为只读。
- 保存成功后使用响应中的最新 `intakeVersion` 覆盖本地值。
- 分配成功后立即从未分配列表移除记录并离开编辑页。
- 409 version conflict 必须重新拉取，不自动覆盖服务端数据。
- 不实现 Counselor 侧取消、改派、已分配详情、全局用户搜索或批量操作。

## 16. 当前交付边界

本说明覆盖 Counselor 后端当前可用的完整前端业务范围：

```text
Dashboard
+ 创建 Student / Intake
+ 未分配 Intake 列表与详情
+ 修改 Intake
+ Parent Link GET / create-or-reuse / link / unlink
+ Advisor 目录
+ 首次分配
+ 交接后的权限隐藏
+ Student / Parent 首次设密说明
```

以下需求如果进入前端设计，需要先补后端合同，不能由前端自行拼接其他角色 API：

- Counselor Parent 搜索/目录。
- Counselor 已分配历史详情。
- Counselor 取消或改派。
- Counselor 批量导入、搜索或批量分配。

## 17. 当前验证状态

### 17.1 Counselor Parent Link Read

| 项目 | 状态 |
|---|---|
| Controller / Service 实现 | `PASS` |
| `docs/api/parent.openapi.yaml` 合同 | `PASS` |
| Targeted tests | `PASS` |
| Local API smoke | `PASS` |
| Course OpenAPI snapshot static Gate | `PASS` |
| 完整 `mvn clean verify` | `FULL_VERIFY_DEFERRED` |
| `COUNSELLOR_PARENT_LINK_READ_GATE_PASS` | 尚未授予 |

本地 smoke 已证明：空 active-link 列表返回 `200 SUCCESS` 和 `data=[]`；创建 Link 后刷新可读回；其他 Counselor、跨租户或不可见 Intake 返回 `404 STUDENT_INTAKE_NOT_FOUND`；首次分配 Advisor 后原 Counselor 立即失去 Parent Link GET 权限。

因此，前端可以按照本文档开始 Counselor Parent Link 联调。当前未授予最终 Gate 的唯一原因是完整 `mvn clean verify` 尚未在 OpenAPI snapshot 对齐后重新执行，不代表 Parent Link GET 存在已知业务失败。最终 Release/Promotion 仍应以之后的完整 Maven Gate 和目标环境验收为准。
