import { execFile as execFileOriginal } from "node:child_process";
import { ExecFileFn } from "./types";

/**
 * libvips 8.18.0 轉換器
 *
 * 📦 版本更新：8.18.0 (2025-12)
 *
 * 🆕 v8.18.0 新增功能：
 *   - UltraHDR 影像載入/儲存（vips_uhdrload, vips_uhdrsave）
 *   - RAW 相機檔案載入（dcrawload）使用 libraw
 *   - Oklab/Oklch 色彩空間支援
 *   - jxlsave "bitdepth" 參數
 *   - webpsave "exact" 參數
 *   - heifsave "tune" 參數
 *   - pdfload "page_box" 參數
 *   - 更大的 mmap 視窗改善隨機存取效能
 *
 * ⚠️ API 變更：
 *   - 需要 C++14 最低標準
 *   - libjxl 最低版本 0.7.0
 *   - libheif 最低版本 1.7.0
 */

// declare possible conversions
export const properties = {
  from: {
    images: [
      // 🆕 v8.18.0 新增格式
      "uhdr", // 🆕 UltraHDR
      "dcraw", // 🆕 RAW 相機檔案（使用 libraw）
      "cr2", // 🆕 Canon RAW
      "cr3", // 🆕 Canon RAW 3
      "nef", // 🆕 Nikon RAW
      "arw", // 🆕 Sony RAW
      "dng", // 🆕 Digital Negative
      // 原有格式
      "avif",
      "bif",
      "csv",
      "exr",
      "fits",
      "gif",
      "hdr.gz",
      "hdr",
      "heic",
      "heif",
      "img.gz",
      "img",
      "j2c",
      "j2k",
      "jp2",
      "jpeg",
      "jpx",
      "jxl",
      "mat",
      "mrxs",
      "ndpi",
      "nia.gz",
      "nia",
      "nii.gz",
      "nii",
      "pdf",
      "pfm",
      "pgm",
      "pic",
      "png",
      "ppm",
      "raw",
      "scn",
      "svg",
      "svs",
      "svslide",
      "szi",
      "tif",
      "tiff",
      "v",
      "vips",
      "vms",
      "vmu",
      "webp",
      "zip",
    ],
  },
  to: {
    images: [
      // 🆕 v8.18.0 新增格式
      "uhdr", // 🆕 UltraHDR 輸出
      // 原有格式
      "avif",
      "dzi",
      "fits",
      "gif",
      "hdr.gz",
      "heic",
      "heif",
      "img.gz",
      "j2c",
      "j2k",
      "jp2",
      "jpeg",
      "jpx",
      "jxl",
      "mat",
      "nia.gz",
      "nia",
      "nii.gz",
      "nii",
      "png",
      "tiff",
      "vips",
      "webp",
    ],
  },
  options: {
    svg: {
      scale: {
        description: "Scale the image up or down",
        type: "number",
        default: 1,
      },
    },
    // 🆕 v8.18.0 新增選項
    jxl: {
      bitdepth: {
        description: "Bit depth for JXL output (8, 16, or 32)",
        type: "number",
        default: 8,
      },
    },
    webp: {
      exact: {
        description: "Preserve exact colors without lossy encoding",
        type: "boolean",
        default: false,
      },
    },
    heif: {
      tune: {
        description: "Encoder tuning (psnr, ssim, grain, fastdecode)",
        type: "string",
        default: "ssim",
      },
    },
    pdf: {
      page_box: {
        description: "PDF page box to use (media, crop, bleed, trim, art)",
        type: "string",
        default: "crop",
      },
    },
  },
};

export function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
): Promise<string> {
  // if (fileType === "svg") {
  //   const scale = options.scale || 1;
  //   const metadata = await sharp(filePath).metadata();

  //   if (!metadata || !metadata.width || !metadata.height) {
  //     throw new Error("Could not get metadata from image");
  //   }

  //   const newWidth = Math.round(metadata.width * scale);
  //   const newHeight = Math.round(metadata.height * scale);

  //   return await sharp(filePath)
  //     .resize(newWidth, newHeight)
  //     .toFormat(convertTo)
  //     .toFile(targetPath);
  // }
  let action = "copy";
  if (fileType === "pdf") {
    action = "pdfload";
  }

  return new Promise((resolve, reject) => {
    execFile("vips", [action, filePath, targetPath], (error, stdout, stderr) => {
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
