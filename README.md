# Moe Counter — Cloudflare Workers + D1 版

萌系访问计数器，原版 [skyle1995/Moe-Counter-Go](https://github.com/skyle1995/Moe-Counter-Go)（Go + Gin + GORM + SQLite）
的 **Serverless 迁移版**：用 TypeScript 重写，跑在 Cloudflare Workers 上，数据存 D1（SQLite 内核）。

**个人博客量级（<10 万请求/日）全程免费、零运维**，无需再维护服务器。

> 在线示例（部署者自用实例）：<https://moe.yhpop.com>
>
> 徽章用法：
> `https://moe.yhpop.com/api/counter?name=你的计数器名&theme=miku&length=7`
>
> ![miku 示例](https://moe.yhpop.com/api/counter?name=github-readme-demo&theme=miku)

---

## 与原版的差异

| 项目 | 原版（Go） | 本工程（Cloudflare） |
|---|---|---|
| 运行方式 | 常驻进程 / 端口 / 守护进程 | Serverless，按需运行，零运维 |
| 数据存储 | SQLite `data.db`（GORM） | D1 `counters` 表（见 `schema.sql`） |
| 计数累加 | 事务 + 文件锁 | D1 原子 `UPDATE ... RETURNING`（并发安全） |
| 主题列表 | 直接扫目录 | `src/manifest.json` 清单（构建时生成） |
| 主题图片 | 本地读取 | Worker 静态资产（Cloudflare 免费分发） |
| 额外内容 | — | 新增 `yousa-ling` 主题（gif 动图） |

接口参数与响应格式和原版完全一致，博客徽章地址只需换域名即可无缝切换。

## 目录结构

```
moe-counter-cf/
├── src/                      # Worker 源码（TypeScript）
│   ├── index.ts              # 入口 + 路由（对应 server/router.go）
│   ├── counter.ts            # 计数器接口（对应 controller/counter.go）
│   ├── svg.ts                # SVG 拼接（对应 utils/combine.go）
│   ├── themes.ts             # 主题列表（对应 controller/theme.go）
│   └── manifest.json         # 主题清单（npm run manifest 自动生成）
├── public/                   # 静态资产（首页、图标、主题数字图）
│   ├── index.html
│   ├── favicon.ico
│   └── assets/theme/         # 各主题 0.png~9.png（或 0.gif~9.gif）
├── scripts/
│   ├── build-manifest.mjs    # 扫描主题 → 生成 manifest.json
│   └── migrate-data.sh       # 本地 data.db → D1 数据迁移
├── schema.sql                # D1 建表 SQL
├── wrangler.example.jsonc    # 部署配置模板（复制为 wrangler.jsonc 后填自己的 database_id）
├── package.json
└── tsconfig.json
```

> `wrangler.jsonc`（含你真实的 D1 `database_id`）已被 `.gitignore` 忽略，不会进入公开仓库；
> 公开的是 `wrangler.example.jsonc` 模板。

## 快速部署（约 5 分钟）

### 0. 前置准备
- [Node.js 18+](https://nodejs.org/)（自带 npm）
- 免费注册一个 [Cloudflare 账号](https://dash.cloudflare.com/)

### 1. 获取代码并安装依赖
```bash
git clone https://github.com/yhpop2918/moe-counter-cf.git
cd moe-counter-cf
npm install
```

### 2. 登录 Cloudflare
```bash
npx wrangler login        # 会打开浏览器，点 Allow 授权
```

### 3. 创建 D1 数据库
```bash
npx wrangler d1 create moe-counter
```
命令会输出一串 `database_id`（字母数字），先复制下来。

### 4. 生成部署配置
```bash
Copy-Item wrangler.example.jsonc wrangler.jsonc    # Windows
# cp wrangler.example.jsonc wrangler.jsonc         # macOS / Linux
```
用编辑器打开 `wrangler.jsonc`，把 `YOUR_D1_DATABASE_ID` 替换成第 3 步的 ID。
**不替换直接部署会报错。**

### 5. 建表 + 生成主题清单
```bash
npm run db:create         # 在 D1 里创建 counters 表
npm run manifest          # 扫描 public/assets/theme，生成 src/manifest.json
```

### 6. 部署
```bash
npm run deploy
```
完成后会得到地址 `https://moe-counter.<你的用户名>.workers.dev`。

### 7.（强烈建议）绑定自定义域名
1. Cloudflare 控制台 → Workers & Pages → `moe-counter` → Settings → Domains & Routes
2. Add custom domain，填你已有的域名（如 `count.example.com`）
3. 按提示在 DNS 加 CNAME 指向 `moe-counter.<用户名>.workers.dev`
4. 等 TLS 证书自动签发（几分钟），即可用 `https://count.example.com` 访问
   （国内访问体验通常比 `*.workers.dev` 直连好）

### 8. 示例 URL

```bash
curl "https://你的域名/api/counter?name=test&theme=miku"     # 返回 SVG
curl "https://你的域名/api/counter?name=test&num=12345"      # 指定数值
curl "https://你的域名/api/themes"                            # 主题列表
```

### （可选）迁移旧计数数据
如果原 VPS 上 `data.db` 里有历史计数：把 `data.db` 复制到本目录，然后
```bash
npm run db:migrate
```

## 接口参数（与原版完全一致）

| 参数 | 说明 | 默认值 |
|---|---|---|
| `name` | 计数器名称（必填） | 无 |
| `theme` | 主题名（不填则随机） | 随机 |
| `length` | 显示位数，不足补零 | 7 |
| `scale` | 图片缩放比例 | 1 |
| `offset` | 数字间距（px） | 0 |
| `align` | left / center / right | center |
| `pixelate` | on / off 像素化 | off |
| `darkmode` | on / auto  | auto |
| `base` | 基础计数，>0 时叠加 | 0 |
| `num` | 直接指定计数值（**不累加**） | 无 |

## 免费额度预算（2026-10 官方定价）

| 资源 | 免费档 | 每次徽章刷新消耗 |
|---|---|---|
| Worker 请求 | 10 万/日 | 1 次 |
| D1 读取 | 500 万/日 | 1 行 |
| D1 写入 | 10 万/日 | 1 行 |
| 静态资产请求 | 免费不限 | 0 |
| 存储 | 5 GB/账号 | 可忽略 |

默认响应头为 `Cache-Control: no-store`，**每次刷新都会实时 +1**，计数不会延迟；
个人博客量级完全在免费额度内。若担心高频刷爆额度，可把
`src/counter.ts` 顶部的 `CACHE_CONTROL` 改回 `"public, max-age=300, s-maxage=300"`
（代价：同一徽章 5 分钟内不刷新计数）。

## 新增主题 / 图片

1. 把图片放进 `public\assets\theme\<主题名>\`
   （0.png~9.png 必填；start/end 可选；gif 主题用 0.gif~9.gif）
2. `npm run manifest`（更新清单）
3. `npm run deploy`（重新部署）

## 常见问题

**Q：部署报错 `database_id`？**
第 4 步没把 `wrangler.example.jsonc` 复制成 `wrangler.jsonc`，或 ID 仍是 `YOUR_D1_DATABASE_ID`。

**Q：SVG 里图片不显示？**
确认 `public/assets/theme` 里有对应主题、执行过 `npm run manifest`，
且 `wrangler.jsonc` 的 `assets.directory` 是 `./public`。

**Q：计数不涨？**
确认请求带 `name` 参数、且没带 `num` 参数；查库：
```bash
npx wrangler d1 execute moe-counter --remote --command "SELECT * FROM counters"
```

**Q：每次刷新都要计数，但怕被刷爆？**
默认 `no-store` 会实时计数。可以在 Cloudflare 控制台给该域名加 WAF 限速规则，
或按上文把缓存改回 300 秒。

## 回滚 / 下线

部署到 Cloudflare 不影响你的 VPS：
- 把博客徽章 URL 改回原 VPS 地址即可回滚；
- 原 `data.db` 未动过，数据仍在；
- 如要彻底下线：控制台删除 Worker 与 D1 即可，无任何残留费用。

## 致谢

- 原版项目：[skyle1995/Moe-Counter-Go](https://github.com/skyle1995/Moe-Counter-Go)
- 本项目部分资源基于：[journey-ad/Moe-Counter](https://github.com/journey-ad/Moe-Counter)
- 主题素材与逻辑移植自原版仓库；商用前请查阅原仓库 License 与素材来源。
