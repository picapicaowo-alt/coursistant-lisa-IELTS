# Production 功能问题记录

前端：`https://app.xlearnedu.com`。API：`https://api-cn.xlearnedu.com/api`。租户：启澜雅思学院（测试用），`tenantId=1`。以下为 2026-09-05 UTC 的实际观察，仅描述当前未解决的问题。availability 按用户要求跳过。

## 1. 个人日程可创建和编辑，但删除返回 500

角色为 Instructor，userId=15。个人事件 `eventId=1` 由同一账号创建；创建、读取、编辑均返回 200，另一教师读取该事件返回 404。

| 请求 | 实际响应 |
| --- | --- |
| `DELETE /v2/me/personal-events/1`，01:04:58 UTC | HTTP 500，`INTERNAL_SERVER_ERROR`，`data: null`，`message: Internal server error` |
| 同一账号随后 `GET /v2/me/personal-events/1` | HTTP 200，事件仍存在 |
| 再次 `DELETE /v2/me/personal-events/1`，01:20:50 UTC | HTTP 500，同一错误码与消息 |
| 后续浏览器编辑并 `GET /v2/me/personal-events/1` | HTTP 200，`version: 2`，标题 `QA0905 calendar browser edit verified` |

DELETE 无请求体，携带独立 `Idempotency-Key`，路径与当前前端 service 一致。两次失败分别返回时间 `2026-09-05T01:04:58.229040711Z`、`2026-09-05T01:20:50.932254881Z`。影响是用户无法删除自己创建的个人日程。

## 2. 课程 Instructor 上传材料被拒绝

角色为 Instructor，userId=15。`courseId=1` 的 `/v2/me/courses` 返回 `courseRole: Instructor`、`role: Instructor`，primaryInstructor.userId 也是 15。该课程的周内容创建、大纲上传、周发布和材料发布在同一教师身份下成功。

`POST /v2/courses/1/weeks/1/materials` 返回 HTTP 403，`FORBIDDEN`，消息为 `Only Course Manager or Active TA can upload materials`。

已按消费契约核对 multipart：文件字段为 `files`；另以 `linkUrl` 与 `linkDisplayName` 提交链接材料同样返回 403，响应时间 `2026-09-05T01:12:58.975421096Z`。原先用错单数 file 字段的探测没有被当作唯一证据。

作为对照，课程所属 Advisor userId=7 上传同一 QA PDF 创建 materialId=1 成功；Instructor 发布该材料成功，Student 下载成功。当前教师页面提供材料添加操作，但这个真实 Instructor 无法通过该操作创建材料。已有响应未说明这里的 Course Manager 与返回的 Instructor 课程身份之间的对应关系。

## 3. 课程 Instructor 无法读取成员列表，名单与报告学生选择受阻

角色为 Instructor，userId=15，同一 `courseId=1`。

| 请求 | 实际响应 |
| --- | --- |
| `GET /v2/courses/1/members?page=0&size=20` | HTTP 403，`ACCESS_DENIED` |
| `GET /v2/courses/1/members?page=0&size=20&active=true` | HTTP 403，`ACCESS_DENIED`，`message: No Permission to Perform This Action` |
| Advisor userId=7 读取该课程成员列表 | HTTP 200，返回 Instructor 15 与 Student 26 的成员记录 |

第二次响应时间为 `2026-09-05T01:11:57.722691612Z`。课程是该教师的真实可见课程，教师能读取课程、批改提交、保存出勤、创建及发布学习报告。

教师页面的成员名单与创建报告时的学生选择器消费这个成员列表接口。接口拒绝使名单和学生选择无法正常载入。已知 studentUserId=26 后直接提交测试报告可以成功，但页面无法据此获得一个完整可选名单。

## 4. 词汇接口入口返回前端 HTML，学生无法加载词库

当前 Production 前端配置的 Vocabulary 基址是 `/vocabulary-api`。真实 Student userId=26 进入 `/vocabulary` 后显示 `The library could not be loaded`，点击 `Try again` 后仍为相同失败状态。

对配置对应路径的公开读取：

`GET https://app.xlearnedu.com/vocabulary-api/v1/vocabulary/lists`

实际为 HTTP 200、`Content-Type: text/html`、1457 字节，内容是 Coursistant 应用的 HTML 入口，而非词库 JSON。该公开读取没有用户认证；认证后的页面失败现象另由真实浏览器观察。没有将公开请求当成带身份 API 响应。

影响是词库列表无法打开，词汇单元、开始学习、记忆／测试和恢复学习等下游操作无法从该入口继续。本轮未取得这些下游操作的真实响应。

---

接口证据位于原工作区 `output/production-role-live-20260905/workflow-api.jsonl`；账号与业务读取记录在同目录 `api-reads.json`。文档不包含密码、访问令牌或 Cookie。
