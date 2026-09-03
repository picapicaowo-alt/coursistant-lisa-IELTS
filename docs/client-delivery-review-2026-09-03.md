# 全角色阶段性交付 / All-role client delivery review

Date: 2026-09-03. Baseline: `49c8a1dd4fffb5238b482c1e900a79d21f09152f`. Branch: `codex/figma-full-site-parity`. Frontend repository: `picapicaowo-alt/coursistant-lisa-IELTS`.

## 交付范围

合并第一批 Figma 核对与本轮客户流程审查：**130 个前端文件**，其中 108 个生产源码文件、16 个测试文件、6 个字体/图标资源。文件数量不是功能完成率；[文件及哈希清单](evidence/client-delivery-20260903/frontend-files.json) 用于复核本地与 GitHub 基线的差异。

Figma 的 **69 个界面/交互状态 + 1 个 UX Flow** 已逐项建立入口和依赖映射，见[完整状态矩阵](figma-parity-audit-2026-09-03.md)。多个状态共用同一路由。没有独立设计稿的角色采用相同的 Inter、颜色、卡片、边框、间距、导航和响应式规则；未引入新的 UI 框架或依赖。

| 角色 / Role | 本轮交付范围 / Delivered scope | 验收边界 / Acceptance |
|---|---|---|
| Student | Dashboard、课程卡/列表、课程学习工作区、资料阅读、讨论、Study Plan/任务、考试、AI、日历、Profile、成绩、头像裁剪 | 使用实际进度和发布成绩；关联资源、提交、冲突版本、移动布局通过 fixture 测试；课件续读位置等依赖 B01–B13 |
| Instructor | 教学首页、可用时间、课程权限、作业/考试阅卷、共享日历与导航 | 写作评分表单按试卷独立，切换不携带上一份草稿，读取失败时不能提交，失败重试保持请求身份 |
| TA（课程身份） | 复用课程工作区及教学组件 | 权限由课程成员关系决定；不会因共享布局获得 Instructor/Advisor 写权限 |
| Advisor | Dashboard 与 Messages 分离；学生目录、Profile/Plan、课程、考试、Support | 真实查询/筛选/分页、任务与消息入口；Support 核心内容直接展示；缺少的父母专属线程见 B05 |
| Instructor + Advisor | 保留教学与顾问入口以及各自权限范围 | 共用设计系统，角色导航和响应式用例通过 |
| Counsellor | 学生 intake、家长关联、编辑、首次 Advisor 交接、主表单层级 | 完整交接流程和交接后的访问边界通过；已有契约限制不由前端绕过 |
| Parent | Overview、Learning、Schedule、Reports、Mock exams、Messages、Notifications | 完整关联学生分页、报告分页、嵌套学习数据、各学习接口独立错误、附件失败反馈和跨学生草稿隔离通过；姓名投影见 B16 |
| Tenant Admin | Intake/Directory、归属、告警、审计、考试模板/版本/媒体/发布 | 核心内容可见，搜索/分页/版本及租户边界测试通过；可视化听读题目编辑仍依赖 B15 |
| System Admin | 用户管理、课程成员、运营读取与管理操作、考试读取 | 移除 4 个不在契约内的机构 CRUD 调用；已有用户创建/迁移使用显式机构 ID；机构管理缺口见 B14 |

共享 `RecordSummaryList` 不再把实际数据压缩成“加载成功”。它保留零值、布尔值、数值及嵌套学习内容，同时过滤存储、认证和并发内部字段。它是通用读响应的展示组件，不能替代后端字段可见性控制。

## 契约核对

- 11 份 OpenAPI：337 个唯一路径、431 个 HTTP 操作；9 个明确禁用的写操作继续不可用。
- 382 处直接的 v1/v2 服务调用均匹配现有 method/path。另 6 处动态 GET 已人工核对其角色范围与目标路径。该计数不代表全部响应 schema 已端到端验证。
- Dev 聚合文档 `/api/v3/api-docs` 本次仍为 HTTP 500；GitHub 基线没有新增的最终兼容契约。本轮不能声称已消费尚未提供的兼容更新。
- [契约比较摘要及各文件哈希](evidence/client-delivery-20260903/contract-comparison.json)，[后端 handoff B01–B16](advisor-figma-backend-handoff.md)。

## 本地验收

| 检查 | 结果 |
|---|---|
| `npm run lint:ci` | [通过，零 warning](evidence/client-delivery-20260903/lint.log) |
| `npm run typecheck` | [通过](evidence/client-delivery-20260903/typecheck.log) |
| `npm run typecheck:production` | [通过](evidence/client-delivery-20260903/typecheck-production.log) |
| `npm run test:run -- --maxWorkers=4` | [130 files / 540 tests 通过](evidence/client-delivery-20260903/unit-final.log) |
| `npm run build` | [生产构建通过](evidence/client-delivery-20260903/build.log) |
| `CI=1 PLAYWRIGHT_PORT=4198 npm run test:e2e -- --workers=4 --retries=0` | [70 tests 通过，零重试](evidence/client-delivery-20260903/e2e-verified.log) |

首轮新增用例发现并修复了附件错误提示及 Tenant ID 可访问名称。一次复验早于构建完成，混用了旧资源，且并发构建/测试产生超时；该次不作为验收。上述结果来自构建完成后、单元测试与浏览器测试依次进行的最终运行。

全角色主要页面覆盖 320、390、768、1024、1440、1920、2560px 的布局检查，并保留课程、任务、身份、版本冲突、媒体、分页、消息重试和角色拒绝路径的交互测试。69 个 Figma 状态与 70 个测试是两套不同的清单，不能按数量一一对应。

## 视觉和发布边界

第一批审查的设计源与界面证据见[视觉验收记录](evidence/figma-parity-20260903/verification.md)。本轮另人工查看了 Parent 1440px (local screenshot) 与 320px (local screenshot) 的学习页。截图采用隔离 fixture，仅保留在本地 QA 目录，未纳入 GitHub；页面数据不会随产品发布。

这是一版可以先发布到 **Dev 8085** 展示进度的前端候选版本。最终真实账号、后端最新兼容版本、缺失契约以及每个 Figma 细节的端到端验收仍需后续联调；不能将本次结果写成“所有角色及 69 状态均已完成真实业务验收”。GitHub CI 通过后才合并；Dev 产物从合并后的干净 `origin/main` 构建，使用 `current/previous` 原子切换及 `REVISION` 核对。仅发布该静态前端。
