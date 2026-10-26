# 20 · 数据格式规范

> 填充内容只需要看这一份。所有内容都是 JSON，位于 `content/`，前端只读不写。
> 修改后务必运行：`node scripts/check-content.mjs`

## 1. 文件分工

| 文件 | 内容 | 结构 |
|---|---|---|
| `content/looks.json` | 搭配（卡片 + 详情） | `{ version, updatedAt, looks: Look[] }` |
| `content/editorials.json` | 流内排版卡 | `{ version, updatedAt, editorials: Editorial[] }` |
| `content/palettes.json` | 配色手册（纯色卡，无图） | `{ version, updatedAt, kinds: Kind[], palettes: Palette[] }` |
| `content/taxonomy.json` | 分类字典（标签的唯一真源） | `{ styles[], scenes[], seasons[], itemCategories[] }` |
| `content/schema/look.schema.json` | 单条 Look 的 JSON Schema | 标准 JSON Schema 2020-12 |
| `content/templates/look.template.json` | 新建用的空白模板 | 单个 Look 对象 |

词缀约定：JSON 里的 `key` 一律用英文小写（`cityboy`），展示文案在 `label`（`日系`）。
**内容里只写 key**，前端自动映射成中文标签。

## 2. Look 字段表

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一，格式 `look-1` / `look-12`，不可重复，收藏和分享都依赖它 |
| `title` | string | ✅ | 卡片标题，建议 ≤ 14 字，用「×」连接上下装 |
| `summary` | string | — | 卡片副标题，一句话卖点，≤ 20 字，超出会截断 |
| `styles` | string[] | ✅ | 风格 key，可多个，**第一个决定卡片角标** |
| `scenes` | string[] | ✅ | 场景 key，可多个 |
| `seasons` | string[] | — | 季节 key，可多个 |
| `image.src` | string | ✅ | 文件名，图片放在 `content/images/looks/` 下 |
| `image.ratio` | number | ✅ | **宽 ÷ 高**，如 720×1029 → `0.70`。瀑布流靠它预留高度 |
| `image.alt` | string | 建议 | 无障碍描述 |
| `image.credit` | string | — | 图片来源 |
| `desc` | string | 建议 | 详情页正文，2–3 句，说明搭配为什么成立 |
| `items` | Item[] | ✅ | 单品清单，至少 1 条 |
| `items[].cat` | string | ✅ | 品类 key，见下方枚举 |
| `items[].name` | string | ✅ | 单品名称 |
| `items[].note` | string | — | 版型 / 选购要点 |
| `palette` | string[] | ✅ | 配色，2–6 个 HEX（`#ffffff`），展示为色卡 |
| `tip` | string | 建议 | 一条可执行的搭配提醒 |
| `heightFit` | object | 建议 | 适配身高区间 `{ min, max, note? }`（cm）。缺省表示不限身高 |
| `tags` | string[] | — | 搜索用关键词（「显高」「面试」等） |
| `author` | string | — | 署名，默认「编辑部」 |
| `status` | `"published"` \| `"draft"` | ✅ | `draft` 不会显示，可先填后发 |
| `createdAt` / `updatedAt` | string | — | `YYYY-MM-DD` |

### 枚举（来自 `taxonomy.json`）

**styles**：`cityboy` 日系 · `street` 街头 · `business` 商务 · `minimal` 极简 · `techwear` 机能 · `retro` 复古 · `smart` 半正式

**scenes**：`daily` 日常 · `commute` 通勤 · `date` 约会 · `trip` 出行 · `party` 聚会

**seasons**：`spring` 春 · `summer` 夏 · `autumn` 秋 · `winter` 冬

**itemCategories**：`outer` 外套 · `top` 上装 · `bottom` 下装 · `shoes` 鞋 · `bag` 包 · `accessory` 配饰

**heights**（身高段，用于素材与搭配筛选）：`h155` 155–160 · `h160` 160–165 · `h165` 165–170 · `h170` 170–175 · `h175` 175–180 · `h180` 180+ · `unknown` 未标注

> 增删分类：只改 `taxonomy.json`，前端 Tab、筛选、标签会自动跟着变。改 key 需同步改已有内容。

**heightFit 怎么匹配**：按区间**重叠**判断，不是包含。例如 look 写 `{ min: 160, max: 180 }`，用户选 165–170 能命中，选 175–180 也能命中（175<180），选 180+ 不命中。`min` 含、`max` 不含；`min` 必须小于 `max`，超出 140–210 会告警。前端只在「有 look 覆盖」的身高段上出现筛选 chip。

**素材 → 搭配的草稿流**：素材库详情页「收录为搭配」把草稿写进浏览器 `localStorage`（key `xingge.incoming.v1`），主 App 读取后排在灵感流末尾并带「草稿」角标；「我的 → 我的草稿」可预览、导出 JSON。导出文件是 look 对象数组，粘贴进 `content/looks.json` 的 `looks` 里、把 `status` 改成 `published`、补 `items` / `palette` / `tip` 即成为正式内容。

## 3. 完整示例

```json
{
  "id": "look-10",
  "title": "灰针织 × 直筒黑裤",
  "summary": "一件高领解决整个冬天",
  "styles": ["minimal", "cityboy"],
  "scenes": ["daily", "commute"],
  "seasons": ["autumn", "winter"],
  "image": {
    "src": "look-10.jpg",
    "ratio": 0.68,
    "alt": "灰色高领针织衫搭配黑色直筒裤",
    "credit": "自有素材"
  },
  "desc": "灰色高领单穿容易显单薄，配一条垂感直筒裤把重心压住，鞋选圆头德比，整体就不会往「保暖内衣」的方向跑。",
  "items": [
    { "cat": "top", "name": "灰色美丽诺高领", "note": "细针，贴合但不紧" },
    { "cat": "bottom", "name": "黑色直筒羊毛裤", "note": "裤长盖住鞋面一半" },
    { "cat": "shoes", "name": "黑色圆头德比鞋", "note": "比尖头更松弛" }
  ],
  "palette": ["#8d8b86", "#1b1a18", "#3a3a3c", "#efece6"],
  "tip": "高领的高度到下巴下方一指最稳，太高会显得脖子短。",
  "tags": ["冬季", "显瘦", "基础款"],
  "author": "编辑部",
  "status": "published",
  "createdAt": "2026-10-22",
  "updatedAt": "2026-10-22"
}
```

## 4. Editorial（流内排版卡）

穿插在瀑布流中，用来讲方法论，不占图片资源。三种 `type`：

| type | 额外字段 | 用途 |
|---|---|---|
| `palette` | `swatches: string[]` | 配色心法，深色卡 + 色块 |
| `list` | `list: string[]` | 清单（胶囊衣橱、必买单品） |
| `quote` | — | 观点 / 编辑手记，白卡 |

公共字段：`id` `type` `kicker`（小标签）`title` `body` `status`。

## 5. Palette（配色手册 · `content/palettes.json`）

配色页只讲颜色怎么配，不依赖衣服照片。一组配色 = 3–5 个色块 + 一句「为什么成立」+ 一句「照着抄」。

```json
{
  "id": "pal-navy-caramel",
  "kind": "contrast",
  "title": "藏蓝 × 焦糖",
  "summary": "一冷一暖撞在腰线以上，通勤也有温度",
  "swatches": [
    { "hex": "#B0743C", "role": "上装", "name": "焦糖" },
    { "hex": "#2C3A55", "role": "外套", "name": "藏蓝" },
    { "hex": "#2C3A55", "role": "下装", "name": "藏蓝" },
    { "hex": "#F4F1EA", "role": "鞋", "name": "奶白" }
  ],
  "rule": "撞色只撞一处：暖棕集中在胸颈位置吸引视线…",
  "tip": "两个高饱和色别对半分，控制在 1:3 以内，撞色才高级。",
  "scenes": ["commute", "date"],
  "seasons": ["autumn", "winter"],
  "status": "published"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✓ | 全局唯一，建议 `pal-<语义>` |
| `kind` | string | ✓ | 配色法，取值见 `kinds`：`analog` 同色系 / `contrast` 撞色 / `neutral` 中性分层 / `accent` 点亮 |
| `title` | string | ✓ | 6–12 字，可用「×」连接两色 |
| `summary` | string | ✓ | 列表页一句话（≤24 字） |
| `swatches` | array | ✓ | 3–5 个，顺序 = 展示顺序，**主色在前** |
| `swatches[].hex` | string | ✓ | `#RRGGBB`，前端按亮度自动切换文字黑/白 |
| `swatches[].role` | string | ✓ | 上装 / 下装 / 外套 / 鞋 / 包 / 配饰 / 内搭 |
| `swatches[].name` | string | 建议 | 颜色中文名（燕麦米、藏蓝） |
| `rule` | string | ✓ | 这组配色为什么成立（色彩关系，2–3 句） |
| `tip` | string | 建议 | 照抄时的注意点，一句 |
| `scenes` / `seasons` | string[] | — | 复用 `taxonomy.json` 的 key |
| `status` | string | ✓ | `published` / `draft`（draft 不展示） |

自建配色（用户在 App 里试出来的）不写进这个文件，存在浏览器 `localStorage`（键 `xingge.palettes.v1`，数组，字段同上 + `custom: true`）。列表里会和内置配色合并，「我的配色」按钮单独筛出。

页面用到的派生值（不存数据，前端实时算）：

| 派生值 | 算法 | 用途 |
|---|---|---|
| 面积权重 | 按 `role` 查表：外套 .34 / 上装 .28 / 下装 .24 / 内搭 .12 / 鞋 .09 / 包 .03 / 配饰 .02，归一化 | 卡片面积条、详情色块行高度、人形示意 |
| 明度 | `(299R+587G+114B)/255000` | 色块上文字黑/白、明度阶梯 |
| 色相数 | 饱和度 ≥12 的色相去重（22° 容差） | 色相环、撞色/同色系判定 |
| 可穿性评分 | 明度差 ≥30 加分、平均值饱和 >62 扣分，再按 `kind` 校验（撞色要 ≥2 色相、同色系 ≤2、中性要低饱和、点亮要有小面积亮点），基准 3 分，收敛到 1–5 | 详情评分卡、自建试色实时判定 |
| 色相跨度 | 去重色相两两最小弧距 | 「2 个色相 · 跨度 169°」 |

联动规则：

- **搭配 → 配色**：`look.palette` 的色值会与全部 `palettes` 做最近色匹配（平均 RGB 距离 ≤ 68 视为命中），命中就在详情页出现「这组颜色怎么搭 · 去配色手册」。
- **搜索**：搜索框的关键词会同时搜搭配与配色（颜色名、角色、hex、场景都参与匹配），结果分「配色 / 搭配」两段。

## 6. 图片规范

- 目录：`content/images/looks/`，命名与 `id` 对应：`look-10.jpg`
- 尺寸：宽 720px，高度按画幅自然变化；单张控制在 150KB 以内（JPEG quality 82）
- 画幅：**宽/高 在 0.6–0.75 之间**，且同一批内容尽量错开（0.63 / 0.68 / 0.71 …），瀑布流才有错落感
- 若一批图尺寸相同，可用 `python scripts/process_images.py` 批量裁切压缩（会保留原图在 `raw/`）
- 竖构图、全身入镜、背景干净，是这套排版最好看的组合

## 7. 素材库数据（`content/xhs/`）

外部素材（小红书博主页 / 搜索页采集）与主内容分开存放，由脚本生成，**不要手改**。

```
content/xhs/
├── index.json                 ← 前端唯一读取的文件（由 build-xhs-index.cjs 生成）
├── _state.json                ← 博主采集中间态（.gitignore，含 token）
├── _state.search-166xz.json   ← 搜索采集中间态（同上）
└── <noteId>/01.jpg 02.jpg …   ← 每条笔记一个目录
```

`index.json`（version 2）结构：

| 字段 | 说明 |
|---|---|
| `sources[]` | 来源列表：`{ kind: profile\|search, label, keyword, author, count }` |
| `heights[]` | 身高段（来自 `taxonomy.heights`）并附 `count` 统计 |
| `notes[]` | 素材条目，见下表 |

`notes[]` 关键字段：

| 字段 | 说明 |
|---|---|
| `id` | 笔记 id，也是图片目录名 |
| `sourceKind` / `sourceLabel` / `keyword` | 来源标记（博主 or 搜索关键词） |
| `title` / `desc` / `tags` / `author` | 文案与作者 |
| `liked` | 点赞数，已归一化为数字（`2.8万` → `28000`） |
| `cover` / `images` | 首图文件名 / 全部图片文件名 |
| `height` | `{ value, band, label, raw, kind, confidence, range?, tag }` — 见下 |

**身高字段怎么来的**（`scripts/extract-height.cjs`）

- `value` 具体身高（cm），抽不到为 `null`
- `band` 归属段（`h165` 等），前端按它筛选
- `kind` 抽取依据：`explicit`（166cm）/ `height-weight`（162/60）/ `range`（165-175，取下限）/ `context`（165小个子）/ `leading`（标题开头三位数）/ `semantic`（只说「小个子」，无数值）/ `none`
- `confidence`：`high` / `medium` / `low` / `none`
- 规则**标题优先于正文**，因为正文常混入别人的身高；不做猜测，抽不到就置空

## 8. 常见错误

| 现象 | 原因 |
|---|---|
| 图片加载完卡片跳动 | `image.ratio` 与实际图片不符 |
| 卡片出现在奇怪位置 | `id` 重复，或 JSON 语法错误导致整体解析失败 |
| 筛选里找不到新内容 | 用了未在 `taxonomy.json` 定义的 key，或 `status` 不是 `published` |
| 页面空白 | 用 `file://` 直接打开，`fetch` 被拦截；改用 http 服务器 |
