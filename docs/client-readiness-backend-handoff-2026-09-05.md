# Tokyo Prod：本轮新增后端问题

核验时间：2026-09-05 08:24:37–08:24:38 UTC。范围：启澜雅思学院测试租户 `tenantId=1`。

**本轮新增 1 项：Advisor 待处理请求汇总与明细不一致。**

本清单已与此前交付的问题去重，只收录新增问题。

## N1 · Advisor 学生汇总的待处理请求数与请求队列不一致

身份：Advisor，`userId=7`，登录角色 `USER`。学生：`studentUserId=26`。请求均发往 `https://api-cn.xlearnedu.com/api`，使用同一有效会话；未修改业务数据。

| 顺序 | 请求 | 实际响应 |
| --- | --- | --- |
| 1 | `GET /v2/advisor/students/26/hub` | 200；`pendingRequestCount=1` |
| 2 | `GET /v2/advisor/schedule-requests?page=0&size=20&studentUserId=26` | 200；`total=0, items=[]` |
| 3 | `GET /v2/advisor/schedule-requests?page=0&size=20` | 200；`total=0, items=[]`，未限制请求类型或学生 |
| 4 | `GET /v2/advisor/students/26/hub` | 200；再次返回 `pendingRequestCount=1` |

Hub 同时返回一项 `activeTasks`：`taskId=1, taskType=REPORT_REVIEW, status=IN_PROGRESS, sourceType=COURSE_REPORT, sourceId=1`；目标 `requestId=null`。**它是否被计入 pendingRequestCount 仅是待核实的可能性，不是已确认的根因。**

真实浏览器中，同一学生页顶部显示“Pending requests 1”，学习计划请求区显示“0 Pending / No pending requests”；进入 Advisor Scheduling 后，总队列同样为空。用户无法从请求区找到该待处理项。

消费代码：学生页顶部原样读取 `hub.pendingRequestCount`；学习计划通过合同规定的 `studentUserId` 查询参数读取调课／请假队列，过滤 `PENDING`。实际明细 `total=0`，已排除当前页未加载、类型筛选及前端漏显示非空明细的情况。

合同：`docs/api/advising.openapi.yaml` 的 `AdvisorStudentHubResponse.pendingRequestCount` 只有 integer 类型，没有定义是否包含报告审核等 action task；`docs/api/course.openapi.yaml` 的 `GET /v2/advisor/schedule-requests` 支持 `studentUserId`、`requestType`、`page`、`size`。

问题边界：汇总／明细不一致已复现；现有合同不足以判断是汇总统计错误，还是该字段实际包含其他待办类型。接口均返回 200，不能据此认定为权限或服务故障。

证据：[四次脱敏请求响应](evidence/client-readiness-20260905/resume-hub-count.json)。
