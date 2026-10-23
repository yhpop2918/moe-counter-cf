// ============================================================
// themes.ts —— 主题列表接口 + 主题名读取
//
// 原版 ListThemes：直接扫描 public/assets/theme 下的子目录名。
// 迁移后：静态资产平台不提供"列目录"能力，所以改为读取
// 一个 manifest.json 清单（由 scripts/build-manifest.mjs 生成）。
// 以后新增主题/图片：把图放进 public/assets/theme/<主题名>/ 后，
// 重新执行 npm run manifest 即可。
// ============================================================
import type { Env } from "./index";
import manifest from "./manifest.json"; // 构建期生成的清单（小文件，直接打进代码）

/** 主题列表接口：返回 {"themes": [...]}（与原版响应格式一致） */
export async function ThemeListHandler(env: Env): Promise<Response> {
  try {
    const themes = await listThemes(env);
    return new Response(JSON.stringify({ themes }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "无法获取主题列表" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** 获取所有可用主题名（顺序与 manifest 一致，稳定不变） */
export async function listThemes(_env: Env): Promise<string[]> {
  return manifest.themes;
}

/** 供 svg.ts 使用的清单类型（含每张数字图的宽高） */
export interface ThemeFileInfo {
  w: number;
  h: number;
}

export interface ThemeInfo {
  /** 该主题数字图扩展名：png 或 gif（与原版 0.gif 存在则用 gif 的逻辑一致） */
  ext: "png" | "gif";
  /** 数字 0-9 的图片信息（start/end 可选） */
  files: Record<string, ThemeFileInfo>;
}

/** 按主题名取清单信息；主题不存在时返回 null */
export function getThemeInfo(theme: string): ThemeInfo | null {
  const info = (manifest.files as Record<string, ThemeInfo>)[theme];
  return info ?? null;
}
