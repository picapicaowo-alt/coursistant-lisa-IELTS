# 后端联调交接：Mock Exam 答案、教师材料/报告、课次读取

日期：2026-09-04。环境：IELTS Dev，前端 `https://dev.xlearnedu.com:8085`，浏览器请求通过现有同源 `/api`。本文只核对前端调用与提供的合同，不检查或修改后端实现、数据库、权限配置或代理。

## 结论与证据边界

**以本次后端交付的 OpenAPI 为字段、请求和响应标准；角色 handoff 用于解释业务流程。先判断前端有没有正确调用，不能仅凭 403/404 就认定后端缺少接口。**

| 项目 | 前端调用核对 | 当前结论 |
| --- | --- | --- |
| Mock Exam 普通客观题答案 | Reading/Listening create 路径及外层请求符合 OpenAPI；`payload` 为泛型 JsonNode。已按 API 负责人本次明确提供的 `answer` / `answers` 规则补齐编辑、导入和保存校验 | 前端缺少答案编辑能力已修复；OpenAPI 的具体答案结构仍需补充。不能继续描述成“没有可调用 API”。真实保存及判分待登录复验 |
| 教师材料上传 | `POST /v2/courses/{courseId}/weeks/{weekId}/materials`，multipart `files` 与 `Idempotency-Key` 均由现有 service 提供 | 正确路径/请求形状对应历史实测 403，需后端确认 Instructor 与 Course Manager/Active TA 的课程权限映射；尚不能断言是实现 bug 还是预期权限 |
| 教师报告 | 失败的是 `GET /v2/courses/{courseId}/members` 学生选择器，不是报告提交接口；筛选和分页参数符合合同 | 需确认该课 Instructor 的学生目录读取权限或提供合同中明确的替代入口。未实际调用的报告 POST 不列为 403 |
| Advisor 课次读取 | `GET /v2/courses/{courseId}/session-occurrences` 的路径、日期参数和 owner Advisor 读权限符合合同 | 同角色能读 delivery-config，但 occurrence 读取返回 404，需后端核查课程/租户/owner 可见性；不能靠前端改 ID、伪造课次或把 404 当空列表修复 |

这些 403/404 的最新可用证据来自 **2026-09-04 的上一轮真实角色验收**，并非本轮重新请求。核查时现有 8085 浏览器已退出测试账号，因此没有声称“当前后端已经复测仍失败”，也没有创建/重置账号或试探权限。它们是**尚未获得修复及复验成功证据的未关闭项**。

证据：[脱敏响应及来源说明](evidence/backend-contract-check-20260904/observed-errors.json)。材料和课次包含原始错误响应；报告学生目录仅有已保存的状态记录和页面证据，没有伪造完整响应 JSON。

## 1. 本次交付包与消费合同对照

已核对用户提供的 auth、user、course、assignment、notification、mockexam、advising、parent 共 8 份 OpenAPI。它们与发布分支基线 `e516311` 的 `docs/api/` 内容一致：course 字节一致，另外 7 份仅 CRLF/LF 不同。**没有发现需要更换这些问题的请求路径或参数的新版本差异。** 不复制第二套 OpenAPI，不因换行差异宣称合同变化。

文件 SHA-256 和比较结果：[supplied-contract-comparison.json](evidence/backend-contract-check-20260904/supplied-contract-comparison.json)。本次提供的业务说明已保存为：

- [总入口](frontend-handoff-instructor-student-parent.md)
- [Instructor handoff](instructor-frontend-handoff.md)
- [Student handoff](student-frontend-handoff.md)
- [Parent handoff](parent-frontend-handoff.md)

本次只核对用户点名的答案、材料、报告和课次链路，不将 8 份文件相同表述为所有角色/所有接口均已真实验收。附件中的后端部署、账号获取等操作说明属于参考文档，不替代用户对本次前端工作的授权范围。

## 2. Mock Exam：前端能力已补齐，答案结构文档待补全

合同：[`mockexam.openapi.yaml`](api/mockexam.openapi.yaml)，`CreateListeningSectionRequest.payload` / `CreatePassageQuestionRequest.payload` 仍引用 `JsonNode`。本次提供的 YAML 中未定义普通题的 `answer` / `answers` / `answersByQuestion`；submit request 中的 `answers` 是另一层学生提交结构，不能误认为正确答案列表 schema。

API 负责人在本次任务中明确的规则已落实：

```json
{"id":9,"answer":"fermentation"}
```

```json
{"id":9,"answers":["fermentation","fermentation process"]}
```

- 两个字段互斥；多答案不能为空，不能含空白项或重复项。
- 官方答案原文与词序保留；`cow dung` 与 `dung cow` 不合并。
- `multiSelect` 保留 `answersByQuestion`；Student 仍提交单个答案字符串，且不显示官方答案列表。
- 校验覆盖已知题型的活动答题槽；未定义的自定义题型不猜测字段。

请后端补充每种题型的答案位置、string/array 的互斥 schema、合法样例和重复判定标准；不要求新增 Student 提交接口。用同一份新 QA 试卷验证创建→读取→发布→分配→Student 提交→判分，确认每个官方等价答案都能被接受，反词序不会被错误视为等价。本次模拟测试不能替代真实判分验收。

## 3. 材料上传 403：核对课程权限映射

历史实测：2026-09-04T08:30:19.238140144Z，同一 Instructor 在 course 344 可以创建 Week、更新内容并上传 Syllabus；课程发布后，对 week 291 的材料上传仍失败。

```http
POST /api/v2/courses/344/weeks/291/materials
Authorization: Bearer <该课程 Instructor 的 token>
Idempotency-Key: <唯一请求键>
Content-Type: multipart/form-data; boundary=<浏览器生成>
```

multipart part：`files`，文件 `qa-writing-response.pdf`。HTTP 403：

```json
{"status":403,"code":"FORBIDDEN","data":null,"message":"Only Course Manager or Active TA can upload materials","timestamp":"2026-09-04T08:30:19.238140144Z"}
```

核对依据：OpenAPI `courseMaterialCreate`；[`course-api.ts`](../lms/src/apis/services/course-api.ts) 的 `createMaterials` 使用 FormData 的 `files` / 可选 `linkUrl` / `linkDisplayName`，并通过共享 helper 传幂等键，没有手写 multipart boundary。Instructor handoff 把 Week/Material 列入可联调业务，并要求使用现有 Course Material API。

请后端确认：该课 active Instructor/primary instructor 是否应该满足材料上传的课程级管理权限；如果应该，修复对应授权映射或数据状态。如果不应该，请在手册/OpenAPI 中明确必要的 courseRole、active 状态和可读取的能力字段，供前端禁用入口。前端不会自行提升角色、改用管理员 token 或修改 membership。

复验：同一教师对有权的课程上传→读取/预览→刷新；无权/跨租户场景保持拒绝。不能把“可以写 Week”直接当作“必然具有一切材料权限”的证明。

## 4. 报告学生目录 403：不是报告 POST 失败

历史入口：`/course/341/operations?section=reports` → Create new report → 搜索课程学生。原实测使用该课主讲 Instructor，学生选择失败后 Save draft 保持禁用。

```http
GET /api/v2/courses/341/members?courseRole=Student&q=Emily&page=0&size=10
Authorization: Bearer <该课程 Instructor 的 token>
```

记录结果：HTTP 403，`ACCESS_DENIED`；页面显示权限不足。未取得本条完整错误响应，不能补写 timestamp/requestId，也没有证据证明报告保存接口本身返回 403。

合同 `courseMemberList` 明确提供 `courseRole` / `active` / `q` / `page` / `size`；分页从 0 开始、size 上限 100。本次参数合法。[`CourseStudentPicker.tsx`](../lms/src/pages/CourseOperationsPage/CourseStudentPicker.tsx) 通过 `listCourseMembers` 调用该接口。Course Report 列表自身是 1-based，与学生目录分页不同，前端按各自合同处理。

请后端确认该课 Instructor 读取 course members 的权限前提；若该路径对 Instructor 本来就不可用，请提供正式的课程内可报告学生查询合同，而不是要求前端枚举租户所有学生。确认后复验查询→选择→报告 DRAFT→发布→Student/Parent 只读，保留课程、学生、租户边界。

## 5. 课次 404：owner Advisor 的读取与可见性不一致

同一 Advisor 的历史对照请求：

```http
GET /api/v2/advisor/courses/344/delivery-config
```

2026-09-04T07:55:34.998663465Z：200 SUCCESS，courseId=344，deliveryMode=GROUP，launchState=READY，courseLaunchVersion=1。

```http
GET /api/v2/courses/344/session-occurrences?from=2026-09-14&to=2026-10-12&includeHistory=false
```

2026-09-04T07:55:35.195629517Z：

```json
{"status":404,"code":"COURSE_NOT_FOUND","data":null,"message":"Course does not exist","timestamp":"2026-09-04T07:55:35.195629517Z"}
```

后续课程发布后的页面证据仍显示课次读取失败；该后续页面没有新的原始 HTTP envelope，因此不把 READY 阶段的 timestamp 当作发布后的请求时间。

合同 `listSessionOccurrences` 明确允许 Instructor、TA、Student 和 **owner Advisor** 读取，参数为 date 类型 `from` / `to` 和 boolean `includeHistory`。[`course-operations-api.ts`](../lms/src/apis/services/course-operations-api.ts) 使用同一路径和参数；没有误用 Instructor 禁止调用的 generate/create/reschedule/cancel 写入口。

请后端核查调用者的 owner Advisor 归属、tenant/course visibility 与 delivery-config / occurrences 两条读取路径的授权一致性。若无课次且仍有课程读取权限，应返回合同支持的正常空集合；若隐藏 404 是预期，请明确缺失的权限前置条件。客户端不会从 404 向普通用户泄漏资源存在性，也不会把 recurring session 擅自合成为已持久化课次。

## 6. 不再列为当前故障的旧记录

上一轮后续实测中 Instructor `grading-items` 和 `personal-events` 已为 200；课程发布在补齐 Week/Syllabus 后已成功。它们不属于本次未关闭的材料、报告学生目录和 occurrence 问题。发布前端不会自动修复服务侧权限或证明这些链路已通过真实验收。
