import { execFile as execFileOriginal } from "node:child_process";
import { existsSync as existsSyncOriginal } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ExecFileFn } from "./types";

// ==============================================================================
// LibreOffice 25.8.4 轉換器
// ==============================================================================
//
// 📦 版本更新：25.8.4 (2026-01)
//
// 🆕 v25.8 新增功能：
//   - 改進的 PDF 匯出品質
//   - 更好的 DOCX/XLSX/PPTX 相容性
//   - 新試算表函數
//   - 更快的檔案載入速度
//   - 改進的 CJK 字型處理
//
// ⚠️ 從 v7.x/v24.x 升級注意事項：
//   - 版本號碼格式改變（從 7.x → 24.x → 25.x）
//   - 部分 macro 行為可能有變化
//   - 建議測試現有轉換流程
//
// 🔑 關鍵技術說明：
//
// LibreOffice 有兩種轉換模式：
//
// 1. Export Pipeline（輸出轉換）
//    - 用於：DOCX → PDF, ODT → PDF 等
//    - 原生格式 → 導出格式
//    - 使用 --convert-to 參數
//
// 2. Import Pipeline（輸入轉換）
//    - 用於：PDF → DOCX, PDF → ODT 等
//    - 非原生格式 → 原生格式
//    - 必須使用 --infilter 參數指定 import filter
//
// ⚠️ 常見錯誤：
//    PDF → DOCX 若不指定 --infilter=writer_pdf_import
//    會得到 "no export filter" 錯誤
//
// ==============================================================================

// 用於測試的依賴注入類型
export type ExistsSyncFn = (path: string) => boolean;

export const properties = {
  from: {
    text: [
      "602",
      "abw",
      "cwk",
      "doc",
      "docm",
      "docx",
      "dot",
      "dotx",
      "dotm",
      "epub",
      "fb2",
      "fodt",
      "htm",
      "html",
      "hwp",
      "mcw",
      "mw",
      "mwd",
      "lwp",
      "lrf",
      "odt",
      "ott",
      "pages",
      "pdf",
      "psw",
      "rtf",
      "sdw",
      "stw",
      "sxw",
      "tab",
      "txt",
      "wn",
      "wpd",
      "wps",
      "wpt",
      "wri",
      "xhtml",
      "xml",
      "zabw",
    ],
    calc: [
      "csv",
      "dbf",
      "dif",
      "fods",
      "ods",
      "ots",
      "sxc",
      "stc",
      "slk",
      "tab",
      "tsv",
      "xls",
      "xlsb",
      "xlsm",
      "xlsx",
      "xlt",
      "xltm",
      "xltx",
    ],
  },
  to: {
    text: [
      "doc",
      "docm",
      "docx",
      "dot",
      "dotx",
      "dotm",
      "epub",
      "fodt",
      "htm",
      "html",
      "odt",
      "ott",
      "pdf",
      "rtf",
      "tab",
      "txt",
      "wps",
      "wpt",
      "xhtml",
      "xml",
    ],
    calc: ["csv", "fods", "html", "ods", "pdf", "tsv", "xls", "xlsx", "ots", "xlsm", "xlt", "xltm"],
  },
};

type FileCategories = "text" | "calc";

const inputFilters: Record<FileCategories, Record<string, string | null>> = {
  text: {
    "602": "T602Document",
    abw: "AbiWord",
    csv: "Text",
    doc: "MS Word 97",
    docm: "MS Word 2007 XML VBA",
    docx: "MS Word 2007 XML",
    dot: "MS Word 97 Vorlage",
    dotx: "MS Word 2007 XML Template",
    dotm: "MS Word 2007 XML Template",
    epub: "EPUB",
    fb2: "Fictionbook 2",
    fodt: "OpenDocument Text Flat XML",
    htm: "HTML (StarWriter)",
    html: "HTML (StarWriter)",
    hwp: "writer_MIZI_Hwp_97",
    mcw: "MacWrite",
    mw: "MacWrite",
    mwd: "Mariner_Write",
    lwp: "LotusWordPro",
    lrf: "BroadBand eBook",
    odt: "writer8",
    ott: "writer8_template",
    pages: "Apple Pages",
    pdf: "writer_pdf_Export", // PDF 作為輸出格式
    psw: "PocketWord File",
    rtf: "Rich Text Format",
    sdw: "StarOffice_Writer",
    stw: "writer_StarOffice_XML_Writer_Template",
    sxw: "StarOffice XML (Writer)",
    tab: "Text",
    tsv: "Text",
    txt: "Text",
    wn: "WriteNow",
    wpd: "WordPerfect",
    // .wps is Microsoft Works, not MS Word 97/.doc - forcing the "MS Word 97"
    // filter makes soffice reject a genuine Works document with "source file
    // could not be loaded", even though it converts the same file fine with
    // no --infilter at all (LibreOffice auto-detects it correctly).

    // Auto-detect Works on import. The separate output map keeps the existing
    // bare --convert-to wps behavior, since Works has no native export filter.
    wps: null,
    wpt: "MS Word 97 Vorlage",
    wri: "MS_Write",
    xhtml: "HTML (StarWriter)",
    xml: "OpenDocument Text Flat XML",
    zabw: "AbiWord",
  },
  calc: {
    csv: "Text - txt - csv (StarCalc):44,34,76,1",
    dbf: "dBase",
    dif: "DIF",
    fods: "OpenDocument Spreadsheet Flat XML",
    html: "HTML (StarCalc)",
    ods: "calc8",
    ots: "calc8_template",
    pdf: "calc_pdf_Export",
    sxc: "StarOffice XML (Calc)",
    stc: "calc_StarOffice_XML_Calc_Template",
    slk: "SYLK",
    tab: "Text - txt - csv (StarCalc):9,34,76,1",
    tsv: "Text - txt - csv (StarCalc):9,34,76,1",
    xls: "MS Excel 97",
    xlsx: "Calc MS Excel 2007 XML",
    xlsb: "Calc MS Excel 2007 Binary",
    xlsm: "Calc MS Excel 2007 VBA XML",
    xlt: "MS Excel 97 Vorlage",
    xltm: "Calc MS Excel 2007 XML Template",
    xltx: "Calc MS Excel 2007 XML Template",
  },
};

// Import-only formats must not become export filters or advertised output paths.
const outputFilters: Record<FileCategories, Record<string, string | null>> = {
  text: {
    doc: "MS Word 97",
    docm: "MS Word 2007 XML VBA",
    docx: "MS Word 2007 XML",
    dot: "MS Word 97 Vorlage",
    dotx: "MS Word 2007 XML Template",
    dotm: "MS Word 2007 XML Template",
    epub: "EPUB",
    fodt: "OpenDocument Text Flat XML",
    htm: "HTML (StarWriter)",
    html: "HTML (StarWriter)",
    odt: "writer8",
    ott: "writer8_template",
    pdf: "writer_pdf_Export",
    rtf: "Rich Text Format",
    tab: "Text",
    txt: "Text",
    wps: null,
    wpt: "MS Word 97 Vorlage",
    xhtml: "HTML (StarWriter)",
    xml: "OpenDocument Text Flat XML",
  },
  calc: {
    csv: "Text - txt - csv (StarCalc):44,34,76,1",
    fods: "OpenDocument Spreadsheet Flat XML",
    html: "HTML (StarCalc)",
    ods: "calc8",
    ots: "calc8_template",
    pdf: "calc_pdf_Export",
    tsv: "Text - txt - csv (StarCalc):9,34,76,1",
    xls: "MS Excel 97",
    xlsm: "Calc MS Excel 2007 VBA XML",
    xlsx: "Calc MS Excel 2007 XML",
    xlt: "MS Excel 97 Vorlage",
    xltm: "Calc MS Excel 2007 XML Template",
  },
};

// ==============================================================================
// PDF Import Filter（PDF 作為輸入格式時使用）
// ==============================================================================
const PDF_IMPORT_FILTER = "writer_pdf_import";

// 需要使用 PDF import pipeline 的情況
function needsPdfImportPipeline(inputExt: string, outputExt: string): boolean {
  return inputExt === "pdf" && ["docx", "doc", "odt", "rtf", "txt", "html"].includes(outputExt);
}

const getFilters = (fileType: string, converto: string) => {
  if (properties.from.text.includes(fileType) && converto in outputFilters.text) {
    return [inputFilters.text[fileType], outputFilters.text[converto]];
  } else if (properties.from.calc.includes(fileType) && converto in outputFilters.calc) {
    return [inputFilters.calc[fileType], outputFilters.calc[converto]];
  }
  return [null, null];
};

export function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
  existsSync: ExistsSyncFn = existsSyncOriginal,
): Promise<string> {
  const outputDir = dirname(targetPath).replace("./", "") || ".";
  const inputFileName = basename(filePath);
  const inputBaseName = inputFileName.replace(/\.[^.]+$/, "");
  const expectedOutputFile = join(outputDir, `${inputBaseName}.${convertTo}`);

  // Build arguments array
  const args: string[] = [];
  args.push("--headless");

  // ==============================================================================
  // 關鍵分流：PDF → 文字格式 vs 其他轉換
  // ==============================================================================
  if (needsPdfImportPipeline(fileType, convertTo)) {
    // PDF → DOCX/ODT 等：必須使用 import pipeline
    console.log(`[LibreOffice] Using PDF import pipeline: ${fileType} → ${convertTo}`);
    args.push(`--infilter=${PDF_IMPORT_FILTER}`);

    // 輸出格式仍需指定 filter
    const outFilter = outputFilters.text[convertTo];
    if (outFilter && convertTo !== "pdf") {
      args.push("--convert-to", `${convertTo}:${outFilter}`);
    } else {
      args.push("--convert-to", convertTo);
    }
  } else {
    // 一般轉換流程（export pipeline）
    const [inFilter, outFilter] = getFilters(fileType, convertTo);

    if (inFilter && fileType !== "pdf") {
      args.push(`--infilter=${inFilter}`);
    }

    if (outFilter) {
      args.push("--convert-to", `${convertTo}:${outFilter}`);
    } else {
      args.push("--convert-to", convertTo);
    }
  }

  args.push("--outdir", outputDir, filePath);

  console.log(`[LibreOffice] Command: soffice ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    execFile("soffice", args, (error, stdout, stderr) => {
      // ==============================================================================
      // 錯誤處理與輸出檔案驗證
      // ==============================================================================

      if (stdout) {
        console.log(`[LibreOffice] stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`[LibreOffice] stderr: ${stderr}`);
      }

      // 檢查 LibreOffice 執行錯誤
      if (error) {
        const errorMsg = getLibreOfficeErrorMessage(error, stderr);
        console.error(`[LibreOffice] Error: ${errorMsg}`);
        reject(errorMsg);
        return;
      }

      // ==============================================================================
      // 關鍵防呆：檢查輸出檔案是否實際存在
      // ==============================================================================
      if (!existsSync(expectedOutputFile)) {
        const errorMsg = `LibreOffice 轉換失敗：輸出檔案不存在 (${expectedOutputFile})。可能原因：1) 輸入檔案損壞或加密 2) 缺少必要字型 3) 格式不支援`;
        console.error(`[LibreOffice] ${errorMsg}`);
        reject(errorMsg);
        return;
      }

      console.log(`[LibreOffice] Successfully created: ${expectedOutputFile}`);
      resolve("Done");
    });
  });
}

// ==============================================================================
// 錯誤訊息解析
// ==============================================================================
function getLibreOfficeErrorMessage(
  error: Error & { code?: number | string },
  stderr: string,
): string {
  const stderrLower = stderr.toLowerCase();

  // 常見錯誤類型判斷
  if (stderrLower.includes("no export filter")) {
    return "LibreOffice 錯誤：找不到 export filter。可能是格式不支援或需要使用不同的轉換路徑。";
  }

  if (stderrLower.includes("password") || stderrLower.includes("encrypted")) {
    return "LibreOffice 錯誤：檔案已加密或需要密碼。請先解除密碼保護。";
  }

  if (stderrLower.includes("corrupt") || stderrLower.includes("damaged")) {
    return "LibreOffice 錯誤：檔案已損壞或格式無效。";
  }

  if (error.code === "ENOENT") {
    return "LibreOffice 錯誤：找不到 soffice 執行檔。請確認 LibreOffice 已正確安裝。";
  }

  // 通用錯誤
  return `LibreOffice 轉換失敗 (exit code: ${error.code || "unknown"}): ${stderr || error.message}`;
}
