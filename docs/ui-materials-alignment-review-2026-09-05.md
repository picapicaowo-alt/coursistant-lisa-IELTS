# 课程资料与标签对齐审查 — 2026-09-05

审查范围：截图对应的学生课程资料、Advisor 行动任务，以及复用相关控件的顾问概览和教师资料界面。依据当次获取的 [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)。这是一轮相关页面审查，不代表全站、全角色验收完成。

## 已修复

- `lms/src/pages/AdvisorOperationsPage/AdvisorTasksPage.module.scss:6` — 原来每行独立分配宽度，状态与优先级随按钮数量漂移；改为列表共用列宽，移动端按标题、标签、操作重排。
- `lms/src/pages/AdvisorOperationsPage/AdvisorTasksPage.tsx:225` — 详情中直接显示状态代码、日期跟随浏览器而非产品语言；使用现有状态标签和共享日期格式化，关闭详情恢复触发按钮焦点，详情选择同步 URL。
- `lms/src/pages/AdvisorOperationsPage/AdvisorDashboardOverview.module.scss:11` — 顾问概览中的任务及学生标签也改用共享列；补齐链接焦点和触控区域。
- `lms/src/components/AdvisingBadge/index.module.scss:14` — 高优先级标签改用现有深色危险文本 token，保留原有浅粉语义背景。
- `lms/src/pages/CourseWorkspacePage/components/CourseDetailView/index.tsx:58` — 学生学习单元默认展开，保留独立收起操作；不再重复显示单元大标题。
- `lms/src/pages/CourseWorkspacePage/components/CourseDetailView/index.tsx:78` — 多资料时提供学习单元下拉框与资料搜索；筛选基于已加载数据，可组合使用并保留在 URL，支持清除无结果筛选。单份资料不增加筛选栏。
- `lms/src/pages/CourseWorkspacePage/components/CourseDetailView/index.module.scss:665` — 文件类型、名称、大小和操作共用列；长名称自然换行，小屏将按钮放在文件信息下方，操作目标至少 44px。
- `lms/src/pages/CourseWorkspacePage/components/CourseDetailView/index.module.scss:684` — 资料名称、全部下载、单元展开按钮和课程页签补齐明确的键盘焦点。
- `lms/src/pages/CourseWorkspacePage/components/CourseDetailView/GradesCard.module.scss:3` — 成绩名称与分数按基线对齐，数值使用等宽数字，链接触控区域扩到 44px。
- `lms/src/pages/CourseWorkspacePage/index.tsx:76` — 课程权限尚在读取时等待，避免教师短暂看到学生资料布局。
- `lms/src/pages/CourseWorkspacePage/components/PageBody.tsx:68` — 切换课程重新建立详情局部状态，避免上一门课程的收起状态残留。

本次新增及修改文案均接入共享 i18n，补齐 en、zh-CN、zh-TW；资料错误保存语义信息，在渲染时翻译，因此切换语言也会更新已经显示的错误。

## 数据与交互边界

- 现有 CourseWeek 就是排序后的学习单元，标题可以由教师命名为章节或周；没有新增 Section / Chapter API 层级。
- 单元与资料搜索使用现有周资料响应中的标题、资料显示名及原文件名；不假设有服务端搜索接口。
- 文件预览、下载和 ZIP 使用现有 `courseApiService` 及 `docs/api/course.openapi.yaml` 中对应接口。
- 搜索期间隐藏整组 ZIP 操作，避免用户以为只会下载搜索结果。正常浏览学习单元时保留整组下载。

## 浏览器验证

`lms/e2e/materials-task-alignment.spec.ts`、`material-reader.spec.ts`、`instructor-weeks.spec.ts` 共 21 项通过。覆盖默认展开、单份与多份文件、长名称、不同任务按钮组合、320–1920px 布局、单元/名称组合筛选、刷新持久化、无结果恢复、键盘收起、任务详情焦点、单份及 ZIP 下载、语言切换与错误重试，以及现有 PDF/视频阅读和教师周管理。

发布分支基于当时最新 `origin/main`（`62ff87a6`），保留线上既有权限处理、结构化教师姓名与顾问概览外层布局。完整合并检查通过：`lint:ci`、`typecheck`、`typecheck:production`、754 项单元测试、生产构建、275 项浏览器测试。三语资源键检查包含于单元测试。Production 环境配置及依赖锁文件未修改。

以上记录为合并前的本地构建及受控 API fixture 验证。部署与真实账号的线上受保护流程验收另行记录；截图使用合成数据。

预览：

- [桌面多资料](../output/ui-alignment-materials-20260905/materials-desktop.png)
- [手机多资料](../output/ui-alignment-materials-20260905/materials-mobile.png)
- [任务标签对齐](../output/ui-alignment-materials-20260905/tasks-desktop.png)

## 继续审查发现的既有问题（本次未修改）

### lms/src/pages/AdvisorOperationsPage/AdvisorDashboardOverview.tsx

- `lms/src/pages/AdvisorOperationsPage/AdvisorDashboardOverview.tsx:43` — Progress Overview 的 week/month/caseload 选择仅改变组件 state，未改变请求或统计计算，选择后数据不会随周期变化。
- `lms/src/pages/AdvisorOperationsPage/AdvisorDashboardOverview.tsx:25` — 缺少或无法解析任务时间时填入固定 9:00 am，可能被误认为真实时间。
- `lms/src/pages/AdvisorOperationsPage/AdvisorDashboardOverview.tsx:59` — 缺少学习目标时填入 IELTS / Target 7.0，可能被误认为学生真实目标。

这些是代码审查发现，尚未作为本次修复完成项；应在后续顾问概览交互与数据呈现修复中处理。
