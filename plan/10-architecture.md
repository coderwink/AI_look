# 10 · 技术架构

## 总体形态

```
┌──────────────────────────────────────────────┐
│  content/  （唯一内容源，纯数据，跨端共享）      │
│  looks.json · editorials.json · taxonomy.json │
│  images/looks/*.jpg                           │
└───────────────┬──────────────────────────────┘
                │ 只读
     ┌──────────┼──────────────┐
     ▼          ▼              ▼
  ┌──────┐  ┌────────┐   ┌────────┐
  │ web/ │  │android/│   │ ios/   │
  │ PWA  │  │ 规划中  │   │ 规划中  │
  └──────┘  └────────┘   └────────┘
```

关键决定：**内容层独立于任何一端**。换端、加端都不改内容，只改渲染。

## Web 端（当前）

- **零构建**：没有 package.json、没有打包器。克隆 + 起静态服务器即可运行
- **模块**：`<script type="module">` 直接跑 ES Module
- **数据获取**：`fetch('../content/*.json')`，失败时页面显示可操作的错误提示
- **状态**：内存对象 `state`（筛选条件）；持久化只有收藏，走 `localStorage`

### 文件职责

| 文件 | 职责 |
|---|---|
| `web/index.html` | 静态骨架：顶栏、Tab、瀑布流容器、详情层、搜索层、底部导航 |
| `web/js/app.js` | 内容加载 → 渲染 → 瀑布流排版 → 交互 → 本地存储 |
| `web/css/style.css` | 全部样式；CSS 变量集中在 `:root` |
| `sw.js`（根） | 离线缓存：导航/JSON 网络优先，图片/静态资源缓存优先 |
| `manifest.webmanifest`（根） | PWA 安装配置 |

### 瀑布流算法

为什么不用 `column-count`：CSS 多列是**纵向填满**，第 1 列排满才进第 2 列，导致视觉顺序是「先往下、再往右」，与用户预期的「左→右」不符。

因此用 JS 计算绝对定位：

```
for each card:
  width = (容器宽 - gap) / 2
  col   = 当前较矮的那一列
  transform = translate3d(col * (width + gap), 该列累计高度)
  该列高度 += 卡片高 + gap
容器高度 = 最高列
```

要点：

- 卡片高度可在图片加载前确定 —— 图片用 `aspect-ratio: var(--r)`，`--r` 来自 `image.ratio`
- 容器隐藏时 `clientWidth === 0`，必须等可见后再排（`switchTab` 里处理）
- 卡片入场动画只动 `opacity`，避免与 JS 设置的 `transform` 冲突
- 窗口尺寸变化 / 横竖屏切换 → 防抖后重排

## 存储层

```js
const storage = {
  key: 'xingge.v1',
  data: { favs: [], seen: [] },
  load(), save(), isFav(id), toggleFav(id), markSeen(id), clearFavs()
}
```

所有收藏读写都经过它。**接云账号时只替换这个对象**（把方法改成 async、内部调用云端 API），UI 层不需要动。

## PWA 与部署

- 站点根 = 仓库根：`/` 的 `index.html` 跳转到 `/web/`，`content/` 与 `web/` 同级，相对路径引用
- `sw.js` 放在根目录，默认 scope 为全站（能控制 `content/images/` 的缓存）
- 改版后把 `sw.js` 里的 `VERSION` 加一，旧缓存自动清除
- 部署：GitHub Pages（Source = `main` / root）或任意静态托管

## Android / iOS 落地路径

| 端 | 首选方案 | 何时升级 |
|---|---|---|
| Android | **TWA**（Trusted Web Activity）：用现有的 PWA 直接打成 APK / AAB，改动最小，内容自动跟随线上 | 需要推送、后台定位、原生支付等 PWA 做不到的能力时，转 Kotlin + Compose，内容层读同一份 JSON（打包进 assets 或远程拉取） |
| iOS | **WKWebView 壳**：包一层原生容器 + 启动图，内容仍来自同一份 JSON | 需要更原生体验时转 SwiftUI，内容层同样复用 |

两端都不重新定义数据结构 —— `content/schema/look.schema.json` 是唯一契约。

## 未来接后端时

需要账号/同步/内容后台时，按此顺序演进：

1. 收藏改为云端存储，`storage` 换实现，保留离线队列
2. `content/` 从静态 JSON 迁到托管数据库，但**保持导出成同样结构的 JSON**，前端契约不变
3. 增加内容后台（增删改搭配 + 图片上传），仍需通过 schema 校验
