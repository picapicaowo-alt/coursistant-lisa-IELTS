# 后端修复说明的前端适配记录

日期：2026-09-05。范围：B1、B2、C1–C4、N1。

依据：[用户提供的后端适配说明](backend-fix-adaptation-source-2026-09-05.md)。本轮直接采用该说明补充前端消费契约和实现，没有要求另行提供 OpenAPI。说明中的接口约定是实现依据；其中“新 JAR 尚未发布”是交接时的状态，并非本轮线上部署核验结果。

## 已完成的行为

| 项目 | 前端适配 |
| --- | --- |
| B1：Advisor 课次 | 保留 owner 课程的课次入口和既有接口。200 空数组显示无课次；404 显示课程不可访问，不能转为空课表。 |
| B2：资料删除 | Course Manager 可删除；active TA 可删除自己上传的资料；具备上传权限的 Instructor 仅可删除自己的 DRAFT 资料。403 显示无删除权限，成功后刷新周资料。 |
| C1：已保存试卷内容编辑 | Reading、Listening、Writing 的已有 DRAFT section 使用 authoring GET 加载、PUT 全量替换；缺失 section 保留 POST 创建。GET revision 随编辑草稿保存，PUT 带 expectedContentRevision，成功使用新 revision。409 不自动覆盖，要求显式加载最新内容；锁定或 section 缺失引导返回版本页。请求构造移除响应实体 ID、preview URL 和 contentRevision，保留题目 payload 的 question IDs。 |
| C2：答案契约 | 单答案与等价答案列表互斥，多选按每个 questionId 保存一个选项并检查完整覆盖。学生提交按试卷真实题号生成完整答案集合，未答为空字符串，限制每题 512 字符，不固定为 1–40，也不改写答案中的标点、内部空格或词序。 |
| C3：学习任务附件 | 学生使用 multipart file 上传，expectedVersion 放 query，浏览器生成 boundary；上传后先应用 taskVersion，再允许完成任务。非空说明或已绑定文件满足提交条件。任务和完成请求移除 object key。Advisor 通过鉴权 Blob 接口预览 PDF/图片或下载附件；Office 文件仅下载。支持说明中列出的格式和 100 MiB 上限。 |
| C4：Parent 学生身份 | linked-students 消费分页学生身份结构，以结构化姓名、email、avatar 字段呈现选择项和选中学生身份；不再当作 Parent–Student link 结构。 |
| N1：待审批数 | hub 徽标沿用后端 pendingRequestCount；请求列表总数使用响应 total。Advisor 待处理识别 PENDING_ADVISOR，并兼容旧 PENDING 状态；排除状态缺失、未知状态、PENDING_INSTRUCTOR 和已处理项。审批后刷新 hub 和相关请求队列。 |

新增及本轮修改的提示、按钮、校验和状态文案同步提供 English、简体中文、繁體中文。文件上传使用本地化按钮，避免依赖浏览器原生文件输入的语言。

## 主要实现位置

- 试卷编辑：`lms/src/pages/MockExamsPage/tenant/SavedSectionEditor.tsx`、`authoringContent.ts`、`TenantSectionComposer.tsx`；答案：`lms/src/utils/mockExamAnswers.ts`。
- 任务提交：`lms/src/pages/StudentAdvisingPage/useTaskSubmission.ts`；导师附件：`lms/src/pages/AdvisorStudentWorkspacePage/TaskSubmissionFile.tsx`。
- 资料权限：`lms/src/pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx`；课次：`lms/src/pages/TenantCourseDeliveryPage/OwnerCourseSchedule.tsx`。
- 家长：`lms/src/pages/ParentPortalPage/useLinkedStudents.ts` 和 `index.tsx`；审批状态：`lms/src/pages/advising/scheduleRequests.ts`。
- 消费契约：`docs/api/mockexam.openapi.yaml`、`advising.openapi.yaml`、`parent.openapi.yaml`、`course.openapi.yaml`。仅补充本轮说明覆盖的内容，并注明来源；不是后端完整导出。

## 验证

所有验证针对本地共享工作区快照。该工作区已有其他改动，以下整库检查结果不代表这些改动均由本轮产生。

- `npm run lint:ci`、`npm run typecheck`、`npm run typecheck:production`：通过。
- `npm run test:run`：185 个文件、953 项通过。
- 三语资源与相关界面检查：29 个文件、191 项通过，包含静态 key 和资源完整性检查；与完整单测存在重叠，不相加。
- `npm run build`：通过；保留现有大 chunk 警告。
- 浏览器回归覆盖本轮新增适配、试卷创作、Parent 分页、Advisor 课程课次、学习流程三语和 Instructor 资料操作六个 spec。最终 87 项全部通过（Chromium，3 workers，0 retries）；未运行无关功能的全量浏览器套件。
- authoring fixture 验证三科 × 三语的连续两次保存、版本冲突后显式加载；任务附件验证 multipart、返回版本和仅文件完成；Parent 验证分页姓名及语言持久化；N1 验证审批后计数与列表刷新。
- B2 验证上传文件/链接、本人草稿删除、403 后资料保留、重试与列表刷新；单元测试另覆盖 TA/Instructor/Manager 权限边界。
- 人工查看繁体中文手机截图，检查试卷编辑和任务附件操作的文案与可见布局。
- YAML 可解析、相关 diff 空白检查通过；未修改 lockfile。

原始日志与浏览器截图位于 `output/backend-fix-adaptation-20260905/`。

## 尚待线上验收

本轮为前端代码与 fixture 验证，未发布 Production，也未把本地通过当作新后端已部署或真实业务链路已通过。后端新版本部署后，按同一 B1、B2、C1–C4、N1 范围复测真实角色、保存后的持久化、附件读取和审批计数。没有对后端、数据库或基础设施进行修改。

## Production 集成候选

发布分支从最新 `origin/main`（初始 `b31732d`）建立，仅迁移本轮适配。保留已合并的三语界面、目录分页、课程排程锁定、消息发送保护、自定义确认弹窗和上传期间编辑行为。前文 953 单测和 87 浏览器用例是原共享工作区记录；发布候选独立运行完整检查，结果由 PR CI 和本轮发布记录提供。
