# AGENTS.md · AI 协作入口

> 任何 AI（或新加入的人）读这个文件就能上手，不必先读全部代码。
> 最后更新：2026-10-22 · 版本 v1.0

## 1. 这是什么

**型格 LOOKBOOK** —— 男士穿搭灵感图鉴。一套移动端优先的瀑布流（小红书式）穿搭 App。
当前只有 **Web / PWA** 端在运行；Android 原生、iOS 原生目录已预留，未来与 Web 共用同一套内容数据。

- 线上形态：静态站点（可直接部署到 GitHub Pages / 任意静态托管）
- 技术栈：原生 HTML + CSS + ES Module，**没有构建步骤、没有依赖**
- 后端：暂无。收藏数据存在 `localStorage`

## 2. 目录地图

| 路径 | 作用 | 是否手改 |
|---|---|---|
| `content/` | **唯一内容源**（搭配、编辑卡、分类字典、图片） | ✅ 日常主要改这里 |
| `content/looks.json` | 所有搭配数据（数组） | ✅ 加/改搭配 |
| `content/editorials.json` | 穿插在流里的排版卡（配色心法/清单/观点） | ✅ |
| `content/taxonomy.json` | 风格、场景、季节、单品品类字典（标签唯一真源） | ✅ 增减分类 |
| `content/schema/look.schema.json` | 单条搭配的 JSON Schema | 结构变更时才改 |
| `content/templates/look.template.json` | 新建搭配的空白模板 | 结构变更时才改 |
| `content/images/looks/` | 搭配图（命名 `look-N.jpg`） | ✅ 放图 |
| `content/xhs/` | **外部素材库**：从小红书博主采集的穿搭素材（每条笔记一个目录：图片 + `content/xhs/index.json` 索引） | 由脚本生成 |
| `web/materials.html` | 素材库浏览页（搜索 / 标签筛选 / 瀑布流 / 详情弹层），读 `content/xhs/index.json` | 改功能才动 |
| `scripts/xhs-collect.cjs` | 小红书采集器（`list` 收集索引 / `detail` 抓详情下载图，需登录，可断点续跑） | — |
| `scripts/build-xhs-index.cjs` | 从采集状态生成 `content/xhs/index.json` | — |
| `web/` | Web / PWA 端（页面、样式、逻辑） | 改功能才动 |
| `web/js/app.js` | 全部前端逻辑：加载内容、瀑布流排版、详情层、收藏 | 改功能才动 |
| `web/css/style.css` | 全部样式（含瀑布流容器规则） | 改视觉才动 |
| `manifest.webmanifest` | PWA 清单（图标、启动页、主题色） | 极少改 |
| `sw.js` | Service Worker 离线缓存（位于仓库根，scope 为全站） | 极少改 |
| `assets/icons/` | App 图标 192 / 512 | 换品牌时改 |
| `android/` | Android 端（**规划中**，见该目录 README） | 未开始 |
| `ios/` | iOS 端（**规划中**，见该目录 README） | 未开始 |
| `plan/` | 项目计划、架构、数据规范、路线图（给人和 AI 读） | 计划变更时改 |
| `scripts/` | 工具脚本：内容校验、图片处理 | — |
| `raw/` | 图片生成原图（**不提交 Git**） | 不碰 |

## 3. 三条硬规则

1. **不要把内容写进代码。** 所有搭配、标签、文案都来自 `content/*.json`；`web/js/` 里不应出现具体搭配文案。
2. **不要引入构建步骤。** 这是刻意选择：克隆即可运行、GitHub Pages 直接部署。若确实需要（如拆分 content、上 TypeScript），必须先在 `plan/` 里更新方案再动手。
3. **改完内容一定跑校验**：`node scripts/check-content.mjs`（零依赖，会在 id 重复/枚举错误/缺图时报错）。

## 4. 新增一套搭配（最常见操作）

1. 把图片放进 `content/images/looks/look-N.jpg`（建议宽 720px，竖图，宽/高比 0.6~0.75，瀑布流才错落）
2. 复制 `content/templates/look.template.json` 的内容，作为新对象追加到 `content/looks.json` 的 `looks` 数组
3. 必填：`id` `title` `styles[]` `scenes[]` `image{src,ratio}` `items[]` `palette[]` `status`
4. `image.ratio` 一定要写真值（宽÷高），瀑布流用它预留高度，写错会导致图片加载时跳动
5. 跑 `node scripts/check-content.mjs`，通过即完成（`status: "draft"` 的内容不会显示，可用于预填）

字段完整说明见 [`plan/20-data-schema.md`](plan/20-data-schema.md)。

## 5. 常用命令

```bash
# 本地预览（必须用 http 服务器，file:// 下 fetch 会被浏览器拦截）
python -m http.server 8765     # 然后打开 http://localhost:8765

# 内容校验（新增/修改 content 后必跑）
node scripts/check-content.mjs

# 重新处理图片（裁水印、压缩、按画幅裁切、生成图标）
python scripts/process_images.py

# 小红书素材采集（需要扫码登录一次，登录态存 ~/.workbuddy/xhs-session）
node scripts/xhs-collect.cjs list "<博主主页URL>"     # 阶段一：滚动收集全部笔记索引
node scripts/xhs-collect.cjs detail "<博主主页URL>"   # 阶段二：逐条抓详情+下载封面图（可重复执行续跑）
node scripts/build-xhs-index.cjs                      # 阶段三：生成 content/xhs/index.json
```

素材库浏览页：`/web/materials.html`（支持关键词搜索、标签筛选、视频角标、原文链接）。
采集注意事项：请求间隔 3–6 秒防风控；素材仅供个人学习参考，不得二次发布。

## 6. 前端实现要点（改代码前必读）

- **瀑布流算法**在 `web/js/app.js` 的 `layoutMasonry()`：双列，卡片绝对定位，每张卡放进当前较矮的一列，从而保证「左→右」的阅读顺序（CSS `column-count` 做不到这点，所以没用它）。
- 卡片高度依赖 `img` 的 `aspect-ratio: var(--r)`，`--r` 由数据里的 `image.ratio` 写入 → 图片未加载时高度已知。
- 容器不可见时 `clientWidth` 为 0，所以**切换 Tab 后要重新排版**（`switchTab()` 里已处理）。
- 卡片入场动画只动 `opacity`，不动 `transform`（`transform` 被 JS 用于定位，动画会覆盖它）。
- 收藏读写集中在 `storage` 对象；接云账号时替换它即可，UI 不用改。
- 详情层/搜索层打开会 `history.pushState`，Android 返回键可关闭。

## 7. 多端策略

| 端 | 状态 | 共享方式 |
|---|---|---|
| Web / PWA | ✅ 已上线形态 | 直接读 `content/` |
| Android | 🕐 规划中 | 打包 `content/` 进 assets，或远程拉取同一份 JSON |
| iOS | 🕐 规划中 | 同上 |

数据契约（`content/schema/look.schema.json`）是跨端唯一约定：**先改契约，再改各端**。
机器可读的项目状态见 [`plan/project.yaml`](plan/project.yaml)。

## 8. 待办与已知限制

- 内容量：当前 9 套搭配，需要持续填充（这是当前最该做的事）
- 外部素材：`content/xhs/` 已采集小红书博主「王ze霖」117 条笔记（以视频为主，存封面+文案+标签）
- 收藏仅存本机，未做账号与多端同步
- 无「穿搭合集 / 作者主页 / 评论」等社区能力
- 图片为 AI 生成，商用需替换为自有版权图

详见 [`plan/30-roadmap.md`](plan/30-roadmap.md)。
