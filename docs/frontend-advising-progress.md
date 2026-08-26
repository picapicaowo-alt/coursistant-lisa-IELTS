# 教培前端进度（对照后端主流程）

仓库：`coursistant-lisa-IELTS`。对照后端当前说明：Counselor 招生交接、Advisor 建档与学习计划、Advisor 课程编排。

**当前准确口径：本地 Vite `/api` 和 IELTS Dev 8085 均连接 Dev advising LMS `https://dev.xlearnedu.com:8083`。Counselor / Advisor Core 已用 Dev fixture 账号走通；Tenant 只读与改派连续性也已验证。8084 保留给 USC LMS，不能部署本仓库。课程编排前端未接线。**

当前仍不能对外说「全部联调完成」：A/B 和 Tenant 主流程已点通，但新学生本人读取同一 aggregate 仍待验证码，Promotion C 也尚未授权接线。

契约：`docs/api/counsellor.openapi.yaml`、`docs/api/advising.openapi.yaml`。
走查步骤：`docs/counsellor-dev-frontend-walkthrough.md`、`docs/advisor-frontend-handoff.md`。

---

## 当前准确状态

| 模块 | 后端状态（对方口径） | 前端状态 | Dev 联调 |
|---|---|---|---|
| Counselor Intake 主流程 | 已部署到 8083 | **页面已完成，代理已打 8083** | **通过**：创建 → 补资料 → 首次分配 → Counselor 立即 404 |
| Advisor Profile / Study Plan | 已部署到 8083，B 写开关已开 | **页面已完成** | **通过**：接管、Profile/Plan 创建更新、revision |
| Student / TENANT_ADMIN 只读 | 已部署到 8083 | **页面已完成**（含 Tenant revisions） | Tenant 同 aggregate 通过；Student fixture 空态通过，新学生首次设密待验证码 |
| TENANT_ADMIN 取消 / 首派 / 改派 | 已部署到 8083 | **页面已完成** | 改派连续性通过；取消/首派未对共享数据执行破坏性点验 |
| Advisor Course Orchestration | 对方说本地完成；8083 OpenAPI **已有** Group/1-on-1/READY/PUBLISH | **前端未接线** | 不开始 |
| Instructor → 考试 → 报告 → 持续干预 | 后续阶段 | 不做 | — |

### Dev 端口（2026-08-26 探活）

| 端口 | OpenAPI | Counsellor / Advisor path |
|---|---|---|
| `https://dev.xlearnedu.com:8081/api` | LMS API，150 paths | **没有**。无 token 打 `/v2/counsellor/**` 是 401，登录后预期 404 |
| `https://dev.xlearnedu.com:8083/api` | LMS API，183 paths | **有完整 A/B/C**：Intake、Advisor 队列/Profile/Plan、Tenant、Course orchestration、Instructor context |

前端本地 Vite `/api` **已改打 8083**（`.env.development` 的 `VITE_BASE_PORT=8083`）。8083 原先也是 AI Workflow 占位；现在以 advising LMS 为准，Workflow 需另给端口。

公开 `https://dev.xlearnedu.com:8085/api/v3/api-docs` 返回 183 paths，并包含 `/v2/counsellor/student-intakes`。8085 使用独立 PM2 静态服务，`/api` upstream 是 8083，代理边界不转发浏览器的 `Origin` 请求头。

### Dev 实测（2026-08-26）

联调标识：`fe-20260826-103730`。只记录非敏感实体 ID；fixture 密码不进仓库。

- Counselor Dashboard：`2/1/1` → 创建后 `3/1/2` → 分配后 `3/2/1`
- 创建 Intake：HTTP 201，`intakeId=3`、`studentUserId=448`、`intakeVersion=0`，响应无 password
- Patch：HTTP 200，`intakeVersion=1`
- 首次分配 Advisor：HTTP 200，`assignmentVersion=0`；Counselor 再读立即 `404 STUDENT_INTAKE_NOT_FOUND`
- Advisor Profile：创建 201、更新 200，`profileId=1`、version `0 → 1`
- Study Plan：创建 201、更新 200，`studyPlanId=1`、version `0 → 2`、`basedOnProfileVersion=1`
- Tenant 改派：HTTP 200，assignment version `0 → 1`；旧 Advisor 立即 404，新 Advisor 读取同一 Profile/Plan 与 child IDs
- Tenant 读响应不含 `advisorPrivateNotes`；revision 列表 v0/v1/v2 正常
- 跨租户 Counselor 读该 Intake 为 404；Counselor 调 Advisor 能力为 403
- `INSTRUCTOR_ADVISOR` 登录后正确进入 Advisor queue

本轮修复了 Vite `/api` 代理转发本地 Origin 导致登录 403，以及确定性 Advisor 404 的多余重试；Tenant revision metadata 也已补到页面。

后端观察项：Intake 创建响应的 `activationMethod` 实测为 `null`，走查说明预期 `PASSWORD_RESET`。前端不伪造该字段，交由后端确认。

完整前端基线通过：`lint:ci`、`typecheck`、`typecheck:production`、95 个 Vitest 文件 / 394 条测试、production build、3 条 Playwright E2E。

---

## 一、Counselor（前端已接）

与后端能力对齐。Counselor **不能**取消 Intake、不能改派、不能看已交接详情。

### 1. 创建学生账号和 Intake

页面：`/counsellor/intakes/new` → `POST /v2/counsellor/student-intakes`

Counselor 填写：姓名、邮箱、Student Type、Course Request、联系电话、Basic Background。
不传 `role` / `level` / `tenantId`。写请求带 `Idempotency-Key`。不展示、不保存初始密码。学生走现有找回密码：`POST /v1/auth/password-resets`。

### 2. 管理自己的未分配 Intake

- 列表 `/counsellor/intakes` → `GET /v2/counsellor/student-intakes`
- 详情/修改 `/counsellor/intakes/:intakeId` → `GET` + `PATCH`，带 `expectedIntakeVersion`
- 分配成功后立刻离开；再读同一 Intake 按 404 处理，不当缓存延迟

### 3. Dashboard

`/counsellor` → `GET /v2/counsellor/dashboard`：`createdCount` / `assignedCount` / `unassignedCount`。不把三者相加当校验。

### 4. 查看可选 Advisor

分配页 → `GET /v2/counsellor/advisors`。只展示本租户有效 `ADVISOR` / `INSTRUCTOR_ADVISOR`。

### 5. 首次分配 Advisor

`PUT /v2/counsellor/student-intakes/{id}/advisor`。成功后踢出未分配队列。取消/改派只在 Tenant 页。

### Counselor 业务流（前端对应）

创建 OPEN Intake → 学生找回密码首次设密（沿用现有页）→ 补资料 → 看本租户 Advisor → 首次分配 → Counselor 失去访问权 → Advisor 接管（Dev 已验证）

---

## 二、Advisor Core（前端已接，Dev 已联调）

页面已按合同写好，Dev 上 `/v2/advisor/**` 的 A/B 主流程已实际点通。

### 1. 学生工作队列

`/advisor/students` → `GET /v2/advisor/students`。登录分流：`ADVISOR` / `INSTRUCTOR_ADVISOR` → 此页。

### 2. 查看招生 Intake

`/advisor/students/:id/intake` 只读。404 按「不可见」处理，不暗示学生是否存在。

### 3. Student Profile

`/advisor/students/:id/profile`：创建 / 查看 / 更新、技能、`advisorPrivateNotes`、`profileVersion`。
`advisorPrivateNotes` **只画在本页**。学生页、Tenant 页若响应里出现该字段会显示泄漏告警。

### 4. Study Plan

`/advisor/students/:id/study-plan`：创建 / 更新、Timeline / Checkpoints / Tasks、revisions、`studyPlanVersion`、`basedOnProfileVersion`。无私有 Profile 时按 `409 STUDENT_PROFILE_REQUIRED` 提示。

### 5. Student 和 TENANT_ADMIN 只读

| 谁 | 路由 | 接口 | 备注 |
|---|---|---|---|
| 学生 | `/my-plan` | `GET /v2/student/profile`、`GET /v2/student/study-plan` | 登录后仍先到 LMS `/`，侧栏进计划 |
| TENANT_ADMIN | `/admin/students/:id` | Profile + Study Plan | revisions 已展示，只读 immutable metadata |
| TENANT_ADMIN | `/admin/intakes` | 列表、取消、首派、改派 | Advisor 候选没有 Tenant 列表接口，手填 `advisorUserId`（Counselor 的 advisors 接口 Tenant 会 403） |

### 6. 改派连续性

Tenant 改派后前端立刻刷新 Advisor 队列。资料不复制、ID/version 不变——这是后端保证；前端按 404 / 新队列展示。

### Advisor Core 业务流（前端对应）

接收分配 → 队列看到学生 → 看 Intake → 建 Profile（含私密备注）→ 建 Study Plan → 学生 `/my-plan` 只读 → 持续更新 → 改派后新 Advisor 维护同一份资料

**以上 A/B 与 Tenant 主流程均已在 Dev 实际点验。**

---

## 三、Advisor Course Orchestration（前端未做）

后端本地已验收 Group / 1-on-1 / READY / PUBLISH / reconfirm / Instructor 最小上下文。

前端：**零调用**。不接 `advisorListStudentCourses`、group link/withdraw、1-on-1 create/instructor/sessions、READY、PUBLISH、reconfirm、tenant delivery config、`instructorGetStudentProfileContext`。

原因：仓库约定 Promotion C 授权前不接线；即使 8083 OpenAPI 已公开相关契约，前端也不提前实现。

Advisor Course 业务流前端 **尚未开始**。

---

## 四、当前版本还不包含（前后端一致）

与后端「不属于已经完成的 Counselor/Advisor 范围」对齐，前端同样没有：

- 自动发送学生邀请邮件
- Counselor 取消 Intake
- Counselor 改派 Advisor
- Counselor 查看已交接学生详情
- 批量导入学生
- Counselor/Advisor 搜索
- Advisor Dashboard
- 自动分配 Advisor
- 教学过程中的教师授课功能完善
- 作业批改业务验收
- 考试评估工作流
- 学习报告生成
- Advisor 干预记录、预警和跟进闭环

另：前端未做 Figma 定稿。

---

## 环境（联调开始后用）

| 项 | 值 |
|---|---|
| 前端 | 本地 Vite `http://localhost:13005` 已代理 8083；公开 Dev 为 `https://dev.xlearnedu.com:8085` |
| 登录 | `POST /v1/auth/login`；Counselor / Advisor 的 `role=USER` |
| 账号 | Dev fixture 已收到；不要把密码写进仓库 |

后续按 `docs/counsellor-dev-frontend-walkthrough.md` 和 `docs/advisor-frontend-handoff.md` 复跑。不要对 Prod 用 Dev 账号。

---

## 给后端的一句话

前端已接入 8083，Counselor → Advisor Profile/Plan → Tenant 改派连续性已用 Dev fixture 走通。
请确认 Intake 创建响应 `activationMethod=null` 是否符合预期，并协助提供新学生首次设密验证码，以补完 Student 同 aggregate 点验。课程编排前端还没做。
