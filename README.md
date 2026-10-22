# 型格 LOOKBOOK · 男士穿搭图鉴

移动端优先的男士穿搭灵感图鉴：小红书式双列瀑布流，按风格 / 场景筛选，每套搭配附单品清单、配色方案与搭配提醒。

![status](https://img.shields.io/badge/status-v1.0-brightgreen) ![stack](https://img.shields.io/badge/stack-vanilla%20JS%20%C2%B7%20PWA-black)

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
│   ├── taxonomy.json   #   风格 / 场景 / 季节 / 品类字典
│   ├── schema/         #   JSON Schema（字段契约）
│   ├── templates/      #   新建搭配的模板
│   └── images/looks/   #   搭配图片
├── web/                # Web / PWA 端
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── android/            # Android 端（规划中）
├── ios/                # iOS 端（规划中）
├── plan/               # 项目计划 / 架构 / 数据规范 / 路线图
├── scripts/            # 内容校验、图片处理
├── index.html          # 根入口，跳转到 web/
├── manifest.webmanifest
└── sw.js               # 离线缓存
```

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
