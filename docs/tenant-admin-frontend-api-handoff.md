# Tenant Admin 前端 API 与业务联调说明

本文面向 xLearn `TENANT_ADMIN` 前端。Tenant Admin 的定位是账户与租户治理，不是教学管理者。

## 1. 环境、身份与合同

| 环境 | Base URL |
|---|---|
| Local | `http://localhost:8080/api` |
| Dev | `https://dev.xlearnedu.com:8083/api` |
| 健康检查 | `GET {base}/v1` |

登录：`POST /v1/auth/login`。成功后必须是 `role=TENANT_ADMIN`、`level=NOT_APPLICABLE`。所有业务请求带 `Authorization: Bearer {accessToken}`。

相关权威合同：

- Account / Directory / Audit：`docs/api/auth.openapi.yaml`
- Intake / Advisor assignment：`docs/api/advising.openapi.yaml`
- Parent Link：`docs/api/parent.openapi.yaml`
- Course owner / Alert Rule：`docs/api/course.openapi.yaml`
- Mock Exam Template / Media：`docs/api/mockexam.openapi.yaml`

不要把 `TENANT_ADMIN` 改名成 `MANAGER`，也不要把 `ADVISOR` 等业务身份放进 `role` 字段。员工使用 `role=USER` 加对应 `level`。

## 2. 能力总览

Tenant Admin 可以：

1. 搜索、查看、创建和维护本租户账号。
2. 创建 Student Intake、修正未分配资料、首次分配或改派 Advisor。
3. 创建或维护 Student 与 Parent 的 Link。
4. 查看并转移 Course owner，但不读取 Course teaching data。
5. 配置租户 Alert Rule。
6. 查看治理 Audit Events。
7. 创建、维护和发布 Mock Exam Template，并上传 Listening 音频及 Reading/Writing 图片。

Tenant Admin 不可以查看或修改 Student Learning Progress、Profile、Study Plan、Risk、Grade、Attendance、Hours、Report、Assignment、Discussion 或 Course Content。

## 3. User Directory 与账号管理

### 3.1 Directory

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/tenant/users` | `tenantListUsers` |
| GET | `/v2/tenant/users/{userId}` | `tenantGetUser` |

列表参数：`q`、`role`、`level`、重复的 `levels`、`status`、`page`、`size`。

- `q` 搜索 structured name 和 email。
- Advisor selector：`role=USER&levels=ADVISOR&levels=INSTRUCTOR_ADVISOR&status=ACTIVE`。
- Instructor selector：`role=USER&levels=INSTRUCTOR&levels=INSTRUCTOR_ADVISOR&status=ACTIVE`。
- 不要同时提交 `level` 和 `levels`。
- `levels` 使用 repeated query，不要传逗号字符串。

### 3.2 创建账号

```http
POST /v2/tenant/managed-users
operationId: tenantManagedUserCreate
Idempotency-Key: required
```

允许创建：

| 身份 | 请求 |
|---|---|
| Tenant Admin | `role=TENANT_ADMIN, level=NOT_APPLICABLE` |
| Counsellor | `role=USER, level=COUNSELLOR` |
| Advisor | `role=USER, level=ADVISOR` |
| Instructor | `role=USER, level=INSTRUCTOR` |
| Instructor + Advisor | `role=USER, level=INSTRUCTOR_ADVISOR` |

不能从该接口创建 Student 或 Parent：

- Student 走 `/v2/tenant/student-intakes`。
- Parent 走 `/v2/tenant/students/{studentUserId}/parent-links`。

请求使用 `firstName / middleName / lastName / email`，不要提交 legacy `name`。接口不返回临时密码；账号首次设密仍通过 Password Reset。

### 3.3 修正 Staff 资料

```http
PATCH /v2/tenant/managed-users/{id}
operationId: tenantPatchManagedUser
Idempotency-Key: required
```

从 `tenantGetUser` 读取 `accountVersion`，PATCH 提交：

- `expectedAccountVersion`
- 需要更改的 `firstName / middleName / lastName / email / phone`

不要提交 `role / level / status / password`。这些字段在 PATCH 中被拒绝。

- 修改姓名/phone 不使现有 Session 失效。
- 修改 email 会更新登录身份并使旧 token 失效；用户用新 email 重新登录。
- `409 ACCOUNT_VERSION_CONFLICT`：保留表单、重新 GET 后再由用户确认。
- `409 USER_ALREADY_EXISTS`：email 已被占用。
- Self profile correction 仍使用 `/v2/me/profile`，不要用 Managed Staff PATCH 修改自己。
- Assigned Student 和 Parent 的基础账号纠正不在本阶段范围内。

### 3.4 身份转换

```http
PUT /v2/tenant/managed-users/{id}/role
operationId: tenantManagedUserChangeRole
Idempotency-Key: required
```

Student 和 Parent 身份永久不可转换，也不可作为转换目标。普通 Staff 只允许现有身份矩阵中的合法转换；同一 role+level 是幂等 no-op。有 Course owner、Advisor assignment、Instructor/TA enrollment 等责任时，降级可能返回 `409 CONFLICT`。

### 3.5 Disable / Enable

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/tenant/managed-users/{id}/disable-blockers` | `tenantGetManagedUserDisableBlockers` |
| POST | `/v2/tenant/managed-users/{id}/disable` | `tenantManagedUserDisable` |
| POST | `/v2/tenant/managed-users/{id}/enable` | `tenantManagedUserEnable` |

推荐流程：

```text
GET disable-blockers
→ 根据 blockers 完成责任交接
→ 再次 preview
→ canDisable=true 后 POST disable
```

Preview 不是锁；Disable 会在事务内重新检查，期间发生变化仍可能返回 409。常见 blocker 包括 Course owner、Advisor assignment、Instructor/TA enrollment 和 `LAST_ACTIVE_TENANT_ADMIN`。Disable 不会自动 withdraw 或转移责任。

Enable 只恢复账号登录资格，不恢复 assignment、enrollment、Parent Link 或 Course ownership。ACTIVE target 是 no-op。Disable 使用 `Idempotency-Key`；Enable 按当前合同不需要。

## 4. Student Intake 与 Advisor 分配

| Method | Path | operationId |
|---|---|---|
| POST | `/v2/tenant/student-intakes` | `tenantCreateStudentIntake` |
| GET | `/v2/tenant/student-intakes` | `tenantListStudentIntakes` |
| GET | `/v2/tenant/student-intakes/{intakeId}` | `tenantGetStudentIntake` |
| PATCH | `/v2/tenant/student-intakes/{intakeId}` | `tenantPatchStudentIntake` |
| PUT | `/v2/tenant/student-intakes/{intakeId}/advisor` | `tenantAssignAdvisor` |
| PUT | `/v2/tenant/students/{studentUserId}/advisor` | `tenantReassignAdvisor` |
| POST | `/v2/tenant/student-intakes/{intakeId}/cancel` | `tenantCancelStudentIntake` |

推荐顺序：

```text
创建 Intake
→ 搜索/查看
→ OPEN + UNASSIGNED 时修正资料
→ 从 Directory 选择 ACTIVE Advisor
→ 首次分配
→ 必要时由 Tenant Admin 改派
```

Intake list 支持 `lifecycleStatus / assignmentStatus / advisorUserId / q / intakeId / studentUserId / page / size`。`q` 搜索 structured name 和 email。

PATCH 提交 `expectedIntakeVersion`，只允许 Intake 与基本姓名/联系资料；`email` 明确禁止修改。首次分配提交 Intake version，改派提交 assignment version 与 reason。已分配 Intake 仍可由 Tenant Admin 读取，但不能继续使用未分配 PATCH。只有未分配 Intake 可以 cancel。

## 5. Parent Links

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/tenant/students/{studentUserId}/parent-links` | `tenantListParentLinks` |
| POST | `/v2/tenant/students/{studentUserId}/parent-links` | `tenantCreateOrReuseParentLink` |
| PUT | `/v2/tenant/students/{studentUserId}/parent-links/{parentUserId}` | `tenantLinkParent` |
| DELETE | `/v2/tenant/students/{studentUserId}/parent-links/{parentUserId}` | `tenantUnlinkParent` |

POST 根据 email create-or-reuse Parent；后端不保存 Parent 当前选择的 Student，选择状态由前端处理。PUT/DELETE mutation 带 `Idempotency-Key`。Unlink 后 Parent 立即失去该 Student 的读权限；Relink 创建新的 active period。

## 6. Course ownership governance

| Method | Path | operationId |
|---|---|---|
| GET | `/v2/tenant/course-ownerships` | `tenantListCourseOwnerships` |
| GET | `/v2/tenant/courses/{courseId}/owner` | `tenantGetCourseOwner` |
| PUT | `/v2/tenant/courses/{courseId}/owner` | `tenantTransferCourseOwner` |

列表支持 `q / ownerAdvisorUserId / page / size`，只返回安全的 ownership projection。Transfer 提交：

- `ownerAdvisorUserId`
- `expectedOwnershipVersion`
- `reason`

Tenant Admin 不能调用 `GET /v2/courses` 浏览教学数据，也不能代替 Advisor launch Course、排课、管理 Week/Content、Enrollment 或 Grade。Course 由 owner Advisor 负责；其他 Advisor 只能把自己的 Student link 到 Published Group Course。

## 7. Alert Rule 与治理审计

| Method | Path | operationId |
|---|---|---|
| GET / PUT | `/v2/tenant/alert-rules` | `tenantGetAlertRules` / `tenantPutAlertRules` |
| GET | `/v2/tenant/audit-events` | `tenantListAuditEvents` |

Alert Rule 支持 `SYSTEM_DEFAULT / TENANT_OVERRIDE / DISABLED`。Tenant Admin 配置规则，但不因此取得 Student Risk 或 Progress 的查看权限。

Audit Events 支持 `actorUserId / targetUserId / action / resourceType / from / to / page / size`，只提供治理安全投影，不返回 private notes 或 learning content。

## 8. Mock Exam Template 与媒体

### 8.1 Template lifecycle

| Method | Path | operationId |
|---|---|---|
| GET / POST | `/v2/tenant/mock-exam-templates` | `listTenantMockExamTemplates` / `createTenantMockExamTemplate` |
| GET | `/v2/tenant/mock-exam-templates/{templateId}` | `getTenantMockExamTemplate` |
| GET | `/v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}` | `getTenantMockExamVersion` |
| POST | `.../versions/{versionId}/copies` | `copyTenantMockExamVersion` |
| POST | `.../versions/{versionId}/publish` | `publishTenantMockExamVersion` |
| POST | `.../versions/{versionId}/archive` | `archiveTenantMockExamVersion` |
| DELETE | `.../versions/{versionId}` | `deleteTenantMockExamDraft` |

Content 仍是 create-only：

- `GET/POST .../reading`：`getTenantMockExamReading` / `createTenantMockExamReading`
- `GET/POST .../listening`：`getTenantMockExamListening` / `createTenantMockExamListening`
- `GET/POST .../writing`：`getTenantMockExamWriting` / `createTenantMockExamWriting`

本阶段没有 Reading/Listening/Writing PUT/PATCH，也不做 Copy 后逐题修改。Advisor 负责把 Published Template 安排给 Student，Instructor 负责 Writing grading。

### 8.2 Media workflow

| Method | Path | operationId |
|---|---|---|
| POST | `.../versions/{versionId}/media` | `uploadTenantMockExamMedia` |
| GET | `.../versions/{versionId}/media` | `listTenantMockExamMedia` |
| GET | `.../versions/{versionId}/media/{mediaId}/preview` | `previewTenantMockExamMedia` |
| DELETE | `.../versions/{versionId}/media/{mediaId}` | `deleteTenantMockExamMedia` |

流程：

```text
创建 Draft Version
→ multipart 上传媒体
→ preview
→ 用 mediaId 创建 Reading/Listening/Writing 内容
→ publish
```

Multipart parts：`kind`、`file`；Header：`Idempotency-Key`。

| kind | 文件 | 上限 |
|---|---|---|
| `LISTENING_AUDIO` | MP3 / WAV | 100 MB |
| `READING_IMAGE` | PNG / JPG / JPEG / WEBP | 10 MB |
| `WRITING_IMAGE` | PNG / JPG / JPEG / WEBP | 10 MB |

- Listening create 使用 `audioMediaId`。
- Reading/Writing 图片使用 `imageMediaId`。
- 不提交 `audioPath / imagePath / imageSrc`。
- Upload response 不暴露 `objectKey` 或存储路径。
- Listening audio 支持 Range：正常流 `200`，合法 Range `206`，非法 Range `416`。
- 刷新页面后通过 media list 找回未绑定的 `UPLOADED` media。
- 绑定后的 media 不能单独删除；Draft Version 删除时进入异步对象清理。

主要错误：

- `400 FILE_TOO_LARGE / BAD_REQUEST / UNSUPPORTED_FILE_TYPE`
- `404 MOCK_EXAM_MEDIA_NOT_FOUND`
- `409 MOCK_EXAM_MEDIA_STATE_CONFLICT / MOCK_EXAM_CONTENT_LOCKED / IDEMPOTENCY_KEY_MISMATCH`
- `409 MOCK_EXAM_NOT_READY`：publish 前存在未绑定或缺失 object
- `503 STORAGE_FAILURE`：存储故障；Version 状态保持不变

## 9. 通用前端规则

- 成功同时检查 HTTP status 与 `code=SUCCESS`；create 可能返回 200 或 201，以权威合同为准。
- OpenAPI 标记 required 的 mutation 使用最长 128 字符的稳定 `Idempotency-Key`。同一次网络重试沿用 key；payload 改变后生成新 key。
- CAS conflict 时保留表单，重新 GET 最新 version，不要在旧 version 上循环重试。
- `401 INVALID_TOKEN`：清理 Session 并回登录页。
- `403`：显示无该治理能力，不能伪装成空列表。
- `404`：不可泄漏跨租户资源存在性。
- 不把 password、token、object key 或测试账号写入前端仓库。

## 10. Dev 部署数据库前置

部署包含本轮能力的新 JAR 前，在 Dev `lms_v2_Institution` 执行 additive schema：

- `user.account_version INT NOT NULL DEFAULT 0`
- `mock_exam_media`
- 上传所需 `upload_operation / minio_object_outbox`（若尚不存在）
- `mock_exam_listening_part.audio_path` 改为 nullable

Gate check 必须全部 `bad_cnt=0`。这不需要 structured-name 重迁移，也不需要 Mock Exam 历史媒体 backfill。执行 DDL 后再重启 JAR。

## 11. 验收状态

- Gate：`TENANT_ADMIN_FRONTEND_USABILITY_GATE_PASS`
- Local live：`tausab-20260902T053702Z`
- 结果：35 PASS / 0 FAIL / 0 unexplained 5xx
- `mvn clean verify`：BUILD SUCCESS
  - Surefire：1178 / 0 / 0
  - Failsafe：424 / 0 / 0
- 该 Gate 代表本地实现、合同与业务验收完成，不是 Dev/Prod Promotion。

前端可以依据本文件和权威 OpenAPI 开始 Tenant Admin 联调；部署到 Dev 后仍需要定向 Dev smoke，不能用 Local Gate 代替环境验收。
