# Backend fix handoff supplied by the owner

This is the supplied integration update for B1, B2, C1-C4 and N1. The owner explicitly authorized frontend adaptation from this description. It is contract input, not evidence of a deployed backend or completed Production QA.

明白，上一版范围过大。下面这份只包含这两份文档涉及的 B1、B2、C1–C4 和 N1，可以直接发给前端。

---

# Tokyo Production 问题修复——前端适配说明

API Base：

```text
https://api-cn.xlearnedu.com/api
```

注意：Production 数据库 migration 已完成，但包含以下修复的新 JAR 尚未发布。前端可以先适配，待后端部署后再进行 Production QA。

## B1：Advisor 读取课程课次

接口路径不变：

```http
GET /v2/courses/{courseId}/session-occurrences
GET /v2/courses/{courseId}/session-occurrences/{occurrenceId}
```

后端现在允许 Course owner Advisor 读取有权课程的课次。

前端需要：

- Advisor 课程页面直接调用上述接口。
- HTTP 200 且数组为空才表示“没有课次”。
- `404 COURSE_NOT_FOUND` 表示课程不存在或当前 Advisor 无权访问，不能当作空课表。
- 不再因为之前 Production 返回 404 而隐藏课次区域。

## B2：Instructor 删除自己上传的草稿材料

接口路径不变：

```http
DELETE /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}
```

最新权限规则：

- Course Manager 可以删除任意材料。
- Active TA 只能删除自己上传的材料。
- Active Primary Instructor 只能删除自己上传且 `publicationState=DRAFT` 的材料。
- 不能删除其他用户上传的材料。

前端需要：

- 对符合条件的 Instructor 自有 DRAFT 材料显示删除按钮。
- 删除成功后从列表移除，或重新请求课程 weeks。
- `403 FORBIDDEN` 表示没有删除权限。
- 不要仅根据“能上传”推导“能删除任意材料”。

## C1：Mock Exam 草稿编辑

Tenant Admin 编辑已经存在的 Reading、Listening、Writing 时，使用 authoring GET：

```http
GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading/authoring
GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening/authoring
GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing/authoring
```

保存修改使用完整替换：

```http
PUT /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading
PUT /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening
PUT /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing
```

前端必须：

- 从 authoring GET 保存 `contentRevision`。
- PUT 时发送 `expectedContentRevision`。
- PUT 成功后使用响应中的新 `contentRevision`。
- PUT 是完整替换，不是 PATCH。
- 缺少 section 时继续使用原来的 POST 创建；PUT 不会创建缺失 section。
- 不要把响应专用字段 `id`、`contentRevision`、`imagePreviewUrl`、`audioPreviewUrl` 放进 PUT body。
- Reading、Listening、Writing 共用 version 级 revision；保存其中一项后，其他编辑页的旧 revision 可能失效。
- PUT 不需要 `Idempotency-Key`。

重点处理：

```text
409 MOCK_EXAM_CONTENT_VERSION_CONFLICT
409 MOCK_EXAM_CONTENT_LOCKED
409 MOCK_EXAM_MEDIA_STATE_CONFLICT
404 MOCK_EXAM_SECTION_NOT_FOUND
```

版本冲突后重新读取 authoring 内容，不要用旧版本自动覆盖。

## C2：Mock Exam 答案和提交规则

建题和 authoring payload 不再按无类型的 `JsonNode` 处理，应使用 `mockexam.openapi.yaml` 中的 `MockExamAnswerBearingQuestionPayload` 类型。

非多选客观题必须二选一：

```ts
answer: string;
```

或者：

```ts
answers: string[];
```

这里的 `answers` 表示同一道题的多个等价答案，不是多选题答案集合。

多选题使用：

```ts
answersByQuestion: Record<string, string>;
```

并结合：

```ts
questionIds
chooseCount
options
```

多选题按照无序集合判分。

普通答案比较规则：

- 去除答案两端空格。
- 不区分大小写。
- 不自动去除标点。
- 不合并内部连续空格。
- 不调整单词顺序。
- 数字答案仍使用字符串。

学生提交 Reading/Listening 时：

```ts
answers: Record<string, string | null>;
```

要求：

- 必须完整包含当前 section 配置的全部题号。
- 不是固定必须提交 1–40，具体以 section 题号为准。
- 未回答的题仍需保留 key，推荐值为 `""`。
- `null` 会按空字符串处理。
- 多余、缺失或非法题号返回：
  `400 MOCK_EXAM_ANSWER_INVALID`
- 每个答案最长 512 字符。
- 多选题提交时，每个 `questionId` 对应一个 option key，不提交数组。

## C3：Advisor Task 文件提交

学生上传或替换文件：

```http
PUT /v2/student/study-plan/tasks/{taskId}/submission-file?expectedVersion={version}
Content-Type: multipart/form-data
```

FormData 只传：

```ts
formData.append("file", file);
```

不要手动设置 multipart `Content-Type` boundary。

成功返回 HTTP 200：

```ts
{
  taskId: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  previewAvailable: boolean;
  taskVersion: number;
}
```

前端必须使用返回的 `taskVersion` 更新任务版本。

允许格式：

```text
pdf, docx, pptx, xlsx, png, jpg, jpeg, gif, webp
```

最大文件：100 MiB。

完成任务：

```http
POST /v2/student/study-plan/tasks/{taskId}/complete
```

```json
{
  "expectedVersion": 3,
  "submissionText": "optional"
}
```

任务有非空文字或已绑定文件即可完成。

以下字段已废弃：

```text
fileObjectKey
submissionFileObjectKey
```

前端不要生成、显示或依赖 object key，应读取：

```ts
task.submissionFile
```

Advisor 预览和下载：

```http
GET /v2/advisor/students/{studentUserId}/study-plan/tasks/{taskId}/submission-file/preview
GET /v2/advisor/students/{studentUserId}/study-plan/tasks/{taskId}/submission-file/download
```

通过携带 Bearer Token 的请求获取 Blob。PDF/图片可以预览；Office 文件通常只提供下载。

## C4：Parent linked students

接口：

```http
GET /v2/parent/linked-students?page=0&size=20
```

前端应读取：

```ts
response.data.data.items
```

结构：

```ts
{
  items: Array<{
    studentUserId: number;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
  page: number;
  size: number;
  total: number;
}
```

不要将该响应解析成 `ParentStudentLinkResponse`，也不要使用 `parentFirstName`、`parentEmail` 作为学生信息。

## N1：Advisor Hub 待处理数量

接口和响应字段没有变化：

```http
GET /v2/advisor/students/{studentUserId}/hub
```

`pendingRequestCount` 的准确语义是：

- 当前 Advisor 对该学生待处理的 `PENDING_ADVISOR` schedule request 数量。
- 不包含已处理或 `PENDING_INSTRUCTOR` 请求。
- 不包含 `activeTasks`。

前端直接使用：

```ts
hub.pendingRequestCount
```

不要将 `activeTasks.length` 加入该数值，也不要在前端重新统计历史请求。

处理 schedule request 后，应同时刷新：

```http
GET /v2/advisor/students/{studentUserId}/hub
GET /v2/advisor/schedule-requests?studentUserId={studentUserId}
```

两者的 `pendingRequestCount` 与 `total` 应保持一致。