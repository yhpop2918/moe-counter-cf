// ============================================================
// counter.ts —— 计数器接口（等价于原版 server/controller/counter.go）
//
// 原版逻辑（严格照搬）：
//   1. 解析 URL 参数，设置默认值（length=7, scale=1, offset=0,
//      align=center, pixelate=off, darkmode 不传则不生效）
//   2. 如果传了 num 参数 → 直接用 num 作为计数（不累加）
//   3. 否则 → 数据库里把该计数器的 count + 1（原子操作）
//   4. 如果传了 base 且 > 0 → 在计数上加上 base
//   5. 用 utils.combine 的等价逻辑拼出 SVG 返回
// ============================================================
import type { Env } from "./index";
import { buildSvg } from "./svg";
import { listThemes } from "./themes";

/** 计数器请求参数（等价于原版 CounterRequest 结构体） */
interface CounterRequest {
  name: string;     // 计数器名称（必填）
  theme: string;    // 主题名，为空则随机
  length: number;   // 显示位数，默认 7
  scale: number;    // 缩放比例，默认 1
  offset: number;   // 数字间距，默认 0
  align: string;    // left / center / right，默认 center
  pixelate: string; // on / off，默认 off
  darkmode: string; // on / auto / 空，不传则不做暗色处理
  base: number;     // 基础计数值，>0 时叠加
  num: string;      // 直接指定计数值（不累加）
}

/** 计数器接口主处理函数 */
export async function CounterHandler(url: URL, env: Env): Promise<Response> {
  // ---- 第 1 步：解析参数（用 URL 查询字符串，等价于 Gin 的 ShouldBind） ----
  const q = url.searchParams;
  const req: CounterRequest = {
    name: q.get("name") ?? "",
    theme: q.get("theme") ?? "",
    length: parseInt(q.get("length") ?? "7", 10),
    scale: parseFloat(q.get("scale") ?? "1"),
    offset: parseInt(q.get("offset") ?? "0", 10),
    align: q.get("align") || "center",   // 原版：align 为空时默认 center
    pixelate: q.get("pixelate") || "off",
    darkmode: q.get("darkmode") ?? "",   // 原版：不传就不启用暗色模式
    base: parseInt(q.get("base") ?? "0", 10),
    num: q.get("num") ?? "",
  };

  // ---- 第 2 步：设置默认值（与 Go 代码的默认值逻辑一致） ----
  if (!req.length || req.length <= 0) req.length = 7;      // 默认 7 位
  if (!req.scale || req.scale <= 0) req.scale = 1;         // 默认 1 倍缩放
  if (isNaN(req.offset)) req.offset = 0;                   // 默认无间距
  if (isNaN(req.base)) req.base = 0;                       // 默认不加 base

  // ---- 第 3 步：随机主题（theme 参数为空时） ----
  if (req.theme === "") {
    const themes = await listThemes(env);
    if (themes.length === 0) {
      req.theme = "original-new"; // 原版兜底主题名
    } else {
      req.theme = themes[Math.floor(Math.random() * themes.length)];
    }
  }

  // ---- 第 4 步：计算计数 ----
  let count: number;
  let err: Error | null = null;

  if (req.num !== "") {
    // 情况 A：显式指定 num → 直接用，不累加
    // 原版：strconv.ParseUint(num, 10, 32)，超出 uint32 范围报错
    if (!/^\d{1,10}$/.test(req.num) || Number(req.num) > 4294967295) {
      return new Response(JSON.stringify({ error: "无效的num参数" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    count = Number(req.num);
  } else {
    // 情况 B：正常累加（等价于原版 database.IncrementCounter）
    count = await incrementCounter(env, req.name).catch((e) => {
      err = e as Error;
      return 0;
    });
    if (err) {
      return new Response(JSON.stringify({ error: "数据库错误" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    // base 参数：>0 时叠加（与 Go 代码一致，base<=0 忽略）
    if (req.base > 0) {
      count += req.base;
    }
  }

  // ---- 第 5 步：拼接 SVG（等价于原版 utils/combine.go 的 CombineImages） ----
  try {
    const svg = await buildSvg(env, {
      count,
      theme: req.theme,
      length: req.length,
      scale: req.scale,
      offset: req.offset,
      align: req.align,
      pixelate: req.pixelate,
      darkmode: req.darkmode,
    });
    return new Response(svg, {
      status: 200,
      headers: {
        // 与原版相同的 MIME 类型
        "Content-Type": "image/svg+xml",
        // 缓存策略由下面的 CACHE_CONTROL 决定（本次已改为 no-store，
        // 即每次刷新都重新计数；之前 5 分钟缓存会导致刷新不计数）
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "图片生成失败", details: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---- 缓存策略（改这里即可切换两种模式） ----
// "no-store"                    → 彻底不缓存：每次刷新都计数（当前选择，个人博客量级额度足够）
// "public, max-age=300, s-maxage=300" → 5 分钟缓存：省请求额度，但刷新不会立即涨计数
const CACHE_CONTROL = "no-store";

// ---- 计数器累加：等价于原版 database.IncrementCounter ----
// 原版逻辑：查不到就新建 count=1；查到就 count+1。
// D1 写法：先 INSERT OR IGNORE（不存在则插入 count=0），
//         再 UPDATE 原子自增（同一行串行执行，不会丢更新），
//         RETURNING 直接返回新值 —— 一条语句完成"查+改+回"。
async function incrementCounter(env: Env, name: string): Promise<number> {
  // 1) 计数器不存在时插入一条 count=0（INSERT OR IGNORE：已存在则什么都不做）
  await env.DB.prepare(
    `INSERT OR IGNORE INTO counters (name, count, created_at, updated_at)
     VALUES (?, 0, datetime('now'), datetime('now'))`
  ).bind(name).run();

  // 2) 原子自增并取回新值（D1 支持 RETURNING，SQLite 3.35+ 语法）
  const row = await env.DB.prepare(
    `UPDATE counters
        SET count = count + 1, updated_at = datetime('now')
      WHERE name = ?
      RETURNING count`
  ).bind(name).first();

  // 正常情况下必然能查到（上面刚 INSERT 过）
  return Number((row as { count: number }).count);
}
