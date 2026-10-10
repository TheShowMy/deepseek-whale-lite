# 开发说明

使用 Node.js 22.18 或更新版本，执行 `npm ci` 后运行 `npm run check`。源码在 `src/`，构建产物需要一起提交，npm 安装时不编译。

请保持桌面端、两种官方 DeepSeek 来源的范围。余额与 token 估算分开，账户／凭据及币种分开；不要把失效凭据作为零余额，不要将其他模型按 DeepSeek 费率计算，不要将密钥写入日志或客户端响应。

新增素材需要更新 PROVENANCE 和生成提示词记录；不能复用历史中许可不明的上游资源。提交前检查 `npm pack --dry-run`，不要提交本机 state.json、凭据、安装包或实际账号余额截图。

发布由维护者确认后手动执行 `npm publish --access public`；仓库 CI 只检查和打包，不发布。
