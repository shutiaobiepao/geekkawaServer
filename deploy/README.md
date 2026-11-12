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

`webStatic/` 构建产物**已提交 Git**。本地发版：`npm run sync:all`（或 `sync:leavethechair` / `sync:tool`）→ `git add webStatic` → `push`；ECS：`git pull` + `pm2 restart geekkawa`（改 TS 时还需 `npm run build`）。

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

# 发版快捷命令
npm run sync:leavethechair          # LTC；build:home 已含 CSS/JS 缓存戳，不 hash 图/视频
npm run sync:leavethechair:assets   # LTC + hash:home-assets
npm run sync:tool
npm run sync:all                    # 整站 + build:seo
npm run sync:all:assets

# 仅重组 SEO（已 sync 过 fragments）
npm run build:seo
```

| 标志 | 含义 |
|------|------|
| （默认） | 仅镜像复制；**不** `build:seo` |
| `--build-home` | bodySaver：`npm run build:home` |
| `--hash-home-assets` | bodySaver：`hash:home-assets`（图/视频等；须先 `build:home`） |
| `--build-web` | geekkawaWeb：`npm run build` |
| `--home-only` / `--web-only` | 只同步一侧 |
| `--with-seo` | 结束后 `build:seo`（`sync:all` 使用） |
| `--skip-seo` | 与 `--with-seo` 同用时跳过 `build:seo` |

**环境变量**：`SYNC_BODYSAVER_ROOT`、`SYNC_GEEKKAWA_WEB_ROOT`、`WEB_STATIC_DIR`、`SITE_ORIGIN`。

路径不存在或缺少 `build/` 目录时，脚本会在控制台打印**期望路径**与修正示例。

## ECS 部署

### 1. 安全组

- 公网放行 **80、443**（HTTP/HTTPS），来源通常 `0.0.0.0/0`。
- **不要**对公网开放 Node **3000**。
- SSH **22** 建议限制来源 IP（比全网约安全），但须与**你当前上网的出口公网 IP** 一致。

#### SSH 连不上（`ssh: connect … port 22: Operation timed out`）

若 **网站（80/443）正常**、仅 SSH 超时，优先查 **安全组 → 入方向 → SSH 22** 的 **授权对象**：

- 规则若是 `x.x.x.x/32`，必须是**你此刻用来上网的公网 IP**；换网络（公司/家里、Wi‑Fi/手机热点、宽带重拨）后 IP 会变，旧规则会导致 **22 直接被丢弃**，表现为 timeout（不是密码错误）。
- 本机查看出口 IP：`curl -s https://ip.sb`（或搜索引擎「我的 IP」），在控制台把该 IP 填进 SSH 规则的授权对象，或临时加一条 `/32`。
- **80/443** 与 **22** 是独立规则；不要误以为「网站能开 = SSH 一定通」。
- 禁 ping（ICMP）很常见，`ping` 全丢不代表机器宕机；以 `nc -vz 39.x.x.x 22` 或控制台 **Workbench/VNC** 为准。

调试期可把 SSH 来源设为 `0.0.0.0/0`（风险更高），稳定后再改回固定 IP + 更换时记得更新。

### 2. 进程分工

```text
互联网 → Nginx :443 → proxy_pass http://127.0.0.1:3000 → Fastify
```

配置模板：[nginx/geekkawa.com.conf](./nginx/geekkawa.com.conf)（证书路径按云厂商实际修改）。

### 3. 发版（推荐：本机 sync + push，ECS 只 pull）

**本机**（见仓库根 [README.md](../README.md)「发版流程」）：`npm run sync:all`（或单品命令）→ `git push`。

**ECS**（静态已进 Git，一般**不需要**在服务器跑 sync）：

```bash
cd /var/www/geekkawaServer/geekkawaServer   # 按实际克隆路径

git pull
# 若本次含 TypeScript / 依赖变更：
npm ci && npm run build

pm2 restart geekkawa
# 或：sudo systemctl restart geekkawa

# Nginx 配置有改时：
sudo nginx -t && sudo systemctl reload nginx
```

| 本次变更 | ECS 最少操作 |
|----------|----------------|
| 仅 `webStatic/` | `git pull` + `pm2 restart geekkawa` |
| `src/` 或依赖 | 上表 + `npm run build` |
| `deploy/nginx/*` | `git pull` + `nginx -t` + reload |

**备选**（服务器上仍有 bodySaver / geekkawaWeb 源码时）：可在 ECS 设 `SYNC_BODYSAVER_ROOT`、`SYNC_GEEKKAWA_WEB_ROOT` 后跑 `npm run sync:all`，再 `build` + 重启；与「产物进 Git」二选一即可。

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
