# Tokyo Prod：继续全站排查后的后端问题清单

环境：`https://app.xlearnedu.com`；LMS API：`https://api-cn.xlearnedu.com/api`；测试租户 `tenantId=1`。本轮核验时间为 2026-09-05 07:08–07:46 UTC。

**本轮再次复现 2 项运行问题；此前的 4 项合同缺口仍存在。没有把未测试、正常权限拒绝或诊断脚本的错误请求列为后端故障。** 本文只记录问题、影响及证据。

## B1：owner Advisor 能读取已发布课程配置，但读取同一课程课次返回 404

身份：`userId=7`，`role=USER`，`level=ADVISOR`，租户 1。同一会话、API 基址和 `courseId=1`：

| 请求 | 2026-09-05 UTC 响应 |
| --- | --- |
| `GET /v2/advisor/courses/1/delivery-config` | 07:22:46，200；`launchState=PUBLISHED`、`courseLaunchVersion=2`、`blockers=[]` |
| `GET /v2/courses/1/session-occurrences?from=2026-09-05&to=2026-10-01&includeHistory=false` | 紧接着 404；`COURSE_NOT_FOUND`、`Course does not exist` |

错误响应时间：`2026-09-05T07:22:46.168360922Z`。路径、日期参数和 `includeHistory` 与消费合同的 `listSessionOccurrences` 一致；该操作允许 owner Advisor 读取。

影响：Advisor 无法从实际课次视图检查和管理自己已交付的课程。前端无法把这个 404 当作“没有课次”，也不能用重复课表代替真实课次。当前证据未确定服务内部原因。

## B2：Instructor 新建本人草稿材料成功，删除同一材料仍被拒绝

身份：`userId=15`，`role=USER`，`level=INSTRUCTOR`；`courseId=1`、`weekId=1`。本轮使用新的 QA 链接材料重新验证，未删除既有教学内容。

| 请求 | 实际响应 |
| --- | --- |
| `POST /v2/courses/1/weeks/1/materials`，multipart `linkUrl`、`linkDisplayName` | 07:40:07，200；返回 `materialId=4`、`uploadedBy=15`、`publicationState=DRAFT`、`effectiveStudentVisible=false` |
| 同一 Instructor `DELETE /v2/courses/1/weeks/1/materials/4` | 07:40:20，403；`FORBIDDEN`、`Access denied` |

删除错误响应时间：`2026-09-05T07:40:20.645449894Z`。前一轮已分别对本人上传的 FILE 和 LINK 复现相同问题，本轮新增 LINK 复现，不将旧 FILE 测试写成本轮重新执行。

影响：教师不能移除自己误传的草稿；上传者规则与实际删除权限的关系仍不清楚。本轮材料 4 随后由课程所属 Advisor 删除，HTTP 200；教师回读 weeks 只保留原材料 1，清理完成。

B1、B2 的脱敏请求和完整业务响应：[backend-responses.json](evidence/client-readiness-20260905/backend-responses.json)。

## C1：已保存模考草稿 Section 缺少修改合同

`mockexam.openapi.yaml` 对以下三个路径提供读取和创建操作，但没有文档化的 PUT／PATCH 修改操作：

```text
/v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening
/v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading
/v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing
```

影响：前端不能可靠实现已保存草稿题目的更正。这是消费合同缺口，不是已实测某条修改 API 失败。

## C2：模考建题答案和提交规则仍缺少明确 Schema

建题 `payload` 仍使用泛型 `JsonNode`，没有逐题型定义答案字段的位置、互斥关系和等价答案匹配规则。Reading／Listening 的提交答案定义为 string map，没有在合同中说明完整题号集合和空答案规则。

此前 Prod 实测不完整题号集合返回 `MOCK_EXAM_ANSWER_INVALID`；完整题号加空字符串可提交。前端已经修复已知的漏交空白题号问题；这不能代替建题保存、匹配规则和所有题型判分的合同。未将其表述为已确认的判分算法错误。

## C3：学习任务提交附件缺少受保护的读取合同

`advising.openapi.yaml` 的 `AdvisorTaskResponse` 有 `submissionFileObjectKey`，但没有相应任务文件的下载／预览操作或明确的可下载 URL、文件名、类型投影。会话消息附件属于另一类资源。

影响：包含文件提交的学习任务无法据此完成 Advisor 打开附件和反馈的完整流程。存储对象 key 不能由前端直接当作公开地址。

## C4：Parent 关联学生合同缺少学生显示身份

`parent.openapi.yaml` 的 `ParentStudentLinkResponse` 提供 `studentUserId`，姓名字段却为 `parentFirstName`、`parentMiddleName`、`parentLastName`，未定义学生显示姓名。

影响：多学生家长的孩子选择器缺少可靠显示身份。此项来自合同检查；本轮没有真实 Parent 会话，不声称线上响应已经确认缺字段。

## 已从当前问题清单撤下的旧现象

- Instructor 本人材料上传：本轮新建草稿返回 200；保留的是删除拒绝问题。
- Instructor 课程成员：真实成员列表返回 200；姓名显示问题来自前端未消费已返回的拆分姓名字段，已修复。
- 个人日程删除：使用当前消费合同的 `expectedVersion`，新事件创建、编辑、删除和删除后回读均符合预期。
- 词库返回前端 HTML：当前配置使用 `https://api-cn.xlearnedu.com/vocabulary-api`；真实学生读取返回 JSON，浏览器显示两个词库，恢复／揭示答案／暂停接口也已成功。

词汇排查中有一次手工请求在空请求体上额外携带 `Content-Type: application/json`，返回 500；当前浏览器 Axios XHR 适配器会对 `undefined` 请求体移除该头。按实际客户端行为重测 reveal 返回 200，故未将该诊断请求列为当前产品阻塞。

没有修改后端服务、数据库、权限或环境配置。全角色发布结论及未覆盖范围见 [本轮完整审查报告](client-readiness-audit-2026-09-05.md)。
