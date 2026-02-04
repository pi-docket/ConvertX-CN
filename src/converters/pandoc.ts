import { execFile as execFileOriginal } from "node:child_process";
import { ExecFileFn } from "./types";

/**
 * Pandoc 3.8.3 轉換器
 *
 * 📦 版本更新：3.8.3 (2025-12)
 *
 * 🆕 v3.8.3 新增格式：
 *   - 輸入：asciidoc, pptx, xlsx（新增！）
 *   - 輸出：bbcode, bbcode_steam, bbcode_fluxbb, bbcode_phpbb,
 *           bbcode_hubzilla, bbcode_xenforo, vimdoc（新增！）
 *
 * 📝 API 變更說明：
 *   - 新增 --syntax-highlighting 選項（取代廢棄的 --no-highlighting 和 --highlight-style）
 *   - 新增 xml 格式（輸入/輸出）用於 AST 表示
 *   - 移除 compact_definition_lists 擴展
 *   - 新增 table_attributes 擴展（預設啟用）
 */
export const properties = {
  from: {
    text: [
      // v3.8.3 新增輸入格式
      "asciidoc", // 🆕 v3.8.3 新增
      "pptx", // 🆕 v3.8.3 新增
      "xlsx", // 🆕 v3.8.3 新增
      "xml", // 🆕 v3.8 新增（AST 表示）
      // 原有格式
      "textile",
      "tikiwiki",
      "tsv",
      "twiki",
      "typst",
      "vimwiki",
      "biblatex",
      "bibtex",
      "bits",
      "commonmark",
      "commonmark_x",
      "creole",
      "csljson",
      "csv",
      "djot",
      "docbook",
      "docx",
      "dokuwiki",
      "endnotexml",
      "epub",
      "fb2",
      "gfm",
      "haddock",
      "html",
      "ipynb",
      "jats",
      "jira",
      "json",
      "latex",
      "man",
      "markdown",
      "markdown_mmd",
      "markdown_phpextra",
      "markdown_strict",
      "mediawiki",
      "muse",
      "pandoc native",
      "opml",
      "org",
      "ris",
      "rst",
      "rtf",
      "t2t",
    ],
  },
  to: {
    text: [
      // v3.8.3 新增輸出格式 - BBCode 變體
      "bbcode", // 🆕 v3.8.3 基本 BBCode
      "bbcode_steam", // 🆕 v3.8.3 Steam 論壇格式
      "bbcode_fluxbb", // 🆕 v3.8.3 FluxBB 論壇格式
      "bbcode_phpbb", // 🆕 v3.8.3 phpBB 論壇格式
      "bbcode_hubzilla", // 🆕 v3.8.3 Hubzilla 格式
      "bbcode_xenforo", // 🆕 v3.8.3 XenForo 論壇格式
      "vimdoc", // 🆕 v3.8.1 Vim 文件格式
      "xml", // 🆕 v3.8 AST 表示
      // 原有格式
      "tei",
      "texinfo",
      "textile",
      "typst",
      "xwiki",
      "zimwiki",
      "asciidoc",
      "asciidoc_legacy",
      "asciidoctor",
      "beamer",
      "biblatex",
      "bibtex",
      "chunkedhtml",
      "commonmark",
      "commonmark_x",
      "context",
      "csljson",
      "djot",
      "docbook",
      "docbook4",
      "docbook5",
      "docx",
      "dokuwiki",
      "dzslides",
      "epub",
      "epub2",
      "epub3",
      "fb2",
      "gfm",
      "haddock",
      "html",
      "html4",
      "html5",
      "icml",
      "ipynb",
      "jats",
      "jats_archiving",
      "jats_articleauthoring",
      "jats_publishing",
      "jira",
      "json",
      "latex",
      "man",
      "markdown",
      "markdown_mmd",
      "markdown_phpextra",
      "markdown_strict",
      "markua",
      "mediawiki",
      "ms",
      "muse",
      "pandoc native",
      "odt",
      "opendocument",
      "opml",
      "org",
      "pdf",
      "plain",
      "pptx",
      "revealjs",
      "rst",
      "rtf",
      "s5",
      "slideous",
      "slidy",
    ],
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
  // set xelatex here
  const xelatex = ["pdf", "latex"];

  // Build arguments array
  const args: string[] = [];

  if (xelatex.includes(convertTo)) {
    args.push("--pdf-engine=xelatex");
    // CJK 支援：使用 Noto CJK 字體族系（包含中日韓全字符集）
    args.push("-V", "mainfont=Noto Sans CJK TC");
    args.push("-V", "sansfont=Noto Sans CJK TC");
    args.push("-V", "monofont=Noto Sans Mono CJK TC");
    args.push("-V", "CJKmainfont=Noto Sans CJK TC");
    args.push("-V", "CJKsansfont=Noto Sans CJK TC");
    args.push("-V", "CJKmonofont=Noto Sans Mono CJK TC");
    // Emoji 支援：多層 fallback 確保最佳覆蓋
    // 1. Noto Color Emoji - Google 彩色 Emoji（最接近 Apple 風格）
    // 2. Apple Color Emoji - macOS/iOS Emoji（如果可用）
    // 3. Segoe UI Emoji - Windows Emoji
    // 4. GoNotoKurrent - 完整 Unicode 覆蓋（黑白備用）
    args.push(
      "-V",
      "mainfontfallback=Noto Color Emoji:mode=harf;Apple Color Emoji:mode=harf;Segoe UI Emoji:mode=harf;GoNotoKurrent:mode=harf",
    );
  }

  args.push(filePath);
  args.push("-f", fileType);
  args.push("-t", convertTo);
  args.push("-o", targetPath);

  return new Promise((resolve, reject) => {
    execFile("pandoc", args, (error, stdout, stderr) => {
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
