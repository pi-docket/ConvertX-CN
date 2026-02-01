export const normalizeFiletype = (filetype: string): string => {
  const lowercaseFiletype = filetype.toLowerCase();

  switch (lowercaseFiletype) {
    case "jfif":
    case "jpg":
      return "jpeg";
    case "htm":
      return "html";
    case "tex":
      return "latex";
    case "md":
      return "markdown";
    case "unknown":
      return "m4a";
    default:
      return lowercaseFiletype;
  }
};

export const normalizeOutputFiletype = (filetype: string): string => {
  const lowercaseFiletype = filetype.toLowerCase();

  switch (lowercaseFiletype) {
    case "jpeg":
      return "jpg";
    case "latex":
      return "tex";
    case "markdown_phpextra":
    case "markdown_strict":
    case "markdown_mmd":
    case "markdown":
      return "md";
    // MinerU output formats - 保持原始格式名稱（.tar 由 main.ts 自動添加）
    // 因為 MinerU 是 archive-only 引擎，outputMode: "archive"
    case "md-t":
    case "md-i":
      return lowercaseFiletype;
    default: {
      // OCRmyPDF / PDFMathTranslate / BabelDOC 格式處理
      // 格式：<format>-<lang> 或 <format>-ocr
      // pdf-ocr, pdf-en, pdf-zh-tw, md-en, html-ja 等

      // 翻譯/OCR 支援的所有語言（合併所有引擎支援的語言）
      const translationLanguages = [
        "ocr", // OCRmyPDF 自動偵測語言
        "en", // English
        "zh", // Chinese (Simplified)
        "zh-tw", // Chinese (Traditional)
        "ja", // Japanese
        "ko", // Korean
        "de", // German
        "fr", // French
        "es", // Spanish
        "it", // Italian
        "pt", // Portuguese
        "ru", // Russian
        "ar", // Arabic
        "hi", // Hindi
        "vi", // Vietnamese
        "th", // Thai
      ];

      // PDF 翻譯/OCR 輸出 → .pdf
      if (lowercaseFiletype.startsWith("pdf-")) {
        const suffix = lowercaseFiletype.slice(4);
        if (translationLanguages.includes(suffix)) {
          return "pdf";
        }
      }

      // Markdown 翻譯輸出 (BabelDOC) → .md
      if (lowercaseFiletype.startsWith("md-")) {
        const suffix = lowercaseFiletype.slice(3);
        if (translationLanguages.includes(suffix)) {
          return "md";
        }
      }

      // HTML 翻譯輸出 (BabelDOC) → .html
      if (lowercaseFiletype.startsWith("html-")) {
        const suffix = lowercaseFiletype.slice(5);
        if (translationLanguages.includes(suffix)) {
          return "html";
        }
      }

      return lowercaseFiletype;
    }
  }
};
