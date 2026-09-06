# IELTS 后端核验交接 — 全站续查

日期：2026-09-05。前端基线：`90a8ec45d09d9d4adcfd5740311b267968e4cfc3`。

**本轮新增、已由真实响应确认的后端故障：0 项。** 本轮未取得受保护的真实登录态；这不表示后端全功能通过验收。以下是发布前核验需求，不是未经复现的新故障单。

## 本轮前端已自行处理

- 首次作业上传后仍使用旧暂存计数、上传／删除／提交并发、幂等重试，以及提交成功后状态读取失败的恢复。
- 阅读图题使用真实 `passageSeq` / `sortOrder`。
- 模考后台读取导致未提交答案丢失，以及部分媒体读取失败留下的 Blob URL。
- 上轮会话隔离修复与产品确认的 Quiz 排除已整合入本轮候选。

这些问题有源码及本地回归证据，无需后端通过调整正确的 403／409／503 来适配错误的前端行为。模拟失败响应不用于认定服务端故障。

## 已提出事项的当前核验要求

最新消费合同和前端适配已经覆盖 B1、B2、C1–C4、N1。请以 [后端适配来源](backend-fix-adaptation-source-2026-09-05.md) 和当前 `docs/api/` 为准；旧文档中的“没有接口”不能继续作为当前结论。

| 项目 | 正确调用和应核验的结果 | 本轮状态 |
| --- | --- | --- |
| B1 Advisor 课次 | 同一 owner Advisor、同 courseId 比较 delivery-config 和 session-occurrences；日期参数按合同，200 空列表与拒绝访问必须区分 | 未重新取得真实响应 |
| B2 Instructor 草稿材料删除 | 上传后用返回 materialId、真实 uploadedBy 和 DRAFT 状态验证本人删除；不得将上传权扩大为删除他人资料权 | 待同身份创建／删除／回读 |
| C1 保存后的试卷编辑 | authoring GET 的 contentRevision → PUT expectedContentRevision → 再次 GET；并发冲突保留 409，三科共享 revision 不被静默覆盖 | 前端 fixture 已覆盖，真实持久化待验收 |
| C2 答案和媒体身份 | 客观题提交按真实题号覆盖空答案；Reading 图片路径使用真实 passageSeq、sortOrder，不能将数组下标当资源身份 | 前端已修正调用；待真实题型样本 |
| C3 学习任务附件 | Student multipart file + query expectedVersion；使用返回 taskVersion 完成任务；Advisor 鉴权预览／下载；完成后跨角色回读同一附件 | 前端 fixture 已覆盖，真实读写待验收 |
| C4 Parent 学生身份 | Parent linked-students 的分页、结构化学生姓名／身份，以及切换不同孩子后的权限和数据归属 | 缺真实 Parent 账号 |
| N1 Hub 待处理数量 | 以待 Advisor 处理的请求为口径，审批后核对队列 total 和 pendingRequestCount，并排除已处理／待 Instructor 项 | 待真实审批后回读 |

此前个人事件删除等事项，应使用最新合同要求的版本参数复测；不复用旧的不完整请求作为当前故障依据。Quiz 已排除，不列为发布阻塞。

## 完成核验所需输入

- 可用的测试环境与角色账号，至少覆盖 Student、Instructor、Advisor、Counsellor、Parent、Tenant Admin、System Admin 和 Instructor Advisor；只授予对应测试所需的现有权限。
- 测试资源的已有课程／成员关系，以及允许写入的 QA 记录范围；不为取得覆盖而擅自改动真实家长关系、成绩或业务数据。
- 与本轮前端适配配套的后端版本确认。旧交接中“尚未部署”的表述是当时状态，不能据此推断当前版本。

重新测试后，每项问题记录应包含：环境与时间、真实角色、method/path/query、脱敏请求体、状态码与响应 code、同资源成功对照、界面影响及回读结果。没有这些证据时保持“待核验”，不要定位服务内部根因。

本轮没有修改或检查后端服务源码、数据库、部署或基础设施。更多前端修复及完整覆盖边界见 [全站续查报告](client-functional-audit-2026-09-05.md)。
