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
└── webStatic/              # 运行时静态（**提交 Git**，ECS pull 更新）
    ├── geekkawaHome/       # 品牌首页
    ├── leavetheChairHomepage/  # LTC 页面（本地 sync 写入后 commit）
    ├── geekkawaWeb/        # 工具站 dist（同上）
    ├── _seoFragments/      # 各产品 sitemap 原料（见下文）
    └── .root-seo/          # 对外站根 SEO（build:seo 写入）
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

# 写入静态（按产品，见下表）
npm run sync:leavethechair      # LTC：build:home + 同步（CSS/JS 已有缓存戳；不 hash 图/视频）
npm run sync:tool               # 工具站 build + 同步
npm run sync:all                # 整站 + build:seo

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
| `npm run sync:leavethechair` | bodySaver `build:home` → 同步 LTC（**不** hash 图/视频等非 CSS/JS 资源） |
| `npm run sync:leavethechair:assets` | 上项 + `hash:home-assets`（改了 `homePage/assets/` 时用） |
| `npm run sync:tool` | geekkawaWeb `build` → 同步工具站 |
| `npm run sync:all` | 双 build + 双同步 + `build:seo`（推 Git 前整站默认） |
| `npm run sync:all:assets` | `sync:all` + LTC `hash:home-assets` |
| `npm run sync:web-static` | 底层脚本：仅拷贝或自组合 flags（`--help`） |
| `npm run build:seo` | 仅重组 `webStatic/.root-seo/`（改 `seo/` 或需刷新站根 sitemap 时） |

### bodySaver 与「hash」

- **`build:home`**（含于 `sync:leavethechair`）：为 **CSS、JS** 等在 `index.html` 写入 `?v=` 缓存戳。
- **`hash:home-assets`**（`sync:leavethechair:assets` / `sync:all:assets`）：仅为 **`assets/` 下图、视频** 等注入内容 hash；与上项无关。
- 顺序须为：`build:home` →（可选）`hash:home-assets` → sync。
- **`build:seo`** 仅在 **`sync:all` / `sync:all:assets`**（或手动 `build:seo`、带 `--with-seo`）时跑，单品 sync 不碰站根 SEO。

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
| 整站接近生产 | `sync:all` + `npm run dev`，访问 `:3000` |
| 只改在线 PS | 终端 1：`geekkawaServer` `npm run dev`；终端 2：`geekkawaWeb` `npm run dev`（Vite 已 proxy `/api`） |
| 只改 LTC 落地页 | `sync:leavethechair` 或改图后 `sync:leavethechair:assets` |
| 只改品牌 `/` | 编辑 `webStatic/geekkawaHome/index.html`（可提交 Git） |

## 发版流程

静态产物在本机组装并进 Git；**ECS 不 clone bodySaver / geekkawaWeb**，只拉本仓。

### 本机（有兄弟仓 `../bodySaver`、`../geekkawaWeb`）

```bash
cd geekkawaServer

# 整站或单品（见下表）
npm run sync:all

# 仅改 Fastify 源码
npm run build

git add webStatic src dist   # 按实际改动选择
git commit -m "…"
git push origin main
```

| 改了什么 | 本机最少要做 |
|----------|----------------|
| bodySaver 落地页（文案/CSS/JS） | `sync:leavethechair` |
| bodySaver 落地页（图/视频 assets） | `sync:leavethechair:assets` |
| geekkawaWeb | `sync:tool` |
| LTC + 工具 + 站根 sitemap | `sync:all` 或（动 assets）`sync:all:assets` |
| 仅 `seo/` 或 fragments | `npm run build:seo` |
| 仅 `src/`（API / 路由） | `npm run build`（`webStatic` 可不动） |
| 仅 `geekkawaHome` | 直接改 `webStatic/geekkawaHome/` 并 commit |

### ECS 更新

仓库目录以你机器为准（常见：`/var/www/geekkawaServer/geekkawaServer`）。Nginx 反代 **127.0.0.1:3000**，Node **不对公网开 3000**。

```bash
cd /var/www/geekkawaServer/geekkawaServer   # 换成实际路径

git pull

# 仅当本次 push 含 src/ 变更时需要
npm ci          # package-lock 变了时
npm run build

pm2 restart geekkawa    # 或 systemctl restart geekkawa
```

**自检：**

```bash
test -f webStatic/leavetheChairHomepage/index.html && echo OK
curl -I http://127.0.0.1:3000/leavethechair/homepage/
curl -I http://127.0.0.1:3000/tool/
```

仅静态发版（只动了 `webStatic`）：ECS 上 **`git pull` + `pm2 restart geekkawa`** 即可，不必 `npm run build`。

安全组、Nginx 模板、systemd / PM2 环境变量见 **[deploy/README.md](./deploy/README.md)**。

## 相关仓库

| 仓库 | 角色 |
|------|------|
| [bodySaver](../bodySaver) | LeaveTheChair 扩展 + 落地页 → `leavetheChairHomepage` |
| [geekkawaWeb](../geekkawaWeb) | 工具 MPA（`/tool/`） |
| **geekkawaServer** | 本服务 + SEO 组装 + 同步脚本 |
