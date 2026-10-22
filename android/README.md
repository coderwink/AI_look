# Android 端（规划中）

当前为空目录，尚未开始实现。**先读 [`../plan/10-architecture.md`](../plan/10-architecture.md) 的多端章节。**

## 推荐路径：TWA（Trusted Web Activity）

用现有 PWA 直接打包成 Android 应用，内容自动跟随线上，几乎零重复开发。

前提（必须先满足）：

1. 线上地址为 **HTTPS**
2. `manifest.webmanifest` 提供 192 / 512 图标、`start_url`、`display: standalone`
3. 注册 Service Worker 且有离线兜底
4. 完成 Digital Asset Links（把 `assetlinks.json` 放到线上 `/.well-known/`，声明应用与域名归属）

打包工具（任选）：Bubblewrap CLI、PWABuilder。

产出：`android/app-release.aab`（上架 Google Play 用）/ `.apk`（侧载测试用）。

## 何时不该用 TWA

需要以下能力时，TWA 不够，应转原生：

- 推送通知的深度定制
- 后台定位 / 蓝牙 / 传感器
- 原生支付、原生分享面板的深度集成
- 需要离线缓存整个内容库（数百张图）

此时采用 **Kotlin + Jetpack Compose**，内容层读同一份 `content/`：

- 方案 A：把 `content/` 打包进 `assets/`，随版本发布（简单，但更新内容要发版）
- 方案 B：启动时从线上拉 `looks.json` + 图片，本地缓存（内容可热更新，需要网络层）
- 数据结构以 `content/schema/look.schema.json` 为准，用 kotlinx.serialization 生成数据类

## 目录约定（开始实现时）

```
android/
├── app/
│   ├── src/main/java/...        # Compose 页面
│   ├── src/main/assets/content/ # 打包方案 A 时放这里
│   └── src/main/res/            # 图标、启动图
├── build.gradle.kts
└── README.md
```

## iOS 提醒

若同时做 iOS，**先定数据契约，再定各端 UI**，避免两端字段不一致。
