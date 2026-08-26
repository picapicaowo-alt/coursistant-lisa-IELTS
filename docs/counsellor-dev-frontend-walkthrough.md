# Counselor Intake：Dev 前端联调走查

Dev 上 Intake / Profile / 课程编排写开关都已打开。本文只带前端走完 **Counselor Intake 主流程**。契约：`docs/api/counsellor.openapi.yaml`。规则与字段说明见 `docs/counsellor-frontend-handoff.md`。

## 环境

| 项 | 值 |
|---|---|
| Base | `https://dev.xlearnedu.com:8083/api` |
| 健康检查 | `GET {base}/v1` → 200 |
| 登录 | `POST {base}/v1/auth/login` |
| Counselor / Advisor 登录 role | 一律 `USER` |

开始前向后端要 Dev 的 `COUNSELLOR` 和至少一个 `ADVISOR`（或 `INSTRUCTOR_ADVISOR`）账号。**不要把密码写进前端仓库。**

每次联调用一个唯一后缀（例如时间戳）拼进学生邮箱和所有 `Idempotency-Key`，避免和别人撞车。

```text
runId = 20260825-fe-01
studentEmail = alex.20260825-fe-01@example.com
```

## 页面怎么对接口

建议 4 个 Counselor 页面 + 1 个 Advisor 只读页。不要做取消、改派、已分配详情。

| 页面 | 接口 |
|---|---|
| 登录 | `POST /v1/auth/login` |
| Dashboard | `GET /v2/counsellor/dashboard` |
| 未分配列表 | `GET /v2/counsellor/student-intakes` |
| 新建 / 编辑 Intake | `POST` / `GET` / `PATCH /v2/counsellor/student-intakes` |
| 选 Advisor 并分配 | `GET /v2/counsellor/advisors` + `PUT .../advisor` |
| Advisor 学生列表 / Intake | `GET /v2/advisor/students` + `GET /v2/advisor/students/{studentUserId}/intake` |

所有 Counselor / Advisor 请求带 `Authorization: Bearer {accessToken}`。写接口必须带 `Idempotency-Key`（最长 128）。

---

## 第 0 步：登录 Counselor

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "<dev-counsellor-email>",
  "password": "<from-backend>",
  "role": "USER"
}
```

期望：`200`，`data.accessToken`，`data.level=COUNSELLOR`。

用学生或老师 token 打下面任意 Counselor 接口，应是 `403 FORBIDDEN`。

---

## 第 1 步：看 Dashboard 基线

进入 Counselor 首页，先拉一次计数，记下来。

```http
GET /api/v2/counsellor/dashboard
Authorization: Bearer {counsellorToken}
```

期望：`200`，`data` 只有三个 `int64`：

| 字段 | 含义 |
|---|---|
| `createdCount` | 本人创建过的全部 Intake，含已分配、已取消 |
| `assignedCount` | 本人创建且当前有 assignment |
| `unassignedCount` | 本人创建、`OPEN`、还没有 assignment |

不要假设三者相加相等。Dashboard **不**返回学生列表。

---

## 第 2 步：建学生 + OPEN Intake

表单只收业务字段。不要放 `role`、`level`、`tenantId`。

```http
POST /api/v2/counsellor/student-intakes
Authorization: Bearer {counsellorToken}
Idempotency-Key: create-{runId}
Content-Type: application/json

{
  "name": "Alex Chen",
  "email": "alex.{runId}@example.com",
  "studentType": "STANDARD",
  "courseRequest": "Need writing support",
  "contactPhone": "+1-555-0100",
  "basicBackground": "Transfer student"
}
```

`studentType` 只能是 `VIP` 或 `STANDARD`。`courseRequest` 必填。

期望：`HTTP 201`，`status=201`，`code=SUCCESS`。

前端立刻保存：

- `intakeId`
- `studentUserId`
- `intakeVersion`（应为 `0`）
- `lifecycleStatus=OPEN`
- `assignmentStatus=UNASSIGNED`
- `activationMethod=PASSWORD_RESET`

检查：响应里没有 `password`。重复点提交要用**同一个** `Idempotency-Key`，应回放同一条 201，不要再插一条。

再拉 Dashboard：`createdCount + 1`，`unassignedCount + 1`，`assignedCount` 不变。

再拉列表：`GET /v2/counsellor/student-intakes?page=0&size=20`，新行应在 `data.items` 里。

---

## 第 3 步：补资料（含改 name）

打开该 Intake 详情：

```http
GET /api/v2/counsellor/student-intakes/{intakeId}
```

期望：`200`。把返回的 `intakeVersion` 原样带进 Patch，不要自己 +1。

```http
PATCH /api/v2/counsellor/student-intakes/{intakeId}
Authorization: Bearer {counsellorToken}
Idempotency-Key: patch-name-{runId}
Content-Type: application/json

{
  "expectedIntakeVersion": 0,
  "name": "Alexandra Chen"
}
```

还可以同时改 `studentType`、`courseRequest`、`contactPhone`、`basicBackground`。只带 `expectedIntakeVersion` 是 `400 BAD_REQUEST`。

期望：`200`，`name` 已变，`intakeVersion` 变成 `1`。用新 version 覆盖本地。

邮箱创建后不能改。错误邮箱走 Tenant Admin 取消后重开，Counselor 不做这件事。

`409 STUDENT_INTAKE_VERSION_CONFLICT`：重新 GET，再用新 version 重试。

---

## 第 4 步：选 Advisor

```http
GET /api/v2/counsellor/advisors?page=0&size=20
```

期望：`200`，`items[]` 里是本租户 `ACTIVE` 的 `ADVISOR` 或 `INSTRUCTOR_ADVISOR`。每项有 `advisorUserId`、`name`、`email`、`level`。

空列表说明这个租户还没有 Advisor，停在这里找后端配账号，不要硬编码 id。

---

## 第 5 步：首次分配

```http
PUT /api/v2/counsellor/student-intakes/{intakeId}/advisor
Authorization: Bearer {counsellorToken}
Idempotency-Key: assign-{runId}
Content-Type: application/json

{
  "advisorUserId": 88,
  "expectedIntakeVersion": 1
}
```

`expectedIntakeVersion` 必须是第 3 步之后的当前值。

期望：`200`，`assignmentStatus=ASSIGNED`，`assignmentVersion=0`，`advisorUserId` 为所选人。

同一 key 再点一次应回放 200，不要当第二次分配。

常见 409：

| code | 前端怎么处理 |
|---|---|
| `STUDENT_INTAKE_VERSION_CONFLICT` | GET 最新 version 再分配 |
| `STUDENT_ALREADY_ASSIGNED` | 当已交接：踢出列表，不要再改 |
| `ADVISOR_NOT_ELIGIBLE` | 重新拉 Advisor 列表 |
| `IDEMPOTENCY_KEY_MISMATCH` | 换新 key，或按第一次的 body 重试 |
| `ADVISING_FEATURE_DISABLED` | 提示环境未开写（Dev 不应出现） |

---

## 第 6 步：Counselor 立刻失去访问权

分配成功后 **马上**：

1. 从未分配列表删掉这一行，不要再 GET 等它“消失”。
2. 再 GET / PATCH 同一 `intakeId`，期望都是 `404 STUDENT_INTAKE_NOT_FOUND`。这是交接，不是缓存延迟。
3. Dashboard：`createdCount` 不变，`assignedCount + 1`，`unassignedCount - 1`。

Counselor 本轮不能看已分配详情，不要做“分配成功仍留在编辑页”。

---

## 第 7 步：Advisor 接管

退出 Counselor，用 Advisor 账号登录，`role` 仍是 `USER`。

```http
GET /api/v2/advisor/students?page=0&size=20
```

期望：`200`，能看到刚才的 `studentUserId`。

```http
GET /api/v2/advisor/students/{studentUserId}/intake
```

期望：`200`，`name` 是改过的名字，`assignmentStatus=ASSIGNED`。

换另一个 Advisor 打同一条，期望 `404`。Counselor token 打 Advisor 接口期望 `403`。

Advisor 的 Profile / Study Plan 不在这次 Intake 联调范围。

---

## 第 8 步：学生找回密码并登录

后端不发邀请、不回临时密码。Counselor 用系统外渠道把邮箱告诉学生。

1. `POST /api/v1/auth/email-verifications/reset?email={studentEmail}`
2. 学生从邮件拿 6 位验证码
3. `POST /api/v1/auth/password-resets`  
   Header：`Idempotency-Key`  
   Body：`email`、`verificationCode`、`newPassword`（至少 8 位，含字母和数字）
4. `POST /api/v1/auth/login`，`role=USER`，用新密码

期望：登录 `200`。重置前如果误拿到会话去打业务 API，会是 `403 PASSWORD_CHANGE_REQUIRED`。

联调若用不了真实邮箱，让后端从 Dev 邮件/日志取验证码，不要在前端写死码。

---

## 建议点一次的验收清单

- [ ] Counselor 登录后 Dashboard 三个数都是数字
- [ ] 创建 201，列表出现，Dashboard 未分配 +1
- [ ] 改 name 200，version +1
- [ ] Advisor 列表非空，分配 200
- [ ] Counselor 再进详情 404，列表没了
- [ ] Advisor 能看到该学生 Intake
- [ ] 其他 Advisor 404
- [ ] 创建响应没有密码
- [ ] 重复提交同一 Idempotency-Key 不产生第二条学生
- [ ] 学生找回密码后能登录

## 不要做

- Counselor 取消、改派、看已分配详情
- 创建表单传 role / level / tenant
- 分配后轮询 GET 等 200
- 把 Dev 密码写进前端仓库
- 对 Prod 用这套 Dev 账号
