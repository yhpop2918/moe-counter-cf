// ============================================================
// build-manifest.mjs —— 生成 src/manifest.json（主题清单）
//
// 用途：静态资产平台无法"列目录"，所以需要一个清单告诉 Worker
//       有哪些主题、每张数字图的宽高、扩展名。
//       Worker 运行时用宽高算布局，图片本体再按需从静态资产拉取。
//
// 运行：npm run manifest（在你自己的 public/assets/theme 就位后执行）
//
// 生成逻辑（对应原版 fs.ReadDir + image.DecodeConfig）：
//   1. 扫描 ./public/assets/theme 下的所有子目录 = 主题列表
//   2. 每个主题：0.gif 存在则 ext=gif，否则 ext=png（原版同规则）
//   3. 读取 0-9 以及可选 start/end 的宽高（解析 PNG/GIF 头部，无需依赖库）
//   4. 输出 src/manifest.json
// ============================================================
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public", "assets", "theme");
const outFile = join(fileURLToPath(new URL("..", import.meta.url)), "src", "manifest.json");

/** 解析图片宽高：支持 PNG / GIF，直接读文件头，不引入第三方依赖 */
function readImageSize(filePath) {
  const buf = readFileSync(filePath);
  // PNG：签名 + IHDR 块，宽度在偏移 16、高度在 20（大端序）
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF：GIF87a/GIF89a 之后是逻辑屏幕描述符，宽度在偏移 6、高度在 8（小端序）
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  throw new Error(`不支持的图片格式: ${filePath}（仅支持 png / gif）`);
}

// ---- 1. 扫描主题目录 ----
if (!existsSync(root)) {
  console.error(`找不到主题目录: ${root}\n请先把原项目 public/assets/theme 复制过来。`);
  process.exit(1);
}

const themes = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
if (themes.length === 0) {
  console.error("主题目录为空，请确认 public/assets/theme 下有主题文件夹。");
  process.exit(1);
}

// ---- 2. 逐个主题生成清单 ----
const files = {};
for (const theme of themes) {
  const themeDir = join(root, theme);
  // 扩展名规则与原版一致：0.gif 存在则用 gif
  const ext = existsSync(join(themeDir, "0.gif")) ? "gif" : "png";

  const themeFiles = {};
  // 数字 0-9 必读
  for (let i = 0; i <= 9; i++) {
    const filePath = join(themeDir, `${i}.${ext}`);
    if (!existsSync(filePath)) {
      console.error(`主题 ${theme} 缺少 ${i}.${ext}，无法生成清单。`);
      process.exit(1);
    }
    themeFiles[String(i)] = readImageSize(filePath);
  }
  // start / end 可选（原版：存在才加载）
  for (const name of ["start", "end"]) {
    const filePath = join(themeDir, `${name}.${ext}`);
    if (existsSync(filePath)) {
      themeFiles[name] = readImageSize(filePath);
    }
  }

  files[theme] = { ext, files: themeFiles };
}

// ---- 3. 写出清单 ----
const manifest = { themes, files };
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");
console.log(`已生成 ${outFile}`);
console.log(`主题列表: ${themes.join(", ")}`);
