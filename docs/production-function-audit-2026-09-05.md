# Production 全站功能审查记录

本轮以 `https://app.xlearnedu.com`、API `https://api-cn.xlearnedu.com/api` 为准，使用启澜雅思学院（测试用，tenantId=1）的真实账号。**已完成现有账号的身份验证和下述业务链实测，修复可在前端解决的问题；仍有 4 项外部接口问题，不能标为零 broken functions 或全角色交付通过。**

用户补充账号后，本轮继续验证了 4 个 Counsellor、8 个 Advisor、10 个 Instructor 和 1 个 Student。availability 按用户最新要求跳过，未继续调用；此前已经写好的 availability 前端修复保留在分支中。

## 版本和修复位置

- 本轮读取的线上版本：`8885badb01fe5a633f1cb61d6d1fd1189c5697d6`，release `20260905T001430Z-8885badb-system-admin`。
- 独立分支：`codex/production-function-audit`；代码目录：`/private/tmp/coursistant-production-function-audit`。
- 原工作区开始时有 668 项既有变动，本轮代码在独立 worktree 修改，未覆盖原变动。
- 尚未 push、merge 或部署。**修复通过本地验证，不代表 Production 已经运行修复后的代码。**

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
| F9 | 没有学习档案的学生仍看到创建学习计划表单，提交时缺少必需 profileVersion | 先读取真实档案；未建档时提供档案入口；读取异常可重试，读取成功后再显示计划表单 | 缺档案、读取失败及重试恢复组件回归；真实新学生业务链 |
| F10 | Advisor 课程列表的 courseLaunchVersion 为 null，课程发布操作缺少版本令牌；同一课程 delivery-config 实际返回版本 0/1/2 | 使用现有 delivery-config 读取缺失的令牌，核对课程 ID 与版本；保留用户审阅版本和冲突恢复机制 | 7 项单测；浏览器验证读取失败→重试→Ready 请求使用版本 0→再次打开使用版本 1 |
| F11 | 教学提醒实际返回 kind 和 pendingCount，页面只读 type/alertType，提醒退化为泛化标题 | 读取真实 kind；显示待批改数量和课程提醒；保留接口已有文案 | 实际教学 feed；en/zh-CN/zh-TW 及 0/1/多条提醒回归 |
| F12 | 模考阅读／听力只发送已回答题号，空白或部分作答提交被拒绝 | 按试卷实际题号补齐空白答案，过滤不属于当前试卷的答案键；手动和计时结束提交共用逻辑 | Production 部分键请求 400；全部题号加空字符串请求 201；单测与两科浏览器请求体回归 |
| F13 | Student Quiz 历史从 my-attempts 读取结果摘要，缺失 startedAt/id 等作答字段，导致整个页面崩溃 | 历史改为读取契约明确允许学生查询自己的 attempts；修正结果摘要 TypeScript 类型 | Production 实际崩溃与配对响应；浏览器验证成绩、历史、对应结果和 receipt 正常打开 |
| F14 | 已提交模考的成绩链接重新打开空白答题页与新计时器，无法查看写作原文和反馈 | 从现有详情响应识别已提交科目，显示只读成绩和写作原文／反馈；其他未提交科目保持可作答 | 真实已完成模考入口复现；3 项状态单测；三语言、刷新、390px 和部分提交科目的浏览器回归 |

F1–F3 是 availability 跳过指示前已完成的前端工作，其接口问题本轮不再复验。F4–F8 是本分支前一阶段的故障处理修复；F9–F14 是拿到账号后继续定位的修复。未通过隐藏业务入口、伪造数据或改变角色来绕过接口失败。

## 当前 Production 证据与覆盖

记录文件包含 **482 条 HTTP 请求**：首轮 301 条（23 次登录、23 次退出、255 次业务读取）及后续 181 条业务请求。23 个账号都成功登录，返回 userId、level、role 与提供的身份一致。COUNSELLOR 是服务端职级；所有这些账号的登录 role 均为 USER。

11 份契约共有 432 个操作条目，其中 9 组方法／路径重复出现在不同文件，去重后为 423 个操作。当前记录匹配 **165 个不同操作**（对应 171 个契约条目）。这是方法与路径的实际响应覆盖，包含正常权限拒绝、正常业务前置条件及少量诊断性无效请求，**不是 165 个操作的所有状态和参数均已通过**。浏览器操作另有下表的页面观察；未将浏览器点击数混入 HTTP 数量。

| 身份 | 真实接口验证 | 真实浏览器验证与边界 |
| --- | --- | --- |
| Counsellor，4 个账号 | 四人分别登录、队列／Advisor 目录等读取、退出；csl1 intake 创建／编辑／分配后由 Advisor 接收，原 Counsellor 读取交接记录返回 404 | csl1 完成 intake 创建、背景资料保存和刷新读回、Advisor 分配、队列变化、退出 |
| Advisor，8 个账号 | 八人分别登录、Dashboard／学生／目录／排课请求等读取、退出；adv1 档案、计划、课程编排与发布、课时、调课审批、模考分配；adv2 读取不属于自己的学生档案被隔离 | adv1 学生目录、工作台、档案编辑、计划创建与历史、退出；版本缺失造成的操作问题在本地修复后用 fixture 验证 |
| Instructor，10 个账号 | 十人分别登录、教学／批改／日历等读取、退出；ins1 课程、周、大纲、材料、作业、Quiz、出勤、报告、日程、调课审核、模考评分；ins2 对他人课程／事件／评分读取均不可见 | ins1 教学首页、课程内容、大纲 PDF 预览、批改弹窗、成绩发布、通知跳转与已读、日历编辑、退出；材料上传和成员读取有下述阻断 |
| Student，1 个账号，userId=26 | 登录、课程／档案／计划／任务／消息／日程等读取，真实作业文件提交、Quiz 作答与发布可见性、任务完成、调课申请、报告、课时、模考三科提交与评分读回、API 退出 | 首页、课程、成绩总览、Quiz 崩溃复现、计划任务、已发布报告详情、词汇重试失败、已完成模考误入答题页复现；最后的浏览器退出确认遇到 Mac 锁屏，未记为通过 |
| Parent | 无当前可用账号 | 未取得真实身份；未改动任何 Parent–Student 关系 |
| Tenant Admin / System Admin | 无当前可用账号 | 当前仅源码与自动化覆盖，未借用其他角色模拟其线上身份 |
| Instructor Advisor / 课程 TA | 无此实际身份或课程成员会话 | 当前仅权限／路由自动化；普通 Instructor 不能代替组合角色或 TA 的验收 |

## 真实业务链结果

所有写入均用于明确标记 QA 的测试记录或用户给出的测试 Student；没有修改既有 studentId=25 的业务记录。

| 业务链 | 实际观察 |
| --- | --- |
| Intake → 指派 → 学生档案 | 创建 intakeId=3、studentId=27，指派 Advisor 7；Advisor 浏览器可见。档案创建 201；后续浏览器编辑保存和 API 回读 profileVersion=1。首次浏览器创建出现过一次无 HTTP 响应的网络失败，未将单次现象定性为后端缺陷 |
| 档案 → 计划 → 学生任务 | student26 profileId=1、planId=1；任务 1 从 NOT_STARTED → IN_PROGRESS → COMPLETED，版本 0→1→2；Advisor 回读一致；Student 页面显示 1/1 完成 |
| 一对一课程编排与发布 | courseId=1 DRAFT→READY→PUBLISHED；发布前缺大纲和周内容返回明确 COURSE_NOT_READY；补齐后发布成功，Student 从不可见变为可见；独立 Instructor 无权读取 |
| 大纲与教学材料 | 大纲 PDF 上传成功并在真实 Chrome 预览为一页；619 字节文件下载与 checksum 对应。Advisor 上传材料、Instructor 发布、Student 下载成功；Instructor 自己上传被拒绝，见问题文档 |
| 作业提交 → 批改 → 发布 | assignmentId=1；Student 暂存文件后提交，Instructor 读取原附件；浏览器评分 8/10 并发布。发布前 Student score 隐藏，发布后读回 8/10 与反馈；首页完成率为 100% |
| Quiz 作答与结果 | quizId=1、attemptId=1；学生题目不包含正确答案字段；保存 selectedOptionIds 后读回，提交得到 receipt；发布前分数隐藏，发布后成绩 1/1。历史页的错误数据消费造成前端崩溃，已修复 |
| 课次与出勤 | Advisor 生成 occurrenceId=1；Instructor 读取名单并保存 PRESENT，Student 个人出勤读取成功。该课次随后被用于调课测试；不能把变更前后的汇总数字当作同一时刻的数据 |
| 跨角色调课 | Student requestId=1 → Instructor APPROVE → Advisor APPROVE，状态 PENDING_INSTRUCTOR→PENDING_ADVISOR→APPROVED，replacementOccurrenceId=2；新时间读取成功 |
| 课时 | 正确使用 purchasedMinutes=120 和 expectedVersion=0 创建课时账户；Student 读取 purchased/remaining 信息成功 |
| 学习报告 | reportId=1 MID_TERM 创建、发布成功；Student、Advisor 读取已发布报告成功；学生浏览器展开实际五段反馈及发布时快照 |
| 个人日程 | Instructor 创建事件 1、编辑、浏览器再次编辑并回读 version=2；另一教师读取 404。删除两次均 500，随后记录仍存在 |
| 模考 | 已发布 templateId=1 分配为 studentMockExamId=1；三科试卷读取、听力音频和写作图片均 200。Reading/Listening 40 个空白题号提交各 201；Writing 两项合成作答提交 201。全部科目提交后进入指定教师待批改队列，评分 6.5 后 Student 回读 COMPLETED 与反馈，其他教师读取评分 404 |
| 消息和通知 | 实际消息列表读取；Instructor 通知点击后跳到课程并更新已读。未主动向其他人发送测试消息、公告或邮件；附件异常恢复另有 fixture 回归 |
| 详情读取补查 | 另补查 35 条读取：计划历史、教学动态、公告／讨论列表、报告详情、提交版本、作业文件、Quiz 详情及整周 ZIP 下载等。33 条返回 200；未上传 rubric 的 RUBRIC_NOT_FOUND 和已提交 Quiz 无当前 attempt 的 QUIZ_ATTEMPT_NOT_FOUND 为正常状态 |
| 词汇 | 学生实际入口显示词库读取失败，重试仍失败；配置对应 URL 的公开读取返回前端 HTML，见问题文档 |

## 未解决的问题与未覆盖分支

当前 4 项未能通过前端修复的问题，单独写在 [Production 功能问题记录](production-function-problems-2026-09-05.md)。该文件只包含现象、角色、请求、响应和影响，不包含后端实现建议或验收标准。

未覆盖部分明确保留为未验证：Parent／两个管理角色／组合角色／实际 TA；全部管理写操作、所有删除或撤回变体、消息发送与邮件实际投递、AI 独立服务、所有数据量及并发组合。没有把 23 个账号成功登录等同于其全部功能通过。

新功能反馈与模考结果资源覆盖 en、zh-CN、zh-TW。已验证新结果页的三语言、刷新保持与手机宽度，原有全站多语言迁移仍有欠缺；本轮不宣称全站已完成三语言迁移。Production 的桌面页面经过目视核对；浏览器 viewport 覆盖尝试后实际宽度仍为 1710，随后遇到锁屏，已重置覆盖，因此未将它写成真实 Production 手机宽度通过。手机与其他响应式宽度的证据来自本地浏览器自动化。

## 自动化与源码清单

源码扫描覆盖 11 份 OpenAPI、432 个契约操作条目（去重后 423 个）、421 个 service 方法，420 个契约条目有对应方法／路径调用；两个 AI 调用属于独立服务。没有匹配 HTTP 调用声明的 12 项包括 9 项 Disabled 管理操作、authHello 和两个由集合读取覆盖的单条资源读取。没有为凑齐数量新增接口或功能。

证据保存在原工作区 `output/production-role-live-20260905/`：

- `api-reads.json`：23 个账号身份检查和首轮 301 条请求。
- `workflow-api.jsonl`：后续 181 条业务请求及脱敏响应；不包含密码、Cookie、访问令牌。
- `operation-live-matrix.csv`：逐项列出 432 个契约条目的当前响应证据与未实测标记；统计按方法／路径去重。
- `function-live-correlation.csv`：421 个 service 方法与实际 HTTP 路径证据的相关性；相关性不代表每个调用分支完成。
- `live-summary.json`：上述请求和操作统计。
- `e2e-results-final.json`、各检查日志、`screenshots/`：实际本地检查和截图；模拟 API 的浏览器结果不等于 Production 写入验收。

首阶段源码清单及补丁另在 `output/production-function-audit-20260905/`。诊断期间使用过不存在的路径、错误枚举、遗漏字段等请求；原始日志保留，但它们不计入外部问题。正常的未建档 404、未授权跨角色 404/403、发布前置条件 409 也不计入 broken functions。

## 最终检查

| 检查 | 最终结果 |
| --- | --- |
| `npm run lint:ci` | 通过，零 warning |
| `npm run typecheck` | 通过 |
| `npm run typecheck:production` | 通过 |
| `npm run test:run` | 159 个文件、790 项通过 |
| `npm run build` | Production 构建通过，未改变 lockfile |
| `npm run test:e2e` | 44 个 spec、284 个场景通过；零失败、零跳过、零 flaky |
| `git diff --check` | 通过 |

最终完整浏览器回归开始于 `2026-09-05T01:47:58.228Z`，耗时约 60 秒。新增模考结果页的手机截图已单独检查并留存。

测试期间发现默认 4173 被另一个项目占用，已停止误连该服务的测试，使用本 worktree 独立 13105 端口重新构建并运行；误连结果不作为本项目缺陷或通过证据。另一次 lint 与浏览器测试并行时碰到 test-results 目录正在重建，已按顺序重跑；未通过忽略错误改变检查结果。

## 测试数据留存

为使操作可追溯，保留 QA intake3／student27、student26 和 student27 的测试档案与计划、course1、week1、material1、assignment1 及提交／成绩、quiz1 及 attempt1、occurrence1/2 和 scheduleRequest1、hours 账户、report1、studentMockExam1 和 writingGrade1。评分与反馈明确为合成 QA 数据，不代表学生真实能力。

personalEvent1 删除失败，记录仍保留，最近标题为 `QA0905 calendar browser edit verified`。未为了清理测试痕迹删除课程、学籍、成绩、报告或学生关系。现有模考试卷模板仅被读取／分配，没有修改模板内容。
