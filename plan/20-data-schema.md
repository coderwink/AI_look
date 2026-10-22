# 20 · 数据格式规范

> 填充内容只需要看这一份。所有内容都是 JSON，位于 `content/`，前端只读不写。
> 修改后务必运行：`node scripts/check-content.mjs`

## 1. 文件分工

| 文件 | 内容 | 结构 |
|---|---|---|
| `content/looks.json` | 搭配（卡片 + 详情） | `{ version, updatedAt, looks: Look[] }` |
| `content/editorials.json` | 流内排版卡 | `{ version, updatedAt, editorials: Editorial[] }` |
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
| `tags` | string[] | — | 搜索用关键词（「显高」「面试」等） |
| `author` | string | — | 署名，默认「编辑部」 |
| `status` | `"published"` \| `"draft"` | ✅ | `draft` 不会显示，可先填后发 |
| `createdAt` / `updatedAt` | string | — | `YYYY-MM-DD` |

### 枚举（来自 `taxonomy.json`）

**styles**：`cityboy` 日系 · `street` 街头 · `business` 商务 · `minimal` 极简 · `techwear` 机能 · `retro` 复古 · `smart` 半正式

**scenes**：`daily` 日常 · `commute` 通勤 · `date` 约会 · `trip` 出行 · `party` 聚会

**seasons**：`spring` 春 · `summer` 夏 · `autumn` 秋 · `winter` 冬

**itemCategories**：`outer` 外套 · `top` 上装 · `bottom` 下装 · `shoes` 鞋 · `bag` 包 · `accessory` 配饰

> 增删分类：只改 `taxonomy.json`，前端 Tab、筛选、标签会自动跟着变。改 key 需同步改已有内容。

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

## 5. 图片规范

- 目录：`content/images/looks/`，命名与 `id` 对应：`look-10.jpg`
- 尺寸：宽 720px，高度按画幅自然变化；单张控制在 150KB 以内（JPEG quality 82）
- 画幅：**宽/高 在 0.6–0.75 之间**，且同一批内容尽量错开（0.63 / 0.68 / 0.71 …），瀑布流才有错落感
- 若一批图尺寸相同，可用 `python scripts/process_images.py` 批量裁切压缩（会保留原图在 `raw/`）
- 竖构图、全身入镜、背景干净，是这套排版最好看的组合

## 6. 常见错误

| 现象 | 原因 |
|---|---|
| 图片加载完卡片跳动 | `image.ratio` 与实际图片不符 |
| 卡片出现在奇怪位置 | `id` 重复，或 JSON 语法错误导致整体解析失败 |
| 筛选里找不到新内容 | 用了未在 `taxonomy.json` 定义的 key，或 `status` 不是 `published` |
| 页面空白 | 用 `file://` 直接打开，`fetch` 被拦截；改用 http 服务器 |
