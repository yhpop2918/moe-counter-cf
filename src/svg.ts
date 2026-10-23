// ============================================================
// svg.ts —— SVG 拼接生成（等价于原版 utils/combine.go 的 CombineImages）
//
// 原版流程（严格照搬）：
//   1. 计数转字符串，位数不足 length 时左侧补零
//   2. 确定扩展名：0.gif 存在用 gif，否则用 png
//   3. 加载数字 0-9 图片，以及可选的 start / end 前后缀图
//   4. 按 scale 缩放、offset 间距，算出总宽度和最大高度
//   5. 按 align 计算起始 x，逐张输出 <image> 标签（base64 data URI 内嵌）
//   6. 可选 pixelate / darkmode 样式
//
// 关键差异点：原版在服务器启动时把图片读进内存；这里第一次用某个
// 主题时从静态资产拉取并缓存到内存（Map），后续请求直接命中缓存。
// ============================================================
import type { Env } from "./index";
import { getThemeInfo, type ThemeInfo } from "./themes";

/** buildSvg 的入参（从 counter.ts 传入） */
export interface BuildSvgParams {
  count: number;     // 最终计数
  theme: string;     // 主题名
  length: number;    // 显示位数
  scale: number;     // 缩放
  offset: number;    // 数字间距
  align: string;     // left / center / right
  pixelate: string;  // on / off
  darkmode: string;  // on / auto / 空
}

/** 主题图片的内存缓存：key 为 "主题/文件名.png"，value 为 base64 data URI */
const imageCache = new Map<string, string>();

/**
 * 主函数：生成计数器 SVG 字符串
 */
export async function buildSvg(env: Env, p: BuildSvgParams): Promise<string> {
  // ---- 1. 计数转字符串 + 左侧补零（长度不足时补，超出时保留原长度） ----
  let countStr = String(p.count);
  if (countStr.length < p.length) {
    countStr = "0".repeat(p.length - countStr.length) + countStr;
  }

  // ---- 2. 读取主题清单（宽高等元数据来自构建期生成的 manifest.json） ----
  const theme = getThemeInfo(p.theme);
  if (!theme) {
    throw new Error(`主题不存在: ${p.theme}`);
  }

  // ---- 3. 组装字符序列：start(可选) + 每一位数字 + end(可选) ----
  const chars: string[] = [];
  if (theme.files["start"]) chars.push("start");
  for (const ch of countStr.split("")) chars.push(ch);
  if (theme.files["end"]) chars.push("end");

  // ---- 4. 加载每张图并计算布局（算法与原版完全一致） ----
  // 图片顺序 -> { dataURI, 缩放后的宽高 }
  const images: { dataURI: string; w: number; h: number }[] = [];
  let totalWidth = 0;   // 总宽度 = 所有图宽之和 + offset * (张数-1)
  let maxHeight = 0;    // 最大高度 = 所有图高中的最大值
  const n = chars.length;

  for (let i = 0; i < n; i++) {
    const char = chars[i];
    const info = theme.files[char];
    if (!info) continue; // 理论上不会发生（数字必有），防御性跳过

    // 读取图片（带内存缓存），转换为 base64 data URI
    const dataURI = await loadThemeImage(env, p.theme, char, theme);

    const w = Math.floor(info.w * p.scale); // 原版 int(float64*scale) 即向下取整
    const h = Math.floor(info.h * p.scale);
    totalWidth += w;
    if (i < n - 1) totalWidth += p.offset;  // 图片之间加间距（最后一张后不加）
    if (h > maxHeight) maxHeight = h;

    images.push({ dataURI, w, h });
  }

  // ---- 5. 根据对齐方式计算起始 x（与原版 switch 逻辑一致） ----
  // 原版先算 contentWidth = totalWidth - offset*(n-1)（纯图片宽度）
  const contentWidth = totalWidth - p.offset * (n - 1);
  let startX = 0;
  if (p.align === "center") {
    startX = Math.floor((totalWidth - contentWidth) / 2); // 图片水平居中
  } else if (p.align === "right") {
    startX = totalWidth - contentWidth; // 靠右
  }
  // left 时 startX 保持 0

  // ---- 6. 拼 SVG（结构与原版逐字符一致） ----
  let svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" \n` +
    `\twidth="${totalWidth}" height="${maxHeight}" \n` +
    `\tviewBox="0 0 ${totalWidth} ${maxHeight}">`;

  // 可选样式：像素化 / 暗色模式（对应原版的 <style> 块）
  const styleContent = buildStyle(p.pixelate, p.darkmode);
  if (styleContent) svg += styleContent;

  // 逐张输出 <image> 标签
  let xPos = startX;
  for (const img of images) {
    const yPos = Math.floor((maxHeight - img.h) / 2); // 垂直居中（原版同式）
    svg +=
      `\n\t<image x="${xPos}" y="${yPos}" \n` +
      `\t\twidth="${img.w}" height="${img.h}" \n` +
      `\t\txlink:href="${img.dataURI}" />`;
    xPos += img.w + p.offset;
  }

  svg += `\n</svg>`;
  return svg;
}

// ---- 生成 <style> 块（pixelate / darkmode），无样式时返回空串 ----
function buildStyle(pixelate: string, darkmode: string): string {
  if (pixelate !== "on" && darkmode === "") return ""; // 原版：两者都无则无 style

  let s = `\n\t<style>`;
  if (pixelate === "on") {
    s += `\n\t  svg {\n\t    image-rendering: pixelated;\n\t  }`;
  }
  if (darkmode === "on") {
    s += `\n\t  svg {\n\t    filter: brightness(.6);\n\t  }`;
  } else if (darkmode === "auto") {
    s += `\n\t  @media (prefers-color-scheme: dark) {\n\t    svg {\n\t      filter: brightness(.6);\n\t    }\n\t  }`;
  }
  s += `\n\t</style>`;
  return s;
}

// ---- 读取主题图片并转 base64 data URI（带内存缓存） ----
// 原版用 embed.FS 在进程内读文件；这里改用 env.ASSETS.fetch 拉取
// 自己部署的静态文件（子请求不计费），并把结果缓存在内存里。
async function loadThemeImage(
  env: Env,
  theme: string,
  char: string,
  themeInfo: ThemeInfo
): Promise<string> {
  const key = `${theme}/${char}.${themeInfo.ext}`;

  // 缓存命中直接返回（每个隔离实例只拉取一次）
  const cached = imageCache.get(key);
  if (cached) return cached;

  // 从静态资产拉取原始图片
  // 注意：Worker 内用 ASSETS 绑定取文件时，用任意绝对 URL 即可，
  //       平台按路径 /assets/theme/... 匹配文件（与原版目录一致）
  const url = new URL(`/assets/theme/${key}`, "https://assets.local");
  const res = await env.ASSETS.fetch(new Request(url));
  if (!res.ok) {
    throw new Error(`读取主题图片失败: ${key} (HTTP ${res.status})`);
  }

  // 二进制 → base64 → data URI（与 loadImageInfo 生成格式一致）
  const buf = await res.arrayBuffer();
  const mime = themeInfo.ext === "gif" ? "image/gif" : "image/png";
  const dataURI = `data:${mime};base64,${arrayBufferToBase64(buf)}`;

  // 写入内存缓存（Map 上限很小，主题图每主题 10~12 张，无需担心膨胀）
  imageCache.set(key, dataURI);
  return dataURI;
}

// ---- ArrayBuffer → base64（分块处理，避免超大文件爆栈） ----
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000; // 每次 32KB，防止 String.fromCharCode 参数过多
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
