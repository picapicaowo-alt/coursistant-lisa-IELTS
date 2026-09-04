# 后端交接：Instructor Calendar 403 / Grading queue 500

## 环境与复现信息

- 前端环境：`https://dev.xlearnedu.com:8085`
- 登录身份：已登录的目标 Instructor（具体账号由 Lisa 单独提供）
- 核查时间：2026-09-03 晚间 PDT（2026-09-04 UTC）
- 证据来源：使用现有已登录浏览器会话，实际进入页面／点击重试，并查看 Network 响应。
- 本次仅做只读诊断，没有修改后端、权限、数据库或环境配置，也没有提交评分或日历事件。

## 问题一：Calendar 个人事件接口返回 403

### 复现步骤

1. Instructor 登录后打开侧栏 **Calendar**（`/calendar`）。
2. 当前周为 **Aug 31 – Sep 6, 2026**。
3. 页面显示 **“Personal events could not be loaded.”**。
4. 点击 **Retry personal events**，仍返回 403。

### 实际请求

```http
GET /api/v2/me/personal-events?fromUtc=2026-08-31T07:00:00.000Z&toUtc=2026-09-07T07:00:00.000Z
```

### 实际响应

```json
{
  "status": 403,
  "code": "ACCESS_DENIED",
  "data": null,
  "message": "No Permission to Perform This Action",
  "timestamp": "2026-09-04T04:27:17.061354569Z"
}
```

### 已确认及待后端排查

- 已确认是 **个人事件接口的权限拒绝**，不是 HTTP 500，也不是整个日历页面崩溃。日历框架和课程筛选仍正常显示。
- 前端按当前消费契约提供了必填的 `fromUtc`、`toUtc`；均为有效 UTC 日期时间，起止顺序正常，范围为七天。
- 契约来源：`docs/api/course.openapi.yaml` → `listMyPersonalEvents`。该读操作没有明确说明角色权限矩阵，因此**目前不能断定 Instructor 应当被允许，还是产品规则有意禁止**。

请后端确认：

1. 当前租户的有效 `USER / INSTRUCTOR` 是否应能读取自己的 personal events。
2. 根据以上时间戳检查拒绝请求的权限规则及当前用户／租户上下文。
3. 如果 Instructor 应被允许，请修复权限判断或配置不一致；如果属于预期限制，请明确支持的角色、权限条件及错误契约，供前端正确隐藏或禁用入口。
4. `GET /v2/me/calendar` 是另一条接口；不要把此次个人事件 403 直接归类为所有日历数据均失败。

## 问题二：Grading queue 区域的 grading-items 接口返回 500

### 复现步骤

1. 同一 Instructor 打开 **Teaching operations**（`/my-operations`）。
2. **Grading queue** 区域显示 **“Grading queue could not be loaded.”**。
3. 用户截图中重试后仍报错，本次进入该页面也捕获到以下 500 响应。

### 实际请求

```http
GET /api/v2/me/teaching/grading-items?page=0&size=100
```

### 实际响应

```json
{
  "status": 500,
  "code": "INTERNAL_SERVER_ERROR",
  "data": null,
  "message": "Internal server error",
  "timestamp": "2026-09-04T04:27:31.170034479Z"
}
```

### 同一页面的对照请求

```http
GET /api/v2/me/teaching/grading-queue
```

该请求返回 **HTTP 200**：

```json
{
  "status": 200,
  "code": "SUCCESS",
  "data": [],
  "message": "Success"
}
```

**因此，准确说法是：名为 Grading queue 的 UI 区域报错，其中失败的是 `grading-items`；并非 `grading-queue` 这条接口本身返回 500。**

### 已确认及待后端排查

- 已确认 `grading-items` 返回服务端内部错误。尚未查看后端日志，不能把原因直接归结为数据库、课程记录或某个空字段。
- 契约来源：最新主线 `19bddb1` 的 `docs/api/course.openapi.yaml` → `meTeachingGradingItems`。个人作业为每个 Assignment × Student 一条记录；小组作业为每组一条记录，使用从 0 开始的分页。
- **契约复核更正：**最新主线明确声明 `page >= 0`、`1 <= size <= 100`，因此线上 `page=0&size=100` 符合当前契约。最新前端通过 `readCollection` 分页读取。初稿中“未声明分页”的判断来自较旧的本地工作区，不适用于当前发布版本；不应通过删除合法分页参数来规避此次 500。

请后端排查：

1. 按时间戳及该 Instructor／租户定位 `meTeachingGradingItems` 的实际异常堆栈。
2. 验证上述合法分页请求及后续分页，检查返回的 `items/page/size/total` 是否符合当前契约；无参数请求可作对照，但不是本次已实测结果。
3. 检查该用户课程成员身份、Assignment × Student 评分记录聚合，以及无提交／已录分未发布／已发布等记录状态。以上仅是排查方向，不是已确认根因。
4. 有效读取应返回契约定义的成功列表；没有待评分数据时应返回成功空列表，而不是 500。
5. 修复后用真实待评分提交验证列表加载及进入评分页面，不能仅用 `grading-queue` 返回空列表作为验收依据。

## 补充：控制台扩展错误与上述接口报错分开处理

截图中反复出现的：

```text
Cannot read properties of undefined (reading 'toLowerCase')
content_main.js:14829
```

本次在 DevTools 中确认来源为 `chrome-extension://bpoadfkcbjbfhfodiogcnhhhpibjhbnh/content_main.js:14829`，属于浏览器扩展脚本，不是 LMS 前端 bundle。它不能作为这两个后端接口错误的根因证据。

## 建议验收结果

| 项目 | 期望结果 |
| --- | --- |
| Instructor personal events | 按确认后的权限规则返回成功列表；若明确不支持，应提供准确权限契约供前端限制入口 |
| Instructor grading items | 有效请求返回 200／SUCCESS；正常呈现真实评分记录或空列表 |
| 前端恢复 | 对应错误提示消失，其他独立模块保持可用 |
| 验证边界 | 本次未执行任何线上新增事件、修改事件、删除事件或评分提交，写入流程需另行验收 |
