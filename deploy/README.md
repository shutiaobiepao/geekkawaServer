# 部署说明

## 目录约定

| 来源 | 写入路径 | 对外 URL |
|------|----------|----------|
| `bodySaver` **`build/homePage/`** | `webStatic/leavetheChairHomepage/` | `/leavethechair/homepage/` |
| `bodySaver` **`build/homePageSEO/sitemap.xml`** | `webStatic/_seoFragments/leavethechair/` | 组装为 `/sitemap-leavethechair.xml` |
| `geekkawaWeb` **`dist/`** | `webStatic/geekkawaWeb/` | `/tool/...` |
| `geekkawaWeb` **`dist/sitemap.xml`**（若有） | `_seoFragments/tool/` | `/sitemap-tool.xml` |
| 本仓 **`seo/`** + fragments | `webStatic/.root-seo/` | `/robots.txt`、`/sitemap.xml`、`/llms.txt`、子 sitemap |
| **`webStatic/geekkawaHome/`**（Git） | 同左 | `/` |

`webStatic/` 中除 **`geekkawaHome/`** 外**不提交 Git**；由 `sync-web-static` 或 CI 填充。

### SEO 数据流

```text
bodySaver build/homePageSEO/sitemap.xml
        └─sync──► _seoFragments/leavethechair/sitemap.xml
geekkawaWeb dist/sitemap.xml
        └─sync──► _seoFragments/tool/sitemap.xml
seo/robots.txt, seo/llms.txt, seo/sitemap-geekkawa.xml, …
        └─build:seo──► .root-seo/  ──►  /robots.txt, /sitemap.xml, …
```

**不要**在 CI 里用 bodySaver 顶层 `npm run build`（会打扩展 zip）；官网仅需 `build:home`（+ 可选 `hash:home-assets`）。

## Fastify 路由（本机无 Nginx 时同上）

| URL | 行为 |
|-----|------|
| `/` | `geekkawaHome` 静态 |
| `/leavethechair`、`/leavethechair/`、`/leavethechair/homepage` | **301** → `/leavethechair/homepage/` |
| `/leavethechair/homepage/*` | `leavetheChairHomepage` |
| `/tool/*` | `geekkawaWeb` MPA + `/tool/photoshop/` fallback |
| `/photoshop` | **301** → `/tool/photoshop/` |
| `/robots.txt`、`/llms.txt`、`/sitemap.xml` | `.root-seo` |
| `/sitemap-<name>.xml` | `.root-seo` |
| `/api/v1/*` | 接口 |

## 本地同步与发版

```bash
cd geekkawaServer

npm run sync:web-static -- --help

# 常见
npm run sync:web-static -- --build-home
npm run sync:web-static -- --build-home --hash-home-assets
npm run sync:web-static -- --build-web
npm run sync:web-static:release

# 仅重组 SEO（已 sync 过 fragments）
npm run build:seo
```

| 标志 | 含义 |
|------|------|
| （默认） | 拷贝 home + web（若未 `--home-only`/`--web-only`），结束后 **`build:seo`** |
| `--build-home` | bodySaver：`npm run build:home` |
| `--hash-home-assets` | bodySaver：`npm run hash:home-assets`（须先 `build:home`） |
| `--build-web` | geekkawaWeb：`npm run build` |
| `--home-only` / `--web-only` | 只同步一侧 |
| `--skip-seo` | 不执行 `build:seo` |

**环境变量**：`SYNC_BODYSAVER_ROOT`、`SYNC_GEEKKAWA_WEB_ROOT`、`WEB_STATIC_DIR`、`SITE_ORIGIN`。

路径不存在或缺少 `build/` 目录时，脚本会在控制台打印**期望路径**与修正示例。

## ECS 部署

### 1. 安全组

- 公网放行 **80、443**（HTTP/HTTPS）。
- **不要**对公网开放 Node **3000**。
- SSH **22** 建议限制来源 IP。

### 2. 进程分工

```text
互联网 → Nginx :443 → proxy_pass http://127.0.0.1:3000 → Fastify
```

配置模板：[nginx/geekkawa.com.conf](./nginx/geekkawa.com.conf)（证书路径按云厂商实际修改）。

### 3. 发版顺序（与本地 release 等价）

```bash
# 在构建机或 ECS 上（路径按实际）
export SYNC_BODYSAVER_ROOT=/var/src/bodySaver
export SYNC_GEEKKAWA_WEB_ROOT=/var/src/geekkawaWeb

cd /var/www/geekkawaServer
git pull
npm ci
npm run sync:web-static:release   # 或 CI 已准备好 webStatic 则跳过
npm run build
sudo systemctl restart geekkawa   # 自建 unit，见下
sudo nginx -t && sudo systemctl reload nginx
```

### 4. systemd 示例

`/etc/systemd/system/geekkawa.service`：

```ini
[Unit]
Description=GeekKawa Fastify
After=network.target

[Service]
WorkingDirectory=/var/www/geekkawaServer
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node dist/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## 本地双进程开发（工具站 HMR）

**终端 1** — Server：

```bash
cd geekkawaServer && npm run dev
```

**终端 2** — 前端（`geekkawaWeb` 已配置 `/api` → `127.0.0.1:3000`）：

```bash
cd geekkawaWeb && npm run dev
```

- 工具目录：`http://localhost:5173/tool/`
- 在线 PS：`http://localhost:5173/tool/photoshop/`
- 整站静态联调：`sync:web-static` 后访问 `http://127.0.0.1:3000/`

LTC 页面开发可用 bodySaver：`npm run preview:home:watch`（端口 6002），或改完 `sync --build-home`。

## 扩展新产品（SEO + 静态）

1. 约定 URL 前缀，在 `webStatic/` 增加产品目录或通过 sync 写入。
2. 在 Fastify 注册静态前缀与 redirect（改 `src/plugins/staticSites.ts`）。
3. SEO：sync 写入 `_seoFragments/<产品>/sitemap.xml`，或在 `seo/` 添加 `sitemap-<产品>.xml`。
4. `npm run build:seo`，确认 `/sitemap.xml` 索引包含新子 sitemap。

## API

- `GET /api/v1/tools` — 工具列表（`src/data/tools.json`，与 geekkawaWeb `/tool/` 页一致）
