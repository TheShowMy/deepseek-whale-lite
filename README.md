# DeepSeek Whale Lite

官方 DeepSeek Harness（DSH）**桌面端**的轻量余额挂件。TypeScript 实现，分别查看登录账号和 API Key 的余额；两者可以属于不同账户。

## 安装

发布到 npm 后，在官方桌面端打开 **插件 → 添加插件**，输入：

```text
dsh-deepseek-whale-lite
```

也可由 DSH 的插件工具安装：

```json
{"action":"install_bundle","target":"dsh-deepseek-whale-lite"}
```

**0.1.0 当前尚未发布到 npm。** 发布前，在同一入口填写本机 `.tgz` 的绝对路径进行安装。桌面端管理自己的 `desktop` profile，不使用 CLI 的 `dsh plugin --profile desktop` 命令。安装、禁用或重新启用后请重启桌面端，以更新启动时收集的页面注入。

参考：[官方插件管理说明](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/boot/plugin-manager)。

## 两个账户，分别显示

设置提供 **仅账号登录 / 仅 API Key / 两者同时** 三种显示模式，并保存选择。首次两种来源均已配置时默认同时显示。

- **账号登录**：`deepseek-account`，使用 DSH 账号服务。显示账号名称、充值余额及赠送余额，支持只有赠金的钱包。
- **API Key**：`deepseek-official`，沿用官方模型提供方的 `apiKeyEnv` 凭据引用，默认 `DEEPSEEK_API_KEY`。不要求它属于当前登录账号。
- 两行分别标记来源、币种、更新时间及错误状态。余额和账本不合并；一行失败不影响另一行，失败不显示为零。
- 显示模式只控制面板，不修改 DSH 的模型选择，也不停止隐藏来源的统计。退出账号登录不影响已配置的 Key。
- Key 和账号 token 只在宿主处理，页面不接收原始凭据。模型调用仍由官方 DSH 提供方负责；本插件不代理对话、不管理登录或 Key。
- 仅处理官方 `https://api.deepseek.com` 端点。通过同名提供方配置的第三方代理不纳入统计。

参考：[官方两种鉴权路径](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm-deepseek)。

## 保留的功能

自动／手动刷新、今日余额观测、最近 30 天简单历史、每轮 token 与费用区间、完成提示、各来源低余额提醒、拖动吸附、大小和镜像、位置保存、七位内置角色，以及音效开关／音量。

点击角色查看最近一轮，拖动角色或标题移动；靠近边缘自动吸附。默认关闭音效，开启后可以试听。低余额阈值分别设置 CNY 和 USD。

角色采用粗线条、平涂的 Q 版半身风格：DeepSeek 微笑／专注／困困、荧、薇斯纳、沃雅妮莎、冰之女皇。DeepSeek 外观依据用户提供的蓝发女仆参考重新生成。图片及音效的来源和许可见 [PROVENANCE.md](PROVENANCE.md)，生成提示词见 [docs/image-prompts.json](docs/image-prompts.json)。

[查看七张角色预览](docs/CHARACTERS.md)。

## 统计口径

**今日观测下降**是插件运行期间相邻余额样本的累计下降，不是账户完整账单，也无法将其他设备调用、赠金到期与模型消费精确区分。充值或赠送造成的余额增加另行显示，提示核对。跨北京时间零点重新建立基线，未观测的区间不补造消费。

**本机估算**只使用 DSH 实际记录的模型 usage。按实际提供方及调用步骤开始时的账号／凭据作用域归属，按 session、turn 和事件序号去重；子会话继承的历史不重复统计。输入、缓存读取、缓存写入、输出分别计量，推理 token 已包含在输出中。

价格核验日期：**2026-10-10**。目前识别 `deepseek-flash`、`deepseek-v4-pro`，及官方说明按 Flash 计费的旧别名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`。费用显示公开峰谷费率的区间，不猜测节假日、最终计费时刻或账号优惠。未知模型保留 token，显示“费用未知”。CNY 与 USD 分别使用官方价格，不做汇率转换。金额内部使用 10⁻⁸ 固定单位；账号钱包的科学计数法及更长小数先用整数解析，再四舍五入到该精度。

参考：[人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) / [美元价格](https://api-docs.deepseek.com/quick_start/pricing/)。

数据保存在 `$DSH_HOME/deepseek-whale-lite/state.json`，使用独立插件 ID 和接口前缀，可与上游插件共存。不导入旧账本、不持久化原始凭据。保留最近 30 天、最多 20,000 次调用及 200 条完成记录；历史中的短账本标识用于区分不同账号／Key。

## 开发与验证

```sh
npm ci
npm run check
npm pack
```

`src/` 为源码；esbuild 生成宿主 `lib/index.js` 和前端 `lib/widget.js`。无运行时 npm 依赖，无安装编译脚本。修改源码后需重新构建，包里携带可直接加载的 JavaScript。

首个验收目标为官方桌面端 **0.2.0-rc.2 / macOS arm64**。具体测试结果见 [docs/QA.md](docs/QA.md)。Web 不在支持范围内；Windows / Linux 未实测；正式 npm 名称安装等待发布后验证。

## 上游与许可

这是 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的真实 fork。基于 **上游 `main` / `fce34e3abd1fe8b616e287b9864305c7f0be81a0` / 0.3.18**，保留 Git 历史及原作者 MIT 声明。沿用其桌面早期注入和独立余额观测思路，用 TypeScript 重写实现。

本分支移除了多提供商、订阅额度、Codex、自定义素材上传裁剪及复杂气泡编辑。上游缺少再分发许可的 PNG、GIF、MP3、WAV 及相关引用已从本分支和发布包中移除；它们仍可能存在于 fork 的历史提交中。

代码按 [MIT](LICENSE) 分发。角色图片不适用代码的 MIT；原神角色是非官方、非商业同人内容，角色设计权利归原权利人。音效来自 Kenney CC0 素材，不使用游戏提取音频。本项目与 DeepSeek、HoYoverse 无隶属关系。
