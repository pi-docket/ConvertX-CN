import { execFile as execFileOriginal } from "node:child_process";
import { existsSync } from "node:fs";
import { ExecFileFn } from "./types";

/**
 * resvg 0.46.0 轉換器
 *
 * 📦 版本更新：0.46.0 (2026-01)
 *
 * 🆕 v0.46.0 新增功能：
 *   - 改進的 SVG 渲染品質
 *   - 更好的文字處理
 *   - 效能優化
 *
 * ⚠️ CLI 選項參考：
 *   --width <px>        輸出寬度
 *   --height <px>       輸出高度
 *   --zoom <factor>     縮放倍率
 *   --dpi <dpi>         DPI 設定
 *   --background <color> 背景顏色
 *   --font-family <name> 預設字型
 *   --font-size <size>   預設字型大小
 *   --skip-system-fonts  不載入系統字型
 *   --use-fonts-dir <path> 額外字型目錄
 *
 * 🌍 跨架構支援：
 *   - AMD64: 官方預編譯 binary
 *   - ARM64: 從源碼編譯（若失敗則功能禁用）
 *
 * 📝 檢測禁用狀態：
 *   - 環境變數 RESVG_DISABLED=1
 *   - 檔案 /opt/convertx/disabled-engines/resvg
 */

/**
 * 檢查 resvg 是否可用
 */
export function isResvgAvailable(): boolean {
  // 檢查環境變數
  if (process.env.RESVG_DISABLED === "1") {
    return false;
  }
  // 檢查禁用標記檔案
  if (existsSync("/opt/convertx/disabled-engines/resvg")) {
    return false;
  }
  return true;
}

export const properties = {
  from: {
    images: ["svg"],
  },
  to: {
    images: ["png"],
  },
};

export function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal, // to make it mockable
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("resvg", [filePath, targetPath], (error, stdout, stderr) => {
      if (error) {
        reject(`error: ${error}`);
      }

      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }

      resolve("Done");
    });
  });
}
