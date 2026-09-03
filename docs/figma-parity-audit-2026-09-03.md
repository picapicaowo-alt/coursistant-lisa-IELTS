# 全站 Figma 与前端核对 / Full-site Figma parity audit

Audit date: 2026-09-03. Scope: frontend source and consumed API contracts only.

> This is the first-pass Figma inventory. The subsequent all-role review and release preparation are recorded in [client delivery review](client-delivery-review-2026-09-03.md).

## 核对结论与边界

此前并非只做 Advisor。GitHub 已有 Student、Instructor、Instructor+Advisor、Counsellor、Parent、Tenant Admin、System Admin 的页面与测试，TA 是课程成员身份而不是单独的账号 level。但“存在页面”和“完整复刻 Figma”是两件事：此前的导航、课程卡、内容层级、消息入口和若干状态仍有明显差异；本地未提交草稿还有固定成绩/日期/人物及无真实请求的动作。这些不能算完成或验收。

本次读取 Figma Page 1 的全部大画板：**69 个界面/状态 + 1 个 UX Flow**。不是 69 条独立路由。学生课程工作区有多张画板也被命名为 `Study plan/student`，已按实际内容映射到课程路由。没有发现独立的 Instructor、TA、Counsellor、Parent、Tenant Admin 或 System Admin 画板；这些角色使用共享设计语法和各自的真实功能。

下表逐项记录页面、弹窗、筛选、详情和成功/错误状态。实现列描述实际功能入口；**不表示每个 Figma 元素都通过像素级验收**。B 开头的差异指向 [backend handoff](advisor-figma-backend-handoff.md)。没有契约支持的功能不会用假数据或伪成功补齐。

## 本地与 GitHub 基线

- 本轮开始时本地 HEAD 为 `5210b37`，分支 `codex/parent-notification-presentation`；保留原有未提交工作后，fetch 并 fast-forward 到 `origin/main` 的 `49c8a1d`（PR #9）。工作分支：`codex/figma-full-site-parity`。
- 原始 19 个前端/文档改动已在本机 `/tmp/coursistant-figma-audit-20260903/initial-local/` 留存副本。未纳入本轮的基础设施目录不属于交付范围。
- [GitHub commit inventory](evidence/figma-parity-20260903/github-commits.csv) 是本次读取的完整 main 历史；[working file inventory](evidence/figma-parity-20260903/working-files.json) 记录第一批审查时的本地交付快照。
- PR #9：Parent 通知呈现；PR #8：认证页面视口适配；PR #7：全角色响应式与认证/Advisor 详情；PR #6：契约接线、历史与折叠布局；PR #4–5：全角色流程与 Dev 验收记录。它们是历史完成范围，不等于本轮 Figma 验收。
- 第一批审查结束时尚未推送、合并或部署。后续发布授权与验收见阶段性交付记录；本表本身不证明 Dev 上的登录态业务验收。

## 设计规则落实

使用共享语义 token：桌面侧栏 180px、白色页面/卡片、浅色描边、紫色主动作、20px 卡片圆角、10px 控件圆角、分层字号和间距。自托管 Inter 变量字体及 OFL 许可，避免只声明字体却实际回退到不同系统字体。字体来源：[Inter 官方许可](https://github.com/rsms/inter/blob/master/LICENSE.txt)。HarmonyOS Sans TC 未随设计提供字体文件，因此系统若未安装该字体，使用文档允许的 Inter 回退；这不是声称已嵌入 HarmonyOS。

核心内容直接展开；仅保留可选编辑器、单层课程/技能详情的展开。主内容、错误、空状态、分页和编辑版本仍来自各自契约。响应式采用弹性栅格、断点重排、移动端任务栏/More、可访问的对话框和可滚动次级区域；不把 1440px 画板作为固定网页宽度。

## 全画板状态矩阵

| Figma node / source name | Frontend route / entry | Implementation or dependency | Contract delta |
|---|---|---|---|
| [17:914](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=17-914) · Dashborad/student | `/` | Student Dashboard: fluid AI / work / schedule columns, filters, notifications; icon-only navigation | B01, B12 |
| [108:882](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=108-882) · Dashborad/student | `/` | Student Dashboard: fluid AI / work / schedule columns, filters, notifications; icon-only navigation | B01, B12 |
| [466:3289](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=466-3289) · Dashborad/student | `/` | Student Dashboard: fluid AI / work / schedule columns, filters, notifications; icon-only navigation | B01, B12 |
| [82:357](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=82-357) · My courses/student | `/course` | White instructor-first course cards; grid/list, status filters and bounded page controls; actual assignment counts | B01 |
| [414:3326](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=414-3326) · Study plan/student | `/course/:courseId` | Course heading, current-content card, tabs, single-level learning-unit outline, learning information rail | B01 |
| [498:4121](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=498-4121) · Study plan/student | `/course/:courseId?materialId=…` | Addressable video/file/link reader with outline, next item, Discussion and course-scoped AI entry | B01, B12 |
| [507:3365](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=507-3365) · Study plan/student | `/course/:courseId?materialId=…` | Addressable video/file/link reader with outline, next item, Discussion and course-scoped AI entry | B01, B12 |
| [494:3386](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=494-3386) · Study plan/student | `/course/:courseId → Assignments` | Assignment/quiz lists and existing assignment submission/feedback routes | — |
| [496:3494](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=496-3494) · Study plan/student | `/course/:courseId → Discussion` | Post/reply/thread/attachment workflow using existing requests | B03 |
| [506:3609](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=506-3609) · Study plan/student | `/course/:courseId` | Note persistence not enabled; source design recorded for backend handoff | B02 |
| [493:3350](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=493-3350) · Study plan/student | `/course/:courseId` | Course heading, current-content card, tabs, single-level learning-unit outline, learning information rail | B01 |
| [772:3458](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=772-3458) · Dashborad/Advisor | `/advisor/operations` | Advisor overview with real counts, attention list, tasks, schedule requests and recent-message links; operational sections stay visible | B04, B06 |
| [792:11208](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=792-11208) · Dashborad/Advisor | `/advisor/operations` | Advisor overview with real counts, attention list, tasks, schedule requests and recent-message links; operational sections stay visible | B04, B06 |
| [783:8276](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=783-8276) · student/Advisor | `/advisor/students` | Assigned-student table, API filters, pagination, responsive labelled records, links to support and student detail | B06 |
| [810:15612](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=810-15612) · messages/Advisor | `/advisor/messages` | Dedicated student directory and conversation; search, unread filter, pagination, message files and reply | — |
| [813:4672](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=813-4672) · messages/Advisor | `/advisor/messages / student parent links` | Parent association read exists in student workspace; independent parent messaging is a contract dependency | B05 |
| [791:10510](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=791-10510) · student/Advisor | `/advisor/students` | Assigned-student table, API filters, pagination, responsive labelled records, links to support and student detail | B06 |
| [803:13456](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=803-13456) · student/Advisor | `/advisor/students/:studentUserId/study-plan` | Actual student summary, learning journey, checkpoint/task dialog and plan editor | B06, B11 |
| [813:4892](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=813-4892) · student/Advisor | `/advisor/students/:studentUserId/study-plan` | Actual student summary, learning journey, checkpoint/task dialog and plan editor | B06, B11 |
| [805:14271](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=805-14271) · student/Advisor | `/advisor/students/:studentUserId/courses` | White course cards, actual lecture progress, View Course information/schedule modal | B07 |
| [818:7178](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-7178) · student/Advisor | `/advisor/students/:studentUserId/courses` | White course cards, actual lecture progress, View Course information/schedule modal | B07 |
| [818:7815](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-7815) · student/Advisor | `/advisor/students/:studentUserId/courses` | White course cards, actual lecture progress, View Course information/schedule modal | B07 |
| [815:5643](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=815-5643) · student/Advisor | `/advisor/students/:studentUserId/courses → Add Course` | Real group-course search/link and one-to-one course creation; instructor/date/time inputs and version safeguards | — |
| [810:15017](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=810-15017) · student/Advisor | `/advisor/students/:studentUserId/exams` | Assigned paper cards and published-template assignment dialog | B08 |
| [816:6276](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=816-6276) · student/Advisor | `/advisor/students/:studentUserId/exams` | Assigned paper cards and published-template assignment dialog | B08 |
| [818:8771](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-8771) · student/Advisor | `/advisor/students/:studentUserId/exams → View results` | Observer result modal, section scores; question-level edit unavailable | B09 |
| [819:9475](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=819-9475) · student/Advisor | `/advisor/students/:studentUserId/exams → View results` | Observer result modal, section scores; question-level edit unavailable | B09 |
| [100:456](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=100-456) · Study plan/student | `/my-plan` | Goal, measured skills, task completion, learning journey and task preview | B01 |
| [148:642](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=148-642) · Study plan/student | `/my-plan?view=tasks` | Status counts, checkpoint steps, task rows, advisor comments and actual upcoming deadlines | B11 |
| [378:1714](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=378-1714) · Dashborad/student | `Header → profile menu` | Avatar, account menu, Profile/Settings/navigation and logout | — |
| [406:2399](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-2399) · Dashborad/student | `Header → profile menu` | Avatar, account menu, Profile/Settings/navigation and logout | — |
| [405:2345](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=405-2345) · Dashborad/student | `/profile` | Purple profile summary, measured skills, insights and activity | B13 |
| [410:2120](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-2120) · Dashborad/student | `/profile` | Purple profile summary, measured skills, insights and activity | B13 |
| [410:2408](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-2408) · Dashborad/student | `/profile → Edit profile` | Native modal with First / Middle / Last / Phone fields and real save | — |
| [408:2433](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=408-2433) · Dashborad/student | `/profile → Change avatar` | Interactive round crop, zoom, preview and save through existing avatar upload | — |
| [406:3008](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-3008) · Dashborad/student | `/settings` | Existing account/password/notification settings with success/error states | B13 |
| [408:1956](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=408-1956) · Dashborad/student | `/settings` | Existing account/password/notification settings with success/error states | B13 |
| [406:1914](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-1914) · Dashborad/student | `/profile → Assessments` | Course-filtered, paginated cards for released assignment results; real feedback route | B13 |
| [399:1628](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=399-1628) · Dashborad/student | `/profile → Assessments` | Course-filtered, paginated cards for released assignment results; real feedback route | B13 |
| [335:1033](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=335-1033) · Calendar | `/calendar` | Day/week/month navigation, category/course filters, timed lanes and mobile agenda | B10 |
| [375:1621](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-1621) · Calendar | `/calendar → Add event` | Real personal event form with date/time picker, timezone/reminder, latest-version edit | B10 |
| [375:1956](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-1956) · Calendar | `/calendar → Add event` | Real personal event form with date/time picker, timezone/reminder, latest-version edit | B10 |
| [375:2540](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-2540) · Calendar | `/calendar → Add event` | Real personal event form with date/time picker, timezone/reminder, latest-version edit | B10 |
| [375:3392](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-3392) · Calendar | `/calendar → event details` | Event information modal, real destination or personal-event edit; supplied categories only | B10 |
| [375:3937](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-3937) · Calendar | `/calendar → event details` | Event information modal, real destination or personal-event edit; supplied categories only | B08, B10 |
| [375:4466](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-4466) · Calendar | `/calendar → event details` | Event information modal, real destination or personal-event edit; supplied categories only | B10 |
| [365:1122](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=365-1122) · Calendar | `/calendar` | Day/week/month navigation, category/course filters, timed lanes and mobile agenda | B10 |
| [201:906](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=201-906) · AI ChatBot/student | `/aibot` | Full-width Study Support workspace, course-scoped chat/composer and separate Workflow tab | B12 |
| [322:865](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=322-865) · AI ChatBot/student | `/aibot` | Full-width Study Support workspace, course-scoped chat/composer and separate Workflow tab | B12 |
| [333:974](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=333-974) · AI ChatBot/student | `/aibot` | Full-width Study Support workspace, course-scoped chat/composer and separate Workflow tab | B12 |
| [410:9227](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-9227) · AI ChatBot/student | `/aibot` | Full-width Study Support workspace, course-scoped chat/composer and separate Workflow tab | B12 |
| [163:698](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=163-698) · Exams/student | `/mock-exams` | Assigned paper cards, actual section filters and status filters; route to the selected paper section | — |
| [423:3034](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=423-3034) · Exams/student | `/mock-exams` | Assigned paper cards, actual section filters and status filters; route to the selected paper section | — |
| [417:2798](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=417-2798) · Exams/student | `/mock-exams/:studentMockExamId/:section` | Existing question workspace, timing, submission, review and error/success behavior under exam authorization | — |
| [427:2930](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-2930) · Exams/student | `/mock-exams/:studentMockExamId/:section` | Existing question workspace, timing, submission, review and error/success behavior under exam authorization | — |
| [427:3588](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-3588) · Exams/student | `/mock-exams/:studentMockExamId/:section` | Existing question workspace, timing, submission, review and error/success behavior under exam authorization | B12 |
| [427:2694](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-2694) · Exams/student | `/mock-exams/:studentMockExamId/:section` | Existing question workspace, timing, submission, review and error/success behavior under exam authorization | — |
| [445:3397](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=445-3397) · Study plan/student | `/my-plan` | Learning journey to checkpoint workspace; actual phases, no invented locked progress | — |
| [445:3823](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=445-3823) · Study plan/student | `/my-plan?checkpoint=…&task=…` | Checkpoint task table, sorting, pagination, detail rail, versioned start/complete, submission draft and focus restoration | — |
| [464:3172](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=464-3172) · Study plan/student | `/my-plan?checkpoint=…&task=…` | Checkpoint task table, sorting, pagination, detail rail, versioned start/complete, submission draft and focus restoration | — |
| [430:2779](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=430-2779) · Study plan/student | `/my-plan?checkpoint=…&task=…` | Task submission/details available; linked quiz destination absent from task response | B11 |
| [715:3994](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=715-3994) · Log in | `/login` | Responsive split artwork and form; real authentication/errors | — |
| [730:4653](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=730-4653) · Create an account | `/signup` | Supported email/code registration form with structured names and required institution context | B13 |
| [731:4840](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=731-4840) · Forgot password | `/forgotpassword` | Email → code → new password → success; code verified atomically with password reset | — |
| [731:4886](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=731-4886) · Verify email | `/forgotpassword` | Email → code → new password → success; code verified atomically with password reset | — |
| [732:4924](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=732-4924) · Verify email | `/forgotpassword` | Email → code → new password → success; code verified atomically with password reset | — |
| [732:4973](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=732-4973) · Verify email | `/forgotpassword` | Email → code → new password → success; code verified atomically with password reset | — |
| [730:4753](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=730-4753) · Sign with | `/signup` | Supported email/code registration form with structured names and required institution context | B13 |
| [729:3484](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=729-3484) · Log in/Error | `/login` | Responsive split artwork and form; real authentication/errors | — |

UX Flow `774:7079` is retained as a workflow reference, not counted as an application screen.

## 全角色入口与边界

| Role / membership | Primary scope checked | Real frontend workflows |
|---|---|---|
| Student | Dashboard, My Courses, Study Plan, Exams, AI ChatBot, Calendar; Vocabulary and Learning overview follow the Figma entries | Assignment/quiz submission and feedback, materials, discussion, advisor tasks/messages, progress, attendance/reports/schedule requests, profile/settings |
| Advisor | Dashboard → Students → Messages; mock-exam workspace | Student intake/profile/plan/courses/exams/support, scoped conversation files, action tasks, schedule decisions, owned courses and delivery |
| Instructor | Teaching dashboard, courses, teaching operations, mock exams, AI, calendar | Grading, roster, course resources/syllabus/announcements/events/groups, attendance, availability, student support, writing grading |
| Instructor + Advisor | Both teaching and advising workspaces | Same role-specific APIs; Advisor menu does not point at the teaching Dashboard route that redirects to a different home |
| TA (course role) | Course workspace | Membership permissions remain authoritative; TA does not become Course Manager and cannot acquire archive/create powers through new layout controls |
| Counsellor | Intake dashboard, unassigned queue, intake form, assignment | Structured names, intake creation/edit, advisor selection, parent links and handover |
| Parent | Student progress, Learning, Schedule, Reports, Exams, Messages, Notifications | Linked-student scope, allow-listed academic reads, parent schedule requests, observer exam results, parent conversation cursor and attachments |
| Tenant Admin | Governance first, intakes, mock templates | Current-tenant directory query/filters/pagination, account lifecycle, ownership transfer, alert rules, audit, intake/parent links, template editing |
| System Admin | Admin Console, course/admin access, system exam administration | Existing system-only management stays separate from Tenant Admin and teaching pages |

The earlier [431-operation source matrix](frontend-operation-matrix-2026-09-02.md) covers the unchanged 11 OpenAPI snapshots. This turn adds direct consumers for existing discussion operations, dated/personal calendar reads, released profile assessments and material readers. A source match is not a backend success claim. Disabled/unauthorized operations and Gate C remain excluded.

## 本轮本地文件统计 / Local delivery inventory

本地前端交付共 **116 个文件**：97 个生产源码/样式/文案文件、13 个测试文件、6 个运行时资源/字体许可文件。该统计包含对原有未提交草稿的修正；原始草稿为 19 个前端/文档文件。GitHub 历史清单共 **112 条提交**。源码统计不含审计文档、日志和 40 张验收截图；完整路径、来源和 SHA-256 见 [working file inventory](evidence/figma-parity-20260903/working-files.json)。

| Module / 模块 | Changed or new files / 文件数 |
|---|---:|
| AdvisorMessagesPage | 2 |
| AdvisorOperationsPage | 5 |
| AdvisorStudentWorkspacePage | 14 |
| AdvisorStudentsPage | 2 |
| Browser tests | 8 |
| CalendarPage | 9 |
| CourseCataloguePage | 5 |
| CourseWorkspacePage | 11 |
| LmsHomePage | 6 |
| MockExamsPage | 1 |
| MyOperationsPage | 2 |
| ParentPortalPage | 1 |
| Runtime assets | 6 |
| Shared / App.tsx | 1 |
| Shared / apis | 2 |
| Shared / components | 13 |
| Shared / configs | 1 |
| Shared / hooks | 1 |
| Shared / i18n | 1 |
| Shared / index.css | 1 |
| Shared / layouts | 3 |
| Shared / styles | 1 |
| StudentAdvisingPage | 4 |
| TenantAdminPage | 4 |
| aibot | 4 |
| profile | 8 |

统计对象是本地工作分支相对 GitHub 基线的当前文件；它不等于新增功能数量，也不包含后台、基础设施或部署改动。

## Verification and review artifacts

Validation results and screenshot links are recorded in [verification](evidence/figma-parity-20260903/verification.md). Test fixtures use isolated `example.test` identities and local intercepted requests; no designated Dev account or production record was altered. Every remaining contract dependency is listed in the handoff, including APIs that exist but expose a generic response rather than a sufficient typed projection.
