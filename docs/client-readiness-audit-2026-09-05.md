# Tokyo Prod 全站继续排查与客户端发布准备

**可确认的前端问题已修复并通过完整回归；当前仍不能标为“全站、全用户、所有功能可正式交付”。** 两项真实后端运行问题、四项消费合同缺口，以及尚未完成的真实角色覆盖和全站语言迁移仍影响该结论。

本轮是对用户提供的 `tokyo-prod-backend-issues-2026-09-05.md` 的继续排查。该文件作为既有问题证据使用；操作范围来自用户本轮请求。

## 范围与代码状态

- 真实环境：`https://app.xlearnedu.com`；API：`https://api-cn.xlearnedu.com/api`；启澜雅思学院测试租户 `tenantId=1`。
- 线上和 `origin/main` 基线均核对为 `a6f137631a668dfb0ac6806c708e527c02377723`。
- 本轮在独立分支 `codex/client-readiness-audit-20260905`、目录 `/private/tmp/coursistant-client-readiness-20260905` 工作。原工作区已有 764 项变动，未覆盖这些源码变动。
- 合并此前尚未上线的 `codex/production-function-audit` 修复，并解决与最新 main 的代码、三语言资源冲突，再增加本轮发现的四项修复。
- **本报告对应候选代码；尚未合并 main、尚未部署 Prod。** 线上旧版复现与本地修复验收分别记录。

## 前端修复

下列修复均使用现有 API 能力。没有新增未经合同支持的端点、改变角色权限或用假数据填补错误。

| 编号 | 问题与修复 | 证据 |
| --- | --- | --- |
| F1–F3 | 继承教师 availability 查询、切换身份时的结果归属、失败重试和三语言状态修复 | 本地组件／浏览器回归；按照先前用户指示，本轮没有继续调用 availability |
| F4–F8 | 继承档案／计划精确 404 分类、重试、学生消息错误与空列表分离、附件异常处理和无效文件响应处理 | 组件及浏览器失败恢复回归 |
| F9–F10 | 创建学习计划须先有真实档案；课程发布缺失版本从现有 delivery-config 读取，保留版本冲突机制 | 真实合同与响应，版本／错误恢复回归 |
| F11 | 教学提醒消费真实 `kind` 和 `pendingCount`，避免退化成泛化标题 | 本轮真实教学动态 200；三语言单测 |
| F12 | 模考阅读／听力按试卷真实题号补齐空白答案 | 继承之前真实提交证据；当前完整题号请求体回归 |
| F13 | Quiz 历史使用作答 `/attempts`，不再误把 `/my-attempts` 的成绩摘要当作带 `startedAt` 的历史记录 | 本轮线上仍复现整页崩溃；两种真实响应对照；修复后历史／成绩浏览器回归 |
| F14 | 已提交模考科目打开只读结果，写作显示已保存原文和反馈 | 本轮线上已评分写作仍进入空白答题器；候选代码通过三语言、刷新、390px 和部分提交状态回归 |
| F15（新增） | 分组成员消费 `userFirstName/userMiddleName/userLastName`，未分组学生消费 `studentFirstName/...`；兼容旧 displayName 和本地化缺省身份 | 真实成员原先显示 User 26；实际 API 已有姓名。两项单测和三语言姓名／移动请求回归 |
| F16（新增） | 未分组学生读取失败时不再显示 0 人；增加局部重试，错误或读取中禁用随机分配入口 | 错误→重试→真实结构列表恢复的三语言回归 |
| F17（新增） | 分组重命名请求中禁用 Save／Cancel，避免重复提交；空名称禁用保存 | 延迟请求回归确认只产生一次写入 |
| F18（新增） | 模考卡片与筛选统一使用考试的 `status`；不再以 `attemptStatus=SUBMITTED` 覆盖 `status=COMPLETED`，已修改状态标签走共享翻译层 | 本轮实际 list 返回这两个不同值；三语言筛选值仍保持原始 API 枚举 |

F1–F14 的历史发现过程见 [先前审查快照](production-function-audit-2026-09-05.md)。该快照的旧接口故障、检查数字和部署状态不能替代本轮结果。

## 真实身份与覆盖

22 个给定员工账号及已有 Student 26，共 **23 个账号全部成功登录**，返回 userId、职级和登录角色与预期一致。Counsellor 4 人、Advisor 8 人、Instructor 10 人、Student 1 人；员工登录角色为 USER，职级按各自身份返回。

本轮记录 **428 条 HTTP 响应**：账号和读取扫描 328 条、后续业务请求 67 条、会话检查 20 条、词汇业务／退出记录 13 条。这个数字包含正常拒绝和诊断请求，不是 428 个功能通过。交互客户端额外的建会话／退出、公开预检和浏览器动作未混入统计。

11 份消费合同共有 432 个操作条目、去重后 423 个方法／路径；本轮记录匹配 99 个不同操作（104 个合同条目）。未匹配的操作逐项保留为未实测，不推断其成功或失败。

| 身份 | 本轮真实验证 | 覆盖限制 |
| --- | --- | --- |
| Counsellor 4 人 | 分别登录、目录／队列等读取、退出；csl1 额外验证 refresh→profile→logout→refresh 拒绝 | 本轮未新建和交接 intake；此前业务链证据只作为历史记录 |
| Advisor 8 人 | 分别登录、学生／目录／Dashboard／课程等读取、退出；adv1 课程配置、课次、清理本人有权管理的测试材料；adv2 学生范围隔离 | 同课程课次 404 仍阻塞；本轮未重复创建学生／发布课程／发送消息 |
| Instructor 10 人 | 分别登录、教学／批改／日历等读取、退出；ins1 真实分组与个人日程写入、材料上传／删除拒绝、作业名单和附件；ins2 无权资源拒绝 | 浏览器实测 ins1 课程、分组、成员移动、Settings、退出；修复后的 UI 尚未上线 |
| Student 26 | 登录、课程／计划／任务／报告／课时／作业／Quiz／模考读取，分组加入／切换／退出，词汇读取／恢复／揭示／暂停 | 浏览器验证 Dashboard、学习计划、词库和线上旧 Quiz／模考错误；本轮不重复提交作业、考试或召回评分 |
| Parent、Tenant Admin、System Admin | 源码和本地角色回归 | 在已查历史中未找到可确认适用于该 Prod 租户的可用凭据，本轮未取得真实登录态 |
| Instructor Advisor、课程 TA | 本地权限／路由回归 | 没有实际组合身份或 TA 课程成员会话，不能以普通 Instructor 代替 |

四类代表身份（Counsellor、Advisor、Instructor、Student）的 API 会话均通过：登录 200→刷新 200→profile 200→退出 200→刷新 401 `REFRESH_TOKEN_INVALID`。响应包含正确的 app Origin 和 credential CORS 头，详见 [会话记录](evidence/client-readiness-20260905/auth-sessions.json)。这些 API 检查不代替所有浏览器登录状态行为。

## 本轮业务链结果

| 业务链 | 真实观察 |
| --- | --- |
| 课程分组 | 新建 groupSet1、两组；Student 加入→切换；锁定后退出返回正常 `GROUP_LOCKED`；解锁→退出；Instructor 指派→移动。真实浏览器再次移动成员成功，API 回读一致 |
| 成员与权限 | Instructor1 成员列表 200，包含真实拆分姓名。Instructor2 分组、作业附件、评分和事件读取被 403／404 拒绝；Student 调 Parent 接口、Instructor 调系统用户目录均拒绝 |
| 个人日程 | event3 创建 v0→编辑 v1→持 expectedVersion=1 删除 200→回读 `PERSONAL_EVENT_NOT_FOUND`。其他教师不可见 |
| 材料 | 本人草稿上传 200；本人删除 403；owner Advisor 清理 200。原材料 1 保留 |
| 作业与文件 | grading-roster、指定学生 grading、Student submission、my-grades 均 200；已发布 8/10 成绩与已存文件可读。Instructor 预览和 Student 下载均为 619 字节 PDF；无权教师读取拒绝 |
| Quiz／模考 | 正确历史读取 200，旧结果摘要误用已定位；已评分模考详情与列表均有真实成绩，卡片状态误用和重新答题问题已在候选代码修复 |
| 计划、课时与报告 | 真实计划显示 1/1 任务完成；课程已购／剩余 120 分钟及发布报告 1 读取 200。没有把旧测试评分解释为真实学习能力 |
| 词汇 | 实际配置基址返回 JSON；列表、词库、单元、既有会话读取 200；同一 TEST 会话 PAUSED→ACTIVE→揭示答案 200→PAUSED，位置仍为 4，未评分、未跳到下一词 |

旧的 Instructor 材料上传拒绝、成员读取拒绝、日程删除故障及词库 HTML 入口问题已被本轮新响应取代。当前后端清单见 [后端 Markdown](client-readiness-backend-handoff-2026-09-05.md)。

## 浏览器与测试数据边界

Student 线上 Dashboard 在实际 390px 视口测得 clientWidth=scrollWidth=390；临时视口已重置。全角色及其他断点来自本地 fixture 回归，未写成全角色真实 Prod 手机验收。

后半程浏览器工具出现 CDP 超时，原写作标签页失去响应；同一浏览器的新标签页可直接加载真实计划和词库，但后续点击不能取得可信的完成状态。本轮没有将这些点击、学生最后一次浏览器退出或新代码的线上交互列为通过，也没有据此推断产品导航故障。

本轮清理了新建 groupSet1、group1/2 及其成员关系、personalEvent3、material4；回读确认不再存在。旧课程、学生关联、作业、成绩、报告和学习计划保留。词汇已有会话恢复为 PAUSED，位置 4、未评分；本轮揭示过当前单词答案，因此揭示状态保留为 true，不声称全部学习状态原样不变。未发送消息、公告或邮件，未改密码、权限或 Parent–Student 关系。

诊断排除：旧脚本误用 `/courses/1/groups`，正确消费路径 `/group-sets` 返回 200；GET 作业 `/submissions` 误用了仅支持提交的操作，改查 grading-roster／submission 后通过；词汇空体手工请求多带 JSON Content-Type 曾返回 500，按浏览器 Axios 实际去除该头后 reveal 200。缺档案／缺计划、正常无权资源和锁定业务拒绝也不算故障。

## 最终检查及发布差距

| 检查 | 本轮结果 |
| --- | --- |
| `npm run lint:ci` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run typecheck:production` | 通过 |
| `npm run test:run` | 163 个文件，810 项通过 |
| `npm run build` | 通过；保留现有大 chunk 提示，没有依赖／lockfile／环境值变化 |
| `npm run test:e2e` | 314 项通过，零失败；使用独立 4262 端口与模拟 API |
| `git diff --check` | 通过 |

新增／修改的姓名缺省、错误、保存、考试状态和结果文案使用共享 en／zh-CN／zh-TW 资源，已测键一致性及相关三语言场景。全站存量语言迁移仍有欠缺，本报告不替其他正在进行的语言工作宣告完成。

正式全量交付还缺：上述运行／合同阻塞闭环；未取得身份的真实角色业务验收；修复代码部署后的真实登录、刷新、操作和退出验收；全部语言迁移完成。消息发送／邮件实际投递、AI 独立服务、全部管理写入、所有撤回／删除和并发组合仍未验证。不能用构建或模拟 API 回归代替这些证据。

## 可追溯证据

- [身份与检查摘要](evidence/client-readiness-20260905/live-summary.json)
- [432 条消费合同操作的本轮覆盖表](evidence/client-readiness-20260905/operation-live-matrix.csv)
- [后端问题响应](evidence/client-readiness-20260905/backend-responses.json)
- 原工作区 `output/client-readiness-20260905/`：完整脱敏读取和业务日志、词汇前后两次请求记录、lint／类型／单测／构建／E2E 日志。

报告和提交不包含密码、访问令牌或 Cookie。原始本地证据不整包提交到代码仓库。
