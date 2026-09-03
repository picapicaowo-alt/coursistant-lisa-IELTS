# X-Learn 全角色 Figma 与最终 OpenAPI 复审 — 2026-09-03

## 结论边界

本轮按用户提供的 8 份最终 OpenAPI 和 4 份 handoff 重新导入、实现并审查。69 个 Figma 界面节点均重新导出并逐项查看；编译后的前端以 58 个可执行状态覆盖这些节点，并分别在 1440×1024 与 390×844 截图，共 116 张。截图存在并不等同像素级通过，因此本报告不把 69 个节点标记为“完全一致”。

最新后端交付的 9 个 breaking response shape 已全部切换。缺少合同的 Figma 行为保持不可用并明确记录，没有使用本地假数据伪装成功。当前分支尚未部署；真实 Dev 上的新版 Instructor、Student、Parent 写入验收仍需在部署后执行。

## 完成范围

| 角色 / 模块 | 已实现并验证的前端行为 | API / 数据边界 |
|---|---|---|
| Advisor Dashboard | High / Medium / Low 使用 Figma 的粉、橙、绿语义色和深色可读文字；缺失优先级显示 Not assessed；移除虚构 IELTS 目标、时间和周趋势；各卡片独立 loading/error/empty；标题、间距和右栏换行修正 | Advisor dashboard、students、tasks、conversations、schedule requests；不从缺失字段推导数值 |
| Advisor Course delivery | Owner Advisor 可按日期创建、改期、取消课次，保留 version CAS、Idempotency-Key、冲突重载和 Query cache 更新 | Instructor 不展示最终排课写入口；Gate C 未授权流程不接线 |
| Advisor Student | 课程弹窗使用结构化教师姓名、lectureCompleted/lectureTotal 和 typed weekday/time/location schedule；Mock Exam 只显示 observer projection | 不借用 Student 或 Instructor 权限读取 question-level grading |
| Instructor | grading-items / schedule-requests 使用 zero-based page；Group deep link 按 groupId 进入真实评分页；改课仅审核 PENDING_INSTRUCTOR；Writing 先取 detail 后评分，0–9、0.5 步长；409 后关闭旧记录 | 403/404 不重试；不显示 create/generate/reschedule/cancel；availability LocalTime 对象可读取并无损保留秒数 |
| Student Dashboard / Courses | Mock Exam Dashboard 读取 page envelope；课程 CURRENT / COMPLETED 分页；HIDDEN 不显示；课次进度与作业进度分开；教师姓名按结构化字段展示 | CourseView 使用后端定义；不虚构播放位置、学习时长或 resume 指针 |
| Student Operations | Work queue、schedule requests、全课程 published reports 全部使用 server filter/pagination；实际 deepLink 仅允许已注册内部路由 | 超大 page 有前端上限；403/404 终止；detail 使用返回的 courseId/reportId |
| Mock Exams | Student list 使用 page/status；Instructor/Advisor tab 同时保留 Exam assignment 与 Writing grading；Writing 已评分冲突、Group/Individual grading 路由和手机控件均验证 | 不展示无合同的 AI explanation、Advisor note 或 Parent Writing feedback |
| Parent | 结构化子女姓名；calendar 使用本地半开日期窗口、UTC fields 和 timezone；Session 可发改课申请，deadline 只读；报告、通知、消息 cursor 独立；schedule request 失败不遮蔽 calendar | linked-student 是权限来源；共享 conversation thread；未关联和跨租户资源不暴露 |
| Profile / Auth / Admin | Reading、Writing、Speaking、Listening 恢复蓝/橙/粉/紫区分；程序聚焦标题不再出现装饰边框；三段姓名保留；managed email 最大长度 255 | 未提供 social OAuth / activation-token 合同，因此不模拟；密码和凭据未写入仓库 |
| 全角色响应式 | Student、Instructor、Advisor、Parent、Counsellor、Tenant Admin、System Admin 等 9 个角色在 320/390/768/1024/1440/1920/2560 检查 | 116 张最终截图：0 横向溢出，0 broken image |

## 最终合同核对

- 8 份附件以原始字节保存到 `docs/api/`；SHA-256 和 schema/operation delta 在 `docs/evidence/resumed-figma-review-20260903/`。
- 11 份前端消费合同合计 432 个 operation entries：417 wired、5 alternate workflow、10 disabled/diagnostic excluded；这是静态可达性审计，不是 432 个真实账号 API 成功声明。
- 新增 `GET /v2/me/student-reports` 已有 Student UI；旧 course-scoped list 由该接口的 `courseId` filter 替代，detail 继续用既有 course-scoped endpoint。
- page envelope、cursor envelope、LocalTime object、Parent calendar envelope、structured names、Course lifecycle、Instructor grading deepLink 和 Writing grading detail 均用严格前端类型及响应守卫消费；旧裸数组不会被静默当作成功空列表。

## 仍由合同阻塞的 Figma 行为

| Figma node | 保持不可用的原因 |
|---|---|
| `506:3609` | 没有 course note collection/write 合同 |
| `813:4672` | 没有独立的 Advisor Parents directory / parent-recipient route；最终 handoff 定义为共享 student thread |
| `819:9475` | Advisor observer detail 没有 question-level edit/feedback mutation |
| `430:2779` | Advisor task 没有 linked quiz ID |
| `427:3588` | 没有 exam-specific AI explanation / Advisor-note 合同 |

其他有意差异记录在 `frame-findings.json`：例如注册采用实际 tenant/email verification 流程，Exam card 不显示未提供的计划考试时间，result 只显示返回的正确性或分数。

## 验证证据

| 检查 | 最终结果 |
|---|---:|
| ESLint CI | 通过，0 warning |
| TypeScript | 通过 |
| Production strict TypeScript | 通过 |
| Vitest | 132 files / 548 tests 通过 |
| Production build | 通过 |
| 最新合并基线上的逐帧捕获 | 13 scenarios 通过 |
| 永久 E2E baseline | 95 tests 通过 |
| Impeccable mechanical detector | 42 个本轮 TSX/SCSS 目标，0 finding |
| Figma references | 69/69 fresh exports；58 frontend states × desktop/mobile |

## PR 与部署边界

本轮代码将在独立分支提交并建立 PR。未部署到 Dev 8085、USC 8084 或 Production。Dev 部署后必须使用有真实 linked student / teaching course / owner course 的账号完成 Instructor、Student、Parent focused acceptance；静态 build、fixture E2E 和旧 Dev 页面读取均不能代替这一步。
