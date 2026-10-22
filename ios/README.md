# iOS 端（规划中）

当前为空目录，尚未开始实现。**先读 [`../plan/10-architecture.md`](../plan/10-architecture.md) 的多端章节。**

## 推荐路径：WKWebView 壳 → SwiftUI

**阶段一（快）**：原生壳 + WKWebView 加载线上 PWA

- 优点：一周内可上 TestFlight，内容与 Web 完全一致
- 需要：启动图、App 图标、隐私清单（`PrivacyInfo.xcprivacy`）、ATS 配置（HTTPS）
- 注意：iOS 的「添加到主屏幕」体验弱于 Android，用壳包一层体验更好

**阶段二（原生体验）**：SwiftUI 重写列表与详情

- 内容层读同一份 `content/`：
  - 方案 A：打包进 Bundle（内容更新需发版）
  - 方案 B：启动时拉取线上 JSON + 图片，`URLCache` 缓存（推荐，内容可热更新）
- 数据结构以 `content/schema/look.schema.json` 为准，用 `Codable` 建模
- 瀑布流可用 `LazyVStack` + 双列 `HStack`，或自绘 `UICollectionViewLayout`

## 合规提醒

- App Store 对「纯网页壳」审核趋严，需要有原生价值（离线内容、收藏本地化、推送等）
- 若上线受阻，先以 PWA「添加到主屏幕」交付 iOS 用户

## 目录约定（开始实现时）

```
ios/
├── XinggeLookbook.xcodeproj
├── XinggeLookbook/
│   ├── Views/       # SwiftUI 页面
│   ├── Models/      # Codable，对应 look.schema.json
│   ├── Content/     # 方案 A 的内容包
│   └── Assets.xcassets
└── README.md
```
