# AGENTS.md · AI 协作入口

> 任何 AI（或新加入的人）读这个文件就能上手，不必先读全部代码。
> 最后更新：2026-10-23 · 版本 v1.1

## 1. 这是什么

**型格 LOOKBOOK** —— 男士穿搭灵感图鉴。一套移动端优先的瀑布流（小红书式）穿搭 App。
当前只有 **Web / PWA** 端在运行；Android 原生、iOS 原生目录已预留，未来与 Web 共用同一套内容数据。

- 线上形态：静态站点（可直接部署到 GitHub Pages / 任意静态托管）
- 技术栈：原生 HTML + CSS + ES Module，**没有构建步骤**；运行时零依赖，`package.json` 只声明采集脚本用的 `puppeteer-core`（devDependency）
- 后端：暂无。收藏数据存在 `localStorage`

## 2. 目录地图

| 路径 | 作用 | 是否手改 |
|---|---|---|
| `content/` | **唯一内容源**（搭配、编辑卡、分类字典、图片） | ✅ 日常主要改这里 |
| `content/looks.json` | 所有搭配数据（数组） | ✅ 加/改搭配 |
| `content/editorials.json` | 穿插在流里的排版卡（配色心法/清单/观点） | ✅ |
| `content/palettes.json` | 配色手册：每组 3–5 个色块 + 配色逻辑 + 照抄建议（纯色卡，无图；面积/评分等派生值由前端算） | ✅ 加/改配色 |
| `content/taxonomy.json` | 风格、场景、季节、单品品类字典（标签唯一真源） | ✅ 增减分类 |
| `content/schema/look.schema.json` | 单条搭配的 JSON Schema | 结构变更时才改 |
| `content/templates/look.template.json` | 新建搭配的空白模板 | 结构变更时才改 |
| `content/images/looks/` | 搭配图（命名 `look-N.jpg`） | ✅ 放图 |
| `content/xhs/` | **外部素材库**：从小红书博主采集的穿搭素材（每条笔记一个目录：图片 + `content/xhs/index.json` 索引） | 由脚本生成 |
| `web/materials.html` | 素材库浏览页（搜索 / 标签·身高·来源筛选 / 瀑布流 / 详情弹层 / 收录为搭配），读 `content/xhs/index.json` | 改功能才动 |
| `scripts/xhs-collect.cjs` | 小红书采集器（`list` 博主主页 / `search` 搜索页 / `detail` 抓详情下载图，可断点续跑） | — |
| `scripts/build-xhs-index.cjs` | 合并所有 `_state*.json` → `content/xhs/index.json`（含来源与身高） | — |
| `scripts/extract-height.cjs` | 从文案抽身高（标题优先），写回 state 并输出识别率报告 | — |
| `scripts/verify-materials.cjs` | 无头浏览器自检素材库页面（筛选/搜索/详情） | — |
| `scripts/sync-chrome-login.cjs` | 同步日常 Chrome 登录态到采集工作目录（需先退出 Chrome） | — |
| `scripts/prepare-chrome-profile.cjs` | 仅复制 Chrome 配置目录（Chrome 已关闭时使用） | — |
| `scripts/analyze-covers.py` | 封面图量化分析（主色/明度/饱和度/画幅）→ `content/xhs/analysis.json` | — |
| `web/` | Web / PWA 端（页面、样式、逻辑） | 改功能才动 |
| `web/js/app.js` | 全部前端逻辑：加载内容、瀑布流排版、风格/场景/身高筛选、详情层、收藏、草稿箱 | 改功能才动 |
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

# 小红书素材采集（登录态见下方「登录态复用」说明）
node scripts/xhs-collect.cjs list   "<博主主页URL>" [--state 名称]
node scripts/xhs-collect.cjs search "<搜索页URL>"  --state search-166xz --max 30   # 搜索页（需登录）
node scripts/xhs-collect.cjs detail "<任意URL>"    --state search-166xz            # 逐条抓详情+下图
node scripts/extract-height.cjs --state search-166xz   # 抽身高（标题优先）+ 识别率报告
node scripts/build-xhs-index.cjs                        # 合并所有来源 → content/xhs/index.json
node scripts/verify-materials.cjs                       # 页面自检（需本地服务器）
```

素材库浏览页：`/web/materials.html`（关键词搜索、标签筛选、**身高段筛选**、视频角标、原文链接）。
采集注意事项：请求间隔 3–6 秒防风控；素材仅供个人学习参考，不得二次发布。

**搜索页采集要点**（2026-10 实测）

- 搜索走 `so.xiaohongshu.com/api/sns/web/v2/search/notes`（不是 v1，字段随版本变），因此采集器**以 DOM 为主**：`.note-item` 上有 `data-note-id`，`.footer a.title` 的 href 带 `xsec_token`（详情页必需）
- 未登录时搜索页会显示「登录后查看搜索结果」，登录后才出卡片
- 小红书长连接会导致 `networkidle2` / `domcontentloaded` 迟迟不触发，所以统一用「导航容错 + 轮询卡片数」
- 一个 Chrome 配置目录反复复用会积累坏状态，最终**渲染进程卡死（evaluate 永久挂起）**；采集器改为每次从种子目录复制登录凭证到 `.tmp/profile-<ts>` 跑，结束后把 cookie 写回种子

**登录态复用**（避免每次扫码）：Windows 下 Chrome 的 Cookie 文件被独占锁定，必须先退出 Chrome 才能复制。

```bash
node scripts/sync-chrome-login.cjs --relaunch   # 等 Chrome 关闭 → 复制登录态 → 自动重开 Chrome
node scripts/prepare-chrome-profile.cjs         # 等价拆分：仅复制配置（Chrome 已关闭时用）
```

登录态源目录（种子）默认 `~/.workbuddy/xhs-lean`（从早期扫码会话迁出的 cookie），优先级：`XHS_PROFILE_DIR` > `xhs-lean` > `xhs-session`。

- 每次运行：复制 `Local State` + `Default/Preferences` + `Default/Network/Cookies` 到 `.tmp/profile-<时间戳>`，用副本启动 Chrome，结束后把 cookie 写回种子目录
- **不要**让采集器长期复用同一个配置目录：坏状态会让渲染进程卡死
- 登录态会过期；过期后搜索页会出现「登录后查看搜索结果」，此时删除 `~/.workbuddy/xhs-lean` 重跑一次扫码即可
- `scripts/sync-chrome-login.cjs` 用于从**日常 Chrome** 同步登录态（需先退出 Chrome），复制到 `~/.workbuddy/chrome-profile`

## 6. 前端实现要点（改代码前必读）

- **瀑布流算法**在 `web/js/app.js` 的 `layoutMasonry()`：双列，卡片绝对定位，每张卡放进当前较矮的一列，从而保证「左→右」的阅读顺序（CSS `column-count` 做不到这点，所以没用它）。
- 卡片高度依赖 `img` 的 `aspect-ratio: var(--r)`，`--r` 由数据里的 `image.ratio` 写入 → 图片未加载时高度已知。
- 容器不可见时 `clientWidth` 为 0，所以**切换 Tab 后要重新排版**（`switchTab()` 里已处理）。
- 卡片入场动画只动 `opacity`，不动 `transform`（`transform` 被 JS 用于定位，动画会覆盖它）。
- 收藏读写集中在 `storage` 对象；接云账号时替换它即可，UI 不用改。
- 配色页（`renderPalettes` / `renderPalSheet` / `renderBuilder`）的视觉核心是 `figureSvg(p)`：按 `role` 把 hex 画到简笔人形上（头/上装/外套/下装/鞋/包/配饰各一层），改配色数据不需要动 SVG。
- 自建配色存 `localStorage` 的 `xingge.palettes.v1`（数组，元素带 `custom: true`），与内置配色在 `allPalettes()` 合并；试色判定复用 `paletteScore()`。
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
- 外部素材：`content/xhs/` 共 **156 条**、2 个来源
  - 博主「王ze霖」117 条（视频为主，存封面+文案+标签，未标注身高）
  - 搜索「166小个子穿搭」39 条（含身高识别，35/39 命中，89.7%）
- **身高维度已打通素材库**（按 155–160 / 160–165 / … / 180+ 筛选、卡片角标）；**主 App 的 `heightFit` 字段已进 schema，但 9 套 look 尚未填值、前端也还没接筛选**
- 收藏仅存本机，未做账号与多端同步
- 无「穿搭合集 / 作者主页 / 评论」等社区能力
- 图片为 AI 生成，商用需替换为自有版权图

详见 [`plan/30-roadmap.md`](plan/30-roadmap.md)。
