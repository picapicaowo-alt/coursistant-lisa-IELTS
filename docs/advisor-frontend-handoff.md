# Advisor 前端联调说明

契约源：`docs/api/advising.openapi.yaml`（唯一权威合同）。实现与契约拼写保持 `Advisor*`、`/v2/advisor/**`、`ADVISOR` / `INSTRUCTOR_ADVISOR`。不要另建第二份手工合同。

端到端逐步走查（Counselor → Advisor Profile/Plan → Group / 1-on-1 → READY/PUBLISH → Instructor）：`docs/advising-frontend-walkthrough.md`。

Milestone B（本轮可联调）：Student 工作队列、Intake、Profile、Study Plan、revision、改派连续性。
Milestone C（Course Orchestration）已按 2026-08-28 新 OpenAPI 接入前端；真实 Dev 写验收仍需后端授权 fixture 与数据范围。

## 环境

| 项 | 值 |
|---|---|
| Local base | `http://localhost:8080/api` |
| Dev base | 获授权后再用；不要用本地账号打 Prod |
| 健康检查 | `GET {base}/v1` → 200 |
| 登录 | `POST {base}/v1/auth/login`，Advisor / Instructor-Advisor 的 `role=USER` |
| B 写开关 | `lms.advising.profile-study-plan-writes-enabled` |
| A 写开关 | 仅 Counselor / Tenant 建学员与分配需要；不因开 B 自动改变 |
| C 写开关 | 本轮 B 联调保持关闭 |

Advisor、Instructor 等预置联调账号的密码向后端负责人索取，不要写进前端仓库。Counselor 创建的新学生没有对外提供的初始密码，必须通过验证码执行 `POST /v1/auth/password-resets` 首次设密；不要引导新学生调用 `PUT /v1/auth/password`。设密前业务 API 会返回 `403 PASSWORD_CHANGE_REQUIRED`。

## 主流程（Milestone B）

`当前 Advisor 队列 -> 读 Intake -> 创建/更新 Profile -> 创建/更新 Study Plan -> 学生只读同一 aggregate -> TENANT_ADMIN 改派后旧 Advisor 立即 404`

Student 当前归属唯一来源是 `student_advisor_assignment`。Advisor 不能自行领取、取消或改派。

## 接口清单

所有请求带 `Authorization: Bearer {accessToken}`。分页参数：`page`、`size`。分页体：`page` / `size` / `total` / `items`，`total` 为 int64。

成功信封：`status` 等于 HTTP status，`code=SUCCESS`。

### Advisor Core

| 方法 | 路径 | operationId | 写开关关闭时 |
|---|---|---|---|
| GET | `/v2/advisor/students` | `advisorListStudents` | 仍可用 |
| GET | `/v2/advisor/students/{studentUserId}/intake` | `advisorGetStudentIntake` | 仍可用 |
| POST | `/v2/advisor/students/{studentUserId}/profile` | `advisorCreateStudentProfile` | `409 ADVISING_FEATURE_DISABLED` |
| GET | `/v2/advisor/students/{studentUserId}/profile` | `advisorGetStudentProfile` | 仍可用 |
| PUT | `/v2/advisor/students/{studentUserId}/profile` | `advisorUpdateStudentProfile` | `409 ADVISING_FEATURE_DISABLED` |
| POST | `/v2/advisor/students/{studentUserId}/study-plan` | `advisorCreateStudyPlan` | `409 ADVISING_FEATURE_DISABLED` |
| GET | `/v2/advisor/students/{studentUserId}/study-plan` | `advisorGetStudyPlan` | 仍可用 |
| PUT | `/v2/advisor/students/{studentUserId}/study-plan` | `advisorUpdateStudyPlan` | `409 ADVISING_FEATURE_DISABLED` |
| GET | `/v2/advisor/students/{studentUserId}/study-plan/revisions` | `advisorListStudyPlanRevisions` | 仍可用 |

`ADVISOR` 与 `INSTRUCTOR_ADVISOR` 行为一致。列表只含本租户、当前分配给自己的 ACTIVE 学生。

### Student / Tenant 只读

| 方法 | 路径 | operationId |
|---|---|---|
| GET | `/v2/student/profile` | `studentGetOwnProfile` |
| GET | `/v2/student/study-plan` | `studentGetOwnStudyPlan` |
| GET | `/v2/tenant/students/{studentUserId}/profile` | `tenantGetStudentProfile` |
| GET | `/v2/tenant/students/{studentUserId}/study-plan` | `tenantGetStudentStudyPlan` |
| GET | `/v2/tenant/students/{studentUserId}/study-plan/revisions` | `tenantListStudyPlanRevisions` |

`advisorPrivateNotes` 只出现在当前 Advisor 的 Profile 响应。Student / Tenant / Instructor JSON 都没有该字段。

## 权限与 404

- 当前 Advisor：list / intake / profile / plan `200`
- 旧 Advisor、其他 Advisor、跨租户：受保护资源统一 `404`（不泄漏存在性）
- 没有 Advisor 能力的合法身份：`403 FORBIDDEN`
- 改派提交后无缓存等待：旧 Advisor 立即从 list 消失且 intake `404`，新 Advisor 立即看到同一 `profileId` / version

## Profile

- 首次创建 `201`，`profileVersion=0`
- 不同 Idempotency-Key 重复创建：`409 STUDENT_PROFILE_ALREADY_EXISTS`
- 更新必须带 `expectedProfileVersion`；成功 version +1
- CAS 冲突：`409 STUDENT_PROFILE_VERSION_CONFLICT`
- skills 与 Profile 整棵原子提交
- 改派不复制 Profile

## Study Plan

- 无 Profile：`409 STUDENT_PROFILE_REQUIRED`
- 创建 `201`，`studyPlanVersion=0`，保存 `basedOnProfileVersion`
- 更新必须带 `expectedStudyPlanVersion` 与 `expectedProfileVersion`
- Plan CAS：`409 STUDY_PLAN_VERSION_CONFLICT`
- Profile 已变但 Plan 仍按旧 version 写：`409 STUDENT_PROFILE_VERSION_CONFLICT`
- 合法更新保持 child id；revision 只返回真实 immutable metadata
- Advisor 写成功后，Student GET 读到同一 `studyPlanId` / `studyPlanVersion` / `basedOnProfileVersion`

## Idempotency-Key

Profile / Study Plan 的 POST、PUT **必须**带 `Idempotency-Key`（最长 128）。

- 同 key + 同 payload：重放首次 HTTP status、IDs、versions
- 同 key + 不同 payload：`409 IDEMPOTENCY_KEY_MISMATCH`

## 不要做

- 批量导入、自动分配
- Advisor 主动改派 / 取消 Intake / 改 email
- 把 `advisorPrivateNotes` 画进学生或租户页面
- 在没有授权 fixture 与明确数据范围时，对共享 Dev 执行 Course Orchestration 写入

## Milestone C 要点

契约仍在 `docs/api/advising.openapi.yaml`。Group link / 1-on-1 / Instructor / Session / READY / PUBLISH / reconfirm 的 operationId 以该文件为准。

- link 使用 `courseLinkVersion`；Instructor / Session / READY / PUBLISH 共用 `courseLaunchVersion`
- 不能绕过 READY 直接 PUBLISH
- Instructor context 无联系方式、private notes、revision history
- C 关闭时所有 orchestration mutation 为 `409 ADVISING_FEATURE_DISABLED`
