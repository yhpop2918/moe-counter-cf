// ============================================================
// index.ts —— Worker 入口（等价于原版 server/router.go）
//
// 原版路由（Gin）：
//   GET /             → 首页 index.html
//   GET /favicon.ico  → 站点图标
//   GET /assets/*     → 主题数字图等静态资源
//   GET /api/counter  → 计数器接口（核心）
//   GET /api/themes   → 主题列表接口
//
// 迁移后：
//   首页 / favicon / assets/* 由 Cloudflare 静态资产直接提供
//   （见 wrangler.jsonc 的 assets 配置，静态请求免费不限量），
//   Worker 只负责两个 API 接口。
// ============================================================
import { CounterHandler } from "./counter";
import { ThemeListHandler } from "./themes";

// ---- 环境变量类型：在 wrangler.jsonc 里声明的绑定会自动注入 ----
export interface Env {
  /** D1 数据库（原 SQLite data.db 的替代） */
  DB: D1Database;
  /** 静态资产（原 public/ 目录，含主题数字图） */
  ASSETS: Fetcher;
}

// ---- Worker 入口函数：每个请求都会调用它 ----
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. 只处理 GET 请求（原版也是只注册了 GET 路由）
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 2. 简易路由表（3 个接口用 if 判断即可，无需引入框架）
    //    原版路由是 /api/counter；README 示例里写过 /counter，
    //    这里顺手兼容一下，用不到可以删掉下面这行。
    if (path === "/api/counter" || path === "/counter") {
      return CounterHandler(url, env);
    }

    if (path === "/api/themes") {
      return ThemeListHandler(env);
    }

    // 3. 其他路径：交给静态资产处理。
    //    注意：/assets/*、/ 、/favicon.ico 这类请求在配置了
    //    assets 之后，通常根本到不了 Worker（平台直接返回文件），
    //    这里再兜底一次是为了更稳妥。
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404) {
      return new Response("Not Found", { status: 404 });
    }
    return assetRes;
  },
};
