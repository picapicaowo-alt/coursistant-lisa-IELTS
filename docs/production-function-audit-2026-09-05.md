# Production 全站功能审查记录

范围为 `app.xlearnedu.com` 的 IELTS 前端。**前端审查与修复已进行；全角色 Production 功能验收仍未完成，不能标为工业级交付就绪或零 broken functions。**

本轮已实际打开 Production 的 `/advisor/schedule`，页面转到 `/login`，当前没有可用于本轮真实业务操作的有效会话。已经请求恢复登录并提供可用角色的测试入口。登录恢复前，未把历史 Dev 结果、模拟响应或源码映射作为当前 Production 成功证据。

## 版本和修复位置

- 线上公开 `RELEASE_INFO.json` 实测：`8885badb01fe5a633f1cb61d6d1fd1189c5697d6`，release `20260905T001430Z-8885badb-system-admin`，Tokyo Production。
- 本轮从同一远端主线建立独立分支 `codex/production-function-audit`，目录 `/private/tmp/coursistant-production-function-audit`。
- 原工作区开始时有 668 项变动；本轮代码没有混入或覆盖这些既有变动。
- 本轮尚未 push、merge 或部署。下列修复尚不代表线上行为已经改变。

## 已修复的前端问题

| 编号 | 触发与原行为 | 修复后行为 | 验证 |
| --- | --- | --- | --- |
| F1 | 教师 availability 查询失败后再次点击同一教师，state 值未变化，不能保证重新发起查询 | 显式 refetch；保留目录中的真实教师 ID | 组件回归与真实浏览器 fixture 请求计数 |
| F2 | 切换或清除教师，原查询结果／错误继续显示；旧请求晚到时可能混淆当前教师 | 选择变更清除已查询对象；结果只属于当前已查询教师；新教师可独立查询 | 清除、改选、迟到响应、缓存成功后刷新失败回归 |
| F3 | 教师面板直接显示 User Does Not Exist，无法说明当前查询出了问题 | availability 使用场景化错误、加载态和成功空状态；权限／会话失败单独呈现；周时间、日期和字段使用共享三语言资源与格式 | en、zh-CN、zh-TW 的组件与 390px 浏览器回归 |
| F4 | 6 处 Advisor／Student 消费者把任意 HTTP 404 当成档案／计划尚未创建 | 只有 404 加对应 `STUDENT_PROFILE_NOT_FOUND` 或 `STUDY_PLAN_NOT_FOUND` 才进入空状态／创建流程；其他错误保留错误与既有权限边界 | 8 个创建边界回归、错误分类回归、3 个 Dashboard 404 浏览器场景 |
| F5 | 档案／计划读取失败后，单页错误没有恢复入口 | 提供对应读取的重试按钮 | 组件回归 |
| F6 | Student 消息列表读取失败时同时显示 No messages yet；没有读取重试 | 成功读取空列表才显示空状态；失败显示重试；消息查询仅在消息页启用 | 消息读取失败→重试→列表恢复浏览器回归 |
| F7 | Student 消息附件预览／下载 Promise 失败未接住，点击没有页面反馈；已读操作失败无提示 | 捕获附件错误；失败关闭预览窗口；请求中禁用重复操作；显示可重试提示及已读失败反馈 | 浏览器检查附件请求、失败提示、控件恢复及 pageerror |
| F8 | 文件端点返回 HTML／JSON／空内容时，部分页面暴露底层 usable file bytes 文案 | 错误归类为响应数据异常，复用各消费者的上下文提示；拒绝把错误页面当成文件保存 | 文件工具单测、真实生成 PDF／视频的浏览器模拟服务测试 |

F3 的文案与前端状态修复不能消除原本返回 404 的接口问题。后端问题另见 [Production 接口问题记录](production-function-problems-2026-09-05.md)，仅描述现象、证据和影响。

## 全站清单与证据层次

本轮重新扫描当前源码与 11 份 OpenAPI，共 432 个契约操作、421 个 service 方法。420 个契约操作有匹配的前端 HTTP 方法／路径；2 个 AI service 调用属于独立服务，不在这 11 份 LMS 契约中。

未直接消费的 12 个契约操作是：9 个名称明确 Disabled 的管理操作、`authHello`，以及课程 session／quiz question 的单条读取；现有页面通过集合读取这些记录。没有为了凑齐接口数量新增无需求的控制。

匹配覆盖包含模板参数的字面量联合类型、消息游标 URL 和已逐项检查的附件／媒体 GET helper。此清单不证明全部 payload schema、业务权限、写入持久化或线上结果正确。

证据目录：`output/production-function-audit-20260905/`（原工作区）。

- `source-inventory.json`：逐契约操作、HTTP 调用、service 方法和路由声明。
- `function-inventory.csv`：421 个 service 方法、请求、源码行、调用页面及本轮 Production 未实测标记。service 方法数量不是用户功能数量。
- `route-inventory.csv`：直接声明的路由常量。完整 Router 声明另在 JSON，包含通过其他配置导入的路径。
- `e2e-results.json`：逐个浏览器场景的实际结果；使用模拟 API，不是真实角色会话。
- `production-release-info.json`：本轮读取的线上前端版本。

## 角色与功能覆盖边界

| 角色／功能域 | 本轮前端自动化与源码审查范围 | 本轮 Production |
| --- | --- | --- |
| System Admin | 用户／租户目录、筛选分页、租户详情、归属操作、课程与模考入口、权限隔离、响应式工作台 | 未取得有效角色会话 |
| Tenant Admin | Directory、intake、ownership、课程 delivery、alert rules、模考试卷版本与媒体、管理对话框 | 未取得有效角色会话 |
| Counsellor | intake 队列、创建与详情、Advisor 分配、交接后边界、冲突与草稿保持 | 未取得有效角色会话 |
| Advisor | Dashboard、学生目录／hub、档案、学习计划／版本、课程管理／发布／分配、排课请求、教师 availability、学生 support、消息、模考分配 | 已访问入口但转到登录；availability 仅有上轮 Production 的留存异常证据 |
| Instructor | 教学 Dashboard、课程／周内容、材料预览下载、Roster、作业／批改、quiz、课次／出勤／报告、calendar、个人事件、availability、写作评分 | 未取得有效角色会话 |
| Instructor Advisor | 组合角色路由与能力；Advisor 和教学入口的角色边界 | 只有源码／角色单测，未完成该身份的独立完整浏览器业务链 |
| 课程 TA | 按课程角色与能力控制教学操作、Roster 和内容权限 | 只有课程权限自动化，未取得实际 TA 课程会话 |
| Student | Dashboard、课程材料、作业提交／历史、quiz／grading 可见性、学习计划／任务、消息／附件、calendar、mock listening／reading／writing、词汇学习与暂停恢复 | 未取得有效角色会话 |
| Parent | 已关联学生切换、成绩／反馈、计划、日程请求、报告／attendance、模考结果、消息／附件、通知与分页 | 未取得有效角色会话；既有 Parent–Student 关系未写入 |
| 共享功能 | 登录、登录失效与路由守卫、通知 deep link、文件 bytes 校验、富文本／媒体、日期与三语言资源基础、桌面／移动布局 | 本轮只确认登录入口及公开版本；未做 authenticated 操作 |

完整浏览器场景及对应 spec 文件以 `e2e-results.json` 为准。部分域包含多项交互测试，部分域只有权限或展示测试；不能把这张表转换成每个真实业务分支已经逐个通过。

## 仍然影响完整交付判断的缺口

- 所有角色的当前 Production 登录、真实数据列表→详情→关联资源，以及写入后刷新回读尚未完成。
- 原 availability 异常未取得本轮新响应；历史异常不能宣称已解决，也不能直接扩大成其他角色当前均失败。
- 新修复只在本地分支，尚未线上生效。
- 现有全站多语言迁移仍有未覆盖页面，语言切换入口保留原 release gate。本轮新增 availability 功能与新增反馈资源覆盖三语言，不代表全站已完成单语言验收。
- 独立 AI 服务不是当前角色契约已交付能力，本轮没有进行 AI 服务实现或后端、数据库、基础设施操作。

## 最终实际检查结果

| 检查 | 结果 |
| --- | --- |
| `npm ci --prefer-offline` | 通过；未修改 lockfile |
| `npm run lint:ci` | 通过，零 warning |
| `npm run typecheck` | 通过 |
| `npm run typecheck:production` | 通过 |
| `npm run test:run` | 155 个测试文件，771 项通过 |
| `npm run build` | Production 构建通过 |
| `npm run test:e2e` | 44 个 spec 文件，275 个场景通过；零失败、零跳过、零 flaky、零重试 |
| 三语言基础回归 | `npm run test:run -- src/i18n` 通过；availability 另有三语言组件及浏览器回归 |
| `git diff --check` | 通过 |

最终浏览器执行时间为 2026-09-05 00:34:47 UTC 起，耗时约 135 秒。完整测试使用本地 Production 构建和模拟 API 响应。

第一轮全套浏览器回归有一个旧断言仍期待显示底层文件诊断。更新为本轮预期的上下文提示后，完整重跑 275 个场景全部通过；仍保留 PDF 渲染、下载文件名、下载字节一致性和重试恢复的断言。

本次没有真实 Production 写入、没有改动 Parent–Student 关联、没有改动后端服务或环境值。此处的通过表示前端代码与自动化场景通过，不能解除上方真实角色验收缺口。
