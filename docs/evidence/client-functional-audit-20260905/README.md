# 本轮证据索引

受保护业务回归使用本地 fixture；这些日志不证明 Production 真实业务读写。本轮线上证据仅包括公开发布信息与未登录页面的浏览器检查。历史真实角色读取保留在相邻 `functional-continuation-20260905/` 目录中，不能算入本轮真实验收数量。

- `summary.json`：已验证的代码版本、检查结果、角色／语言／宽度及上线边界。
- `final-*.log`：整合最新主线之后的最终检查。
- `baseline-*.log`：未改动的 `90a8ec45` 主线基线。
- `repro-assignment.log`：修复前两项并发和一项幂等回归失败。
- `repro-exam-final.log`：修复前阅读图片地址错误和后台重载导致答题页卸载的复现。
- `repro-first-submission.log`：首次上传后仍使用旧暂存计数的复现。
- `targeted-final-e2e.log`：六项新增浏览器场景与 21 项课程发布回归，共 27 项通过。
- `integration-e2e-first-run.log`：第一次整合运行中的两项测试问题；定位歧义和单例长流程超时的修正见主报告。
- `candidate-90a8ec45-e2e.log`：整合最新登录标语前的候选，418 项通过。
- `merged-main-e2e-first-run.log`：整合登录标语后的四并发运行，416 项通过、两项间歇超时。
- `timeout-recheck.log`：相同代码／构建、未改测试和时限；三语 Reading 编辑及课程卡片各重复五次，20 项通过。
- `current-production-release.json`：本轮初始读取的公开 Production 元数据，不能用来声明候选已部署。
- `public-browser-acceptance.json`：线上登录页三语、刷新保留、忘记密码入口与返回的真实浏览器观察，未提交表单。

修复失败 fixture 的响应状态仅用于验证前端恢复，不能据此给后端报故障。未交付与有效产品输入无关的试验日志。
