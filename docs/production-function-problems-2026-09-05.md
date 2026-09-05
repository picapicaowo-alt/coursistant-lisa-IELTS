# Production 接口问题记录

前端：`https://app.xlearnedu.com`。API 基址：`https://api-cn.xlearnedu.com/api`。

## 教师在目录中可选，但 availability 返回 USER_NOT_FOUND

**影响：Advisor 无法读取已选教师的可用时间，排课时无法判断教师时间安排。**

角色为 Advisor。留存的真实响应采集于 2026-09-04 23:55–23:57 UTC。本轮 2026-09-05 的浏览器会话已过期，停留在登录页，因此以下是已保存的线上证据，未作为本轮重新调用的结果。

| 请求 | 观察结果 |
| --- | --- |
| `GET /v2/advisor/instructors?q=Emily&page=0&size=20` | HTTP 200，`SUCCESS`，目录返回 Emily Ward，`instructorUserId: 15`，`level: INSTRUCTOR` |
| `GET /v2/advisor/instructors/15/availability` | HTTP 404，`USER_NOT_FOUND`，`data: null`，`message: User Does Not Exist` |
| 在同一教师选择器选择 James Liu 后，`GET /v2/advisor/instructors/16/availability` | HTTP 404，`USER_NOT_FOUND`，`data: null`，`message: User Does Not Exist` |

Emily 目录响应时间：`2026-09-04T23:55:02.987712143Z`。availability 响应时间：`2026-09-04T23:55:34.494572459Z`。James availability 响应时间：`2026-09-04T23:56:47.013181179Z`。

Emily 的教师目录与详情请求有成对证据。James 的姓名来自同一页面的选择器，ID 来自请求地址；没有单独保存 James 的目录搜索响应。

这些请求使用同一个 Advisor 会话和 API 基址，availability 请求无请求体及额外查询参数。前端选择器直接取目录中的 `instructorUserId`，没有使用列表序号、课程 ID 或显示姓名代替。当前前端源码的参数和路径与消费契约一致。已保存响应的 CORS 来源与凭据配置允许页面读取这些响应。

现象是目录可见性与 availability 读取结果不一致。已有证据不能确定具体原因，也不能据此判断教师账户实际上不存在、未设置可用时间，或整个数据连接失效。

原始留存来源为原工作区 `docs/production-api-consistency-backend-handoff-2026-09-04.md`；本文件已包含与问题直接相关的请求及响应摘录，不包含密码、访问令牌或 Cookie。
