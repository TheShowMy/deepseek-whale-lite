# 来源与许可范围

## 代码与上游

代码、构建产物及配置按 MIT 分发，保留 `LICENSE` 中 MeteorNOX 的版权声明。上游为 MeteorNOX/DeepSeek-Balance-Whale-Widget，基准分支 `main`，提交 `fce34e3abd1fe8b616e287b9864305c7f0be81a0`（0.3.18）。代码实现已用 TypeScript 重写。

`src/palettes.ts` 的渐变色值来自同一上游 MIT 代码；保留 0.2 的渐变兼容选项。`src/bubble-view.ts` 沿用该提交 `assets/whale-widget.js` 中的 MIT SVG 路径、椭圆、描边和颜色，冒出动画按上游布局重新实现。拍头／金币为代码动画，不含上游媒体。

上游原有图片、动图和音频未提供足够的独立再分发许可，未保留在本分支／npm 包中。Git 历史保留，仅删除当前版本资源。

## 新生成角色图

七张 PNG 于 2026-10-10 使用内置 image_gen 生成。统一采用粗线条、平涂的 Q 版半身风格；精确提示词记录在 `docs/image-prompts.json`。参考原图不纳入仓库或 npm 包。

| 文件 | 外观来源 |
| --- | --- |
| `assets/characters/deepseek-smile.png` | 用户提供的蓝发女仆外观参考及简笔 Q 版风格参考；AI 重新绘制 |
| `assets/characters/deepseek-focus.png` | 微笑版本的专注表情／配饰变体 |
| `assets/characters/deepseek-sleepy.png` | 微笑版本的困困表情／配饰变体 |
| `assets/characters/lumine.png` | 《原神》荧的公开形象；AI 同人重新绘制 |
| `assets/characters/vesna.png` | 薇斯纳官方公开形象；AI 同人重新绘制 |
| `assets/characters/vodyanitsa.png` | 沃雅妮莎官方公开形象；AI 同人重新绘制 |
| `assets/characters/tsaritsa.png` | 冰之女皇官方公开形象；AI 同人重新绘制 |

这些图片**不适用代码的 MIT 或音效的 CC0**。DeepSeek 拟人角色参考图的原始作者及许可未由用户提供，不将该参考宣称为本项目原创设计。原神角色及相关设计权利归 HoYoverse／COGNOSPHERE 等原权利人；仅作为非官方、非商业同人插件素材提供。AI 重绘和不盈利不等于取得角色权利的再许可。

公开角色参考：

- 薇斯纳：[HoYoWiki](https://wiki.hoyolab.com/m/genshin/entry/11661?lang=zh-tw)、[官方角色公告](https://genshin.hoyoverse.com/ja/news/detail/165002)。
- 沃雅妮莎：[HoYoWiki](https://wiki.hoyolab.com/m/genshin/entry/11702?lang=zh-cn)、HoYoLAB 官方 PV 角色介绍图（2026-06-26，图片含 COGNOSPHERE 标记）。
- 冰之女皇：[官方公开形象](https://genshin.hoyoverse.com/ja/news/detail/165003)。

如有素材权利问题，请通过仓库 issue 提供文件名与依据，以便核实并移除或替换。

## 音效

四个 OGG 均来自 [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)，未提取或仿制原神音频。使用原始文件，未转码；原许可全文随包保存于 `assets/sounds/LICENSE-Kenney.txt`（仅规范换行及空白）。

| 包内名称 | Kenney 原文件 | 用途 | 许可 |
| --- | --- | --- | --- |
| `press.ogg` | `Audio/cloth1.ogg` | 按下角色 | CC0 |
| `release.ogg` | `Audio/cloth2.ogg` | 松开角色 | CC0 |
| `complete.ogg` | `Audio/handleCoins.ogg` | 对话完成 | CC0 |
| `alert.ogg` | `Audio/metalClick.ogg` | 低余额、预算、提问、授权提醒 | CC0 |

下载来源：`https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip`。核验日期 2026-10-10。CC0 不覆盖原神角色或其他第三方权利。

## 本机素材与验收截图

导入文件仅写入本机数据目录，不进入仓库或 npm 包；请使用有权使用的素材，裁剪不改变原许可。`docs/screenshots/` 为实际 DSH 桌面验收截图；并排图使用上游 MIT SVG、新角色和标注为模拟的金额；0.3 轮廓截图通过临时气泡模板隐藏真实金额，仅显示来源状态。无上游未授权媒体、用户对话、真实金额或凭据。
