# geekkawaServer

[GeekKawa](https://geekkawa.com) 生产托管服务：在单台 Node（Fastify）上挂载多路径静态站点、`/api/v1` 固定数据接口；生产环境由 **Nginx** 终结 HTTPS 并反代到本进程（默认 `127.0.0.1:3000`）。

与 **geekkawaWeb**、**bodySaver** 分仓开发；构建产物通过 **`sync:web-static`** 写入 `webStatic/` 并 **提交本仓**，服务器 `git pull` 即可更新静态。

## 架构一览

```text
                    ┌─────────────────────────────────────┐
 公网 443/80        │  Nginx（TLS）→ 127.0.0.1:3000      │
                    │  Fastify                             │
                    │    /api/v1/*     →  JSON 接口         │
                    │    /robots.txt   →  .root-seo        │
                    │    /sitemap*.xml →  .root-seo        │
                    │    /              →  geekkawaHome     │
                    │    /leavethechair/homepage/ → LTC      │
                    │    /tool/*       →  geekkawaWeb MPA │
                    └─────────────────────────────────────┘
```

| 路径 | 说明 |
|------|------|
| `/` | 品牌首页（`webStatic/geekkawaHome/`，**进 Git**） |
| `/leavethechair/homepage/` | LeaveTheChair 落地页（bodySaver 构建物） |
| `/leavethechair` | **301** → `/leavethechair/homepage/` |
| `/tool/`、`/tool/photoshop/` | 在线工具 MPA（geekkawaWeb） |
| `/photoshop` | **301** → `/tool/photoshop/` |
| `/api/v1/tools` | 工具目录 JSON（驱动 `/tool/` 列表页） |
| `/robots.txt`、`/llms.txt` | 站根 SEO（`build:seo` 产出） |
| `/sitemap.xml` | Sitemap **索引** |
| `/sitemap-geekkawa.xml` 等 | 各产品子 sitemap |

## 仓库目录

```text
geekkawaServer/
├── src/                    # Fastify 服务源码（TypeScript）
├── seo/                    # 站级 SEO 模板（robots、llms、固定子 sitemap）
├── scripts/
│   ├── sync-web-static.mjs # 从兄弟仓构建物写入 webStatic
│   └── build-seo.mjs       # 组装 _seoFragments + seo/ → .root-seo
├── deploy/nginx/           # Nginx 配置模板
└── webStatic/              # 运行时静态（大部分 gitignore，见下）
    ├── geekkawaHome/       # 品牌首页（提交 Git）
    ├── leavetheChairHomepage/  # LTC 页面（sync 写入）
    ├── geekkawaWeb/        # 工具站 dist（sync 写入）
    ├── _seoFragments/      # 各产品 sitemap 原料（见下文）
    └── .root-seo/          # 对外站根 SEO（build:seo 写入，随 Git 发布）
```

### `webStatic/_seoFragments` 是做什么的？

各产品**独立构建**时会产生自己的 URL 列表（例如 bodySaver 的 `sitemap.xml`）。不能直接都放在站根，否则会互相覆盖。

- **`_seoFragments/<产品>/sitemap.xml`**：只存本产品 urlset，**不对外直链**。
- **`npm run build:seo`** 把它们复制为 `/sitemap-leavethechair.xml`、`/sitemap-tool.xml` 等，并生成根 **`/sitemap.xml` 索引**。
- 站级 **`robots.txt` / `llms.txt`** 以仓库内 **`seo/`** 为主稿。

新增产品线时：sync 时写入 `_seoFragments/新产品/`，或在 `seo/` 增加 `sitemap-新产品.xml`，再跑 `build:seo`。

## 快速开始

**前提**：与本仓库并列存在 `../bodySaver`、`../geekkawaWeb`（或用环境变量改路径）。

```bash
npm install

# 写入静态（可选：先 build 再拷贝）
npm run sync:web-static -- --build-home          # 仅 LTC
npm run sync:web-static -- --build-web           # 仅工具站
npm run sync:web-static:release                 # LTC build + hash + 工具 build + sync + seo

npm run dev
```

浏览器访问 `http://127.0.0.1:3000/`（无 Nginx 时直接打 Fastify）。

仅改 API 或已有 `webStatic` 时可 `npm run dev`，不必每次 sync。

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发：`tsx watch` |
| `npm run build` | 编译 TypeScript → `dist/` |
| `npm start` | 生产：`node dist/server.js` |
| `npm run sync:web-static` | 从兄弟仓拷产物；默认结束后跑 `build:seo` |
| `npm run sync:web-static -- --help` | 分项：`--build-home`、`--hash-home-assets`、`--build-web`、`--home-only`、`--web-only`、`--skip-seo` |
| `npm run sync:web-static:release` | 发版一条龙（含 LTC `hash:home-assets`） |
| `npm run build:seo` | 仅重组 `webStatic/.root-seo/` |

### bodySaver 与 hash 的关系

- **`--build-home`** 只跑 `build:home`（**不**含 `hash:home-assets`）。
- 需要 assets 内容 hash 时单独加 **`--hash-home-assets`**，或直接用 **`sync:web-static:release`**。
- 顺序须为：`build:home` → `hash:home-assets` → sync。

## 环境变量

见 [`.env.example`](./.env.example)。

| 变量 | 默认 | 说明 |
|------|------|------|
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `3000` | 监听端口 |
| `WEB_STATIC_DIR` | `./webStatic` | 静态根 |
| `SITE_ORIGIN` | `https://geekkawa.com` | `build:seo` 里 sitemap 绝对 URL |
| `SYNC_BODYSAVER_ROOT` | `../bodySaver` | sync 脚本 |
| `SYNC_GEEKKAWA_WEB_ROOT` | `../geekkawaWeb` | sync 脚本 |

## 本地开发建议

| 场景 | 做法 |
|------|------|
| 整站接近生产 | `sync:web-static:release` + `npm run dev`，访问 `:3000` |
| 只改在线 PS | 终端 1：`geekkawaServer` `npm run dev`；终端 2：`geekkawaWeb` `npm run dev`（Vite 已 proxy `/api`） |
| 只改 LTC 落地页 | bodySaver `build:home` 后 `sync --build-home` 或 `--home-only` |
| 只改品牌 `/` | 编辑 `webStatic/geekkawaHome/index.html`（可提交 Git） |

## 生产部署

ECS 上 **Nginx 占 80/443**，Fastify 只监听本机 3000；CI /rsync 写入 `webStatic` 后重启 Node。

详细步骤、安全组、systemd 示意见 **[deploy/README.md](./deploy/README.md)**。

## 相关仓库

| 仓库 | 角色 |
|------|------|
| [bodySaver](../bodySaver) | LeaveTheChair 扩展 + 落地页 → `leavetheChairHomepage` |
| [geekkawaWeb](../geekkawaWeb) | 工具 MPA（`/tool/`） |
| **geekkawaServer** | 本服务 + SEO 组装 + 同步脚本 |
