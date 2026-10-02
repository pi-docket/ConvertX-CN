/** Check the executables actually used by these converters, including custom commands. */
export function getMissingExecutableEngines(
  findExecutable: (command: string) => string | null = Bun.which,
  imageMagickCommand = process.env.IMAGEMAGICK_COMMAND || "magick",
  edition = process.env.CONVERTX_EDITION,
): string[] {
  const requirements: Record<string, string[]> = {
    inkscape: ["inkscape", "xvfb-run"],
    imagemagick: [imageMagickCommand],
  };
  if (edition === "lite") {
    Object.assign(requirements, {
      assimp: ["assimp"],
      calibre: ["ebook-convert", "xvfb-run"],
      deark: ["deark"],
      dvisvgm: ["dvisvgm"],
      xelatex: ["xelatex"],
      vips: ["vips"],
      mineru: ["mineru"],
      pdfmathtranslate: ["pdf2zh_next"],
      ocrmypdf: ["ocrmypdf"],
      resvg: ["resvg"],
      ffmpeg: ["ffmpeg"],
      graphicsmagick: ["gm"],
      libreoffice: ["soffice"],
      pandoc: ["pandoc"],
      dasel: ["dasel"],
      libheif: ["heif-convert"],
      libjxl: ["cjxl", "djxl"],
      potrace: ["potrace"],
      vtracer: ["vtracer"],
      msgconvert: ["msgconvert"],
      markitdown: ["markitdown"],
      "pdf packager": ["pdftoppm", "img2pdf", "gs", "qpdf", "python3", "tar"],
      pdftops: ["pdftops"],
    });
  }
  return Object.entries(requirements)
    .filter(([, commands]) => commands.some((command) => !findExecutable(command)))
    .map(([engine]) => engine);
}
