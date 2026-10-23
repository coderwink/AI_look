# 型格 LOOKBOOK · 男士穿搭图鉴

移动端优先的男士穿搭灵感图鉴：小红书式双列瀑布流，按风格 / 场景 / 身高筛选，每套搭配附单品清单、配色方案与搭配提醒。

配套一个本地**素材库**：用本机 Chrome 的登录态采集小红书穿搭笔记，按身高段筛选浏览，看到合适的可以一键「收录为搭配」，回到 App 草稿箱里预览、导出 JSON。

![status](https://img.shields.io/badge/status-v1.1-brightgreen) ![stack](https://img.shields.io/badge/stack-vanilla%20JS%20%C2%B7%20PWA-black)

## 快速开始

```bash
git clone <repo-url> && cd <repo>
python -m http.server 8765
# 浏览器打开 http://localhost:8765
```

> 必须用 http 服务器打开：页面通过 `fetch` 读取 `content/*.json`，`file://` 协议会被浏览器拦截。

安卓手机想当 App 用：用 Chrome 打开线上地址 → 菜单 →「添加到主屏幕」，即可全屏运行并支持离线。

## 目录结构

```
.
├── content/            # 唯一内容源（改这里就能换内容，不用碰代码）
│   ├── looks.json      #   搭配数据
│   ├── editorials.json #   流内排版卡（配色心法、清单、观点）
│   ├── taxonomy.json   #   风格 / 场景 / 季节 / 品类 / 身高 字典
│   ├── schema/         #   JSON Schema（字段契约）
│   ├── templates/      #   新建搭配的模板
│   ├── images/looks/   #   搭配图片
│   └── xhs/            #   素材库（采集到的笔记图片 + index.json）
├── web/                # Web / PWA 端
│   ├── index.html
│   ├── materials.html  #   素材库浏览页
│   ├── css/style.css
│   └── js/app.js
├── android/            # Android 端（规划中）
├── ios/                # iOS 端（规划中）
├── plan/               # 项目计划 / 架构 / 数据规范 / 路线图
├── scripts/            # 内容校验、图片处理、小红书采集
├── index.html          # 根入口，跳转到 web/
├── manifest.webmanifest
└── sw.js               # 离线缓存
```

## 采集素材（可选）

素材库靠本机 Chrome 的登录态跑，不需要扫码：

```bash
npm install                                            # 只装 puppeteer-core
node scripts/xhs-collect.cjs search "<搜索页 URL>" --state search-170 --max 40
node scripts/xhs-collect.cjs detail --state search-170 # 下载图片，可断点续跑
node scripts/build-xhs-index.cjs                       # 合并各来源 → content/xhs/index.json
node scripts/extract-height.cjs                        # 从标题/正文识别身高段
node scripts/verify-materials.cjs                      # 体检：缺图、重复、异常尺寸
```

`--state` 决定写到 `content/xhs/_state.<名称>.json`，不同关键词各自独立，互不覆盖。采集限速 3–8 秒/条，连续跑太久会触发小红书 IP 风控（错误码 300012），歇 1 小时再继续。

素材库页面：`http://localhost:8765/web/materials.html`。详情页的「收录为搭配」会把草稿写进浏览器本地，App 的「我的 → 我的草稿」可以预览、导出 JSON，再粘贴进 `content/looks.json` 发布。

## 维护内容

新增一套搭配：图片丢进 `content/images/looks/`，在 `content/looks.json` 追加一个对象，然后：

```bash
node scripts/check-content.mjs    # 校验（零依赖）
```

字段说明见 [plan/20-data-schema.md](plan/20-data-schema.md)，新建可直接复制 [content/templates/look.template.json](content/templates/look.template.json)。

## 文档

| 文件 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | 给 AI / 新人的上手说明（目录、规则、实现要点） |
| [plan/00-overview.md](plan/00-overview.md) | 产品定位与设计原则 |
| [plan/10-architecture.md](plan/10-architecture.md) | 技术架构与多端方案 |
| [plan/20-data-schema.md](plan/20-data-schema.md) | 数据格式规范（填充内容看这份） |
| [plan/30-roadmap.md](plan/30-roadmap.md) | 路线图与待办 |
| [plan/40-conventions.md](plan/40-conventions.md) | 命名、提交、图片规范 |

## 部署

纯静态站点，任意静态托管均可：

- **GitHub Pages**：Settings → Pages → Source 选 `main` 分支 `/ (root)`，访问 `https://<user>.github.io/<repo>/`
- 根目录 `index.html` 会自动跳转到 `web/`，`content/` 需与 `web/` 同级部署（因为都是相对路径引用）

## 版权

搭配图片由 AI 生成，仅用于原型演示；正式发布请替换为自有版权素材。
