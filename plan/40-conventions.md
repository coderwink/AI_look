# 40 · 工程约定

## 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 内容 id | `look-<数字>` / `ed-<数字>`，全局唯一 | `look-12` |
| 图片文件 | 与 id 同名 | `look-12.jpg` |
| JSON key | 小驼峰；枚举值小写英文 | `image.ratio`、`cityboy` |
| CSS 类名 | 短横线，语义化，不嵌套超过 2 层 | `.card-foot`、`.masonry` |
| JS 函数 | 动词开头，渲染类统一 `renderXxx` | `renderFeed`、`layoutMasonry` |

## 内容文案

- `title`：用「×」连接上下装，不堆形容词（`奶油针织 × 宽松卡其`）
- `summary`：一句话说清这套为什么成立，≤ 20 字
- `desc`：2–3 句，讲**为什么**这样搭，不讲「时尚」「氛围感」这类空话
- `items[].note`：写可执行的信息（版型、长度、克重、鞋头形状）
- `tip`：一条能立刻用上的提醒，禁止出现「注意搭配」这种废话

## 图片

- 宽 720px，JPEG quality 82，单张 < 150KB
- 画幅宽/高 0.6–0.75，同一批内容错开取值
- 竖构图、全身入镜、背景干净、无文字水印
- 原图留在 `raw/`（不进 Git），处理脚本：`python scripts/process_images.py`

## Git

提交信息用「类型: 说明」：

```
feat: 新增 6 套秋季通勤搭配
content: 补充 look-12 单品要点
fix: 修复切换 Tab 后瀑布流未重排
style: 调整卡片圆角与阴影
docs: 更新数据格式说明
chore: 升级 SW 缓存版本
```

**一次提交只做一件事**，内容提交与代码提交分开。

不提交：`raw/`、`.workbuddy/`、`node_modules/`、系统缩略图文件。

## 代码

- 不引入构建工具、不引入框架、不加依赖（零依赖是产品决策，见 `plan/10-architecture.md`）
- 新增内容字段 → 先改 `content/schema/look.schema.json` + `content/templates/look.template.json` + `plan/20-data-schema.md`，再改代码
- 枚举值 → 只改 `content/taxonomy.json`
- 任何对 `content/` 的修改都要跑 `node scripts/check-content.mjs`
- 改 `sw.js` 的缓存内容 → `VERSION` 加一

## 提交前检查

```bash
node scripts/check-content.mjs      # 内容合法
python -m http.server 8765          # 本地看一眼首屏 & 详情页
```

- [ ] 首屏瀑布流两列错落、无跳动
- [ ] 新增搭配在对应风格/场景筛选中出现
- [ ] 收藏后刷新仍在
- [ ] 手机宽度（375 / 390 / 414）下无横向滚动
