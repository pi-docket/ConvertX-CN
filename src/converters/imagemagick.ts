import { execFile as execFileOriginal } from "node:child_process";
import { ExecFileFn } from "./types";

/**
 * ImageMagick 7.1.2-13 轉換器
 *
 * 📦 版本更新：7.1.2-13 (2026-01)
 *
 * 🆕 v7.x 主要功能：
 *   - HEIF/AVIF 格式完整支援
 *   - JXL (JPEG XL) 編解碼改進
 *   - 更好的色彩管理和 ICC 支援
 *   - OpenCL 加速支援
 *   - 新增 HDRI (High Dynamic Range Imaging)
 *
 * ⚠️ 從 v6.x 升級注意事項：
 *   - 命令行工具從 `convert` 改為 `magick`
 *   - 預設使用 HDRI（16-bit quantum）
 *   - 部分選項語法有變化
 *
 * 📝 相容性處理：
 *   - 本專案使用 `magick` 命令（v7 官方建議）
 *   - 環境變數 IMAGEMAGICK_COMMAND 可覆蓋
 *
 * ConvertX-CN ImageMagick 輸出治理
 *
 * 多輸出處理規則：
 * - PDF/多頁 TIFF 轉圖片時，預設輸出多張圖片
 * - 使用 -adjoin（預設）保持單檔輸出
 * - 使用 +adjoin 時會產生多檔輸出，需要 TRA 封裝
 */

// declare possible conversions
export const properties = {
  from: {
    images: [
      "3fr",
      "3g2",
      "3gp",
      "aai",
      "ai",
      "apng",
      "art",
      "arw",
      "avci",
      "avi",
      "avif",
      "avs",
      "bayer",
      "bayera",
      "bgr",
      "bgra",
      "bgro",
      "bmp",
      "bmp2",
      "bmp3",
      "cal",
      "cals",
      "canvas",
      "caption",
      "cin",
      "clip",
      "clipboard",
      "cmyk",
      "cmyka",
      "cr2",
      "cr3",
      "crw",
      "cube",
      "cur",
      "cut",
      "data",
      "dcm",
      "dcr",
      "dcraw",
      "dcx",
      "dds",
      "dfont",
      "dng",
      "dpx",
      "dxt1",
      "dxt5",
      "emf",
      "epdf",
      "epi",
      "eps",
      "epsf",
      "epsi",
      "ept",
      "ept2",
      "ept3",
      "erf",
      "exr",
      "farbfeld",
      "fax",
      "ff",
      "fff",
      "file",
      "fits",
      "fl32",
      "flif",
      "flv",
      "fractal",
      "ftp",
      "fts",
      "ftxt",
      "g3",
      "g4",
      "gif",
      "gif87",
      "gradient",
      "gray",
      "graya",
      "group4",
      "hald",
      "hdr",
      "heic",
      "heif",
      "hrz",
      "http",
      "https",
      "icb",
      "ico",
      "icon",
      "iiq",
      "inline",
      "ipl",
      "j2c",
      "j2k",
      "jng",
      "jnx",
      "jp2",
      "jpc",
      "jpe",
      "jpeg",
      "jpg",
      "jpm",
      "jps",
      "jpt",
      "jxl",
      "k25",
      "kdc",
      "label",
      "m2v",
      "m4v",
      "mac",
      "map",
      "mask",
      "mat",
      "mdc",
      "mef",
      "miff",
      "mkv",
      "mng",
      "mono",
      "mos",
      "mov",
      "mp4",
      "mpc",
      "mpeg",
      "mpg",
      "mpo",
      "mrw",
      "msl",
      "msvg",
      "mtv",
      "mvg",
      "nef",
      "nrw",
      "null",
      "ora",
      "orf",
      "otb",
      "otf",
      "pal",
      "palm",
      "pam",
      "pango",
      "pattern",
      "pbm",
      "pcd",
      "pcds",
      "pcl",
      "pct",
      "pcx",
      "pdb",
      "pdf",
      "pdfa",
      "pef",
      "pes",
      "pfa",
      "pfb",
      "pfm",
      "pgm",
      "pgx",
      "phm",
      "picon",
      "pict",
      "pix",
      "pjpeg",
      "plasma",
      "png",
      "png00",
      "png24",
      "png32",
      "png48",
      "png64",
      "png8",
      "pnm",
      "pocketmod",
      "ppm",
      "ps",
      "psb",
      "psd",
      "ptif",
      "pwp",
      "qoi",
      "radial",
      "raf",
      "ras",
      "raw",
      "rgb",
      "rgb565",
      "rgba",
      "rgbo",
      "rgf",
      "rla",
      "rle",
      "rmf",
      "rsvg",
      "rw2",
      "rwl",
      "scr",
      "screenshot",
      "sct",
      "sfw",
      "sgi",
      "six",
      "sixel",
      "sr2",
      "srf",
      "srw",
      "stegano",
      "sti",
      "strimg",
      "sun",
      "svg",
      "svgz",
      "text",
      "tga",
      "tiff",
      "tiff64",
      "tile",
      "tim",
      "tm2",
      "ttc",
      "ttf",
      "txt",
      "uyvy",
      "vda",
      "vicar",
      "vid",
      "viff",
      "vips",
      "vst",
      "wbmp",
      "webm",
      "webp",
      "wmf",
      "wmv",
      "wpg",
      "x3f",
      "xbm",
      "xc",
      "xcf",
      "xpm",
      "xps",
      "xv",
      "ycbcr",
      "ycbcra",
      "yuv",
    ],
  },
  to: {
    images: [
      "aai",
      "ai",
      "apng",
      "art",
      "ashlar",
      "avif",
      "avs",
      "bayer",
      "bayera",
      "bgr",
      "bgra",
      "bgro",
      "bmp",
      "bmp2",
      "bmp3",
      "brf",
      "cal",
      "cals",
      "cin",
      "cip",
      "clip",
      "clipboard",
      "cmyk",
      "cmyka",
      "cur",
      "data",
      "dcx",
      "dds",
      "dpx",
      "dxt1",
      "dxt5",
      "epdf",
      "epi",
      "eps",
      "eps2",
      "eps3",
      "epsf",
      "epsi",
      "ept",
      "ept2",
      "ept3",
      "exr",
      "farbfeld",
      "fax",
      "ff",
      "fits",
      "fl32",
      "flif",
      "flv",
      "fts",
      "ftxt",
      "g3",
      "g4",
      "gif",
      "gif87",
      "gray",
      "graya",
      "group4",
      "hdr",
      "histogram",
      "hrz",
      "htm",
      "html",
      "icb",
      "ico",
      "icon",
      "info",
      "inline",
      "ipl",
      "isobrl",
      "isobrl6",
      "j2c",
      "j2k",
      "jng",
      "jp2",
      "jpc",
      "jpe",
      "jpeg",
      "jpg",
      "jpm",
      "jps",
      "jpt",
      "json",
      "jxl",
      "m2v",
      "m4v",
      "map",
      "mask",
      "mat",
      "matte",
      "miff",
      "mkv",
      "mng",
      "mono",
      "mov",
      "mp4",
      "mpc",
      "mpeg",
      "mpg",
      "msl",
      "msvg",
      "mtv",
      "mvg",
      "null",
      "otb",
      "pal",
      "palm",
      "pam",
      "pbm",
      "pcd",
      "pcds",
      "pcl",
      "pct",
      "pcx",
      "pdb",
      "pdf",
      "pdfa",
      "pfm",
      "pgm",
      "pgx",
      "phm",
      "picon",
      "pict",
      "pjpeg",
      "png",
      "png00",
      "png24",
      "png32",
      "png48",
      "png64",
      "png8",
      "pnm",
      "pocketmod",
      "ppm",
      "ps",
      "ps2",
      "ps3",
      "psb",
      "psd",
      "ptif",
      "qoi",
      "ras",
      "rgb",
      "rgba",
      "rgbo",
      "rgf",
      "rsvg",
      "sgi",
      "shtml",
      "six",
      "sixel",
      "sparse",
      "strimg",
      "sun",
      "svg",
      "svgz",
      "tga",
      "thumbnail",
      "tiff",
      "tiff64",
      "txt",
      "ubrl",
      "ubrl6",
      "uil",
      "uyvy",
      "vda",
      "vicar",
      "vid",
      "viff",
      "vips",
      "vst",
      "wbmp",
      "webm",
      "webp",
      "wmv",
      "wpg",
      "xbm",
      "xpm",
      "xv",
      "yaml",
      "ycbcr",
      "ycbcra",
      "yuv",
    ],
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
  let outputArgs: string[] = [];
  let inputArgs: string[] = [];

  // ========== ConvertX-CN 輸出治理 ==========

  // 多頁輸入（PDF、多頁 TIFF）的處理
  // 預設使用 -adjoin 保持單檔輸出，避免產生多檔
  const multiPageInputFormats = ["pdf", "tiff", "tif", "gif", "mng", "ico"];
  if (multiPageInputFormats.includes(fileType.toLowerCase())) {
    // 對於單頁輸出格式，只取第一頁
    const singlePageOutputFormats = ["jpg", "jpeg", "png", "bmp", "webp"];
    if (singlePageOutputFormats.includes(convertTo.toLowerCase())) {
      // 只轉換第一頁，避免產生多檔
      inputArgs.push("-[0]".replace("-", filePath.endsWith("]") ? "" : ""));
      console.log("[ImageMagick Governance] Multi-page input detected, extracting first page only");
    }
  }

  // ========== 原有邏輯 ==========

  if (convertTo === "ico") {
    outputArgs = ["-define", "icon:auto-resize=256,128,64,48,32,16", "-background", "none"];

    if (fileType === "svg") {
      // this might be a bit too much, but it works
      inputArgs = ["-background", "none", "-density", "512"];
    }
  }

  // Handle EMF files specifically to avoid LibreOffice delegate issues
  if (fileType === "emf") {
    // Use direct conversion without delegates for EMF files
    inputArgs.push("-define", "emf:delegate=false", "-density", "300");
    outputArgs.push("-background", "white", "-alpha", "remove");
  }

  // 使用 magick（ImageMagick 7.x 官方建議）
  // ImageMagick 6.x 使用 convert，但 7.x 改用 magick
  const imCommand = process.env.IMAGEMAGICK_COMMAND || "magick";

  // 組合輸入路徑（處理多頁輸入）
  let inputPath = filePath;
  if (multiPageInputFormats.includes(fileType.toLowerCase()) && !filePath.includes("[")) {
    // 對於多頁格式，預設只取第一頁
    const singlePageOutputFormats = ["jpg", "jpeg", "png", "bmp", "webp"];
    if (singlePageOutputFormats.includes(convertTo.toLowerCase())) {
      inputPath = `${filePath}[0]`;
    }
  }

  return new Promise((resolve, reject) => {
    execFile(
      imCommand,
      [...inputArgs, inputPath, ...outputArgs, targetPath],
      (error, stdout, stderr) => {
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
      },
    );
  });
}
