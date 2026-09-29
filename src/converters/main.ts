import { normalizeFiletype, normalizeOutputFiletype } from "../helpers/normalizeFiletype";
import { isMultiOutputTask, autoPackageMultiOutput } from "../transfer";
import { convert as convertassimp, properties as propertiesassimp } from "./assimp";
import { convert as convertCalibre, properties as propertiesCalibre } from "./calibre";
import { convert as convertDasel, properties as propertiesDasel } from "./dasel";
import { convert as convertDeark, properties as propertiesDeark } from "./deark";
import { convert as convertDvisvgm, properties as propertiesDvisvgm } from "./dvisvgm";
import { convert as convertFFmpeg, properties as propertiesFFmpeg } from "./ffmpeg";
import {
  convert as convertGraphicsmagick,
  properties as propertiesGraphicsmagick,
} from "./graphicsmagick";
import { convert as convertImagemagick, properties as propertiesImagemagick } from "./imagemagick";
import { convert as convertInkscape, properties as propertiesInkscape } from "./inkscape";
import { convert as convertLibheif, properties as propertiesLibheif } from "./libheif";
import { convert as convertLibjxl, properties as propertiesLibjxl } from "./libjxl";
import { convert as convertLibreOffice, properties as propertiesLibreOffice } from "./libreoffice";
import { convert as convertMsgconvert, properties as propertiesMsgconvert } from "./msgconvert";
import { convert as convertPandoc, properties as propertiesPandoc } from "./pandoc";
import { convert as convertPdftops, properties as propertiesPdftops } from "./pdftops";
import { convert as convertPotrace, properties as propertiesPotrace } from "./potrace";
import { convert as convertresvg, properties as propertiesresvg, isResvgAvailable } from "./resvg";
import { convert as convertImage, properties as propertiesImage } from "./vips";
import { convert as convertVtracer, properties as propertiesVtracer } from "./vtracer";
import { convert as convertVcf, properties as propertiesVcf } from "./vcf";
import { convert as convertxelatex, properties as propertiesxelatex } from "./xelatex";
import { convert as convertMarkitdown, properties as propertiesMarkitdown } from "./markitdown";
import { convert as convertMineru, properties as propertiesMineru } from "./mineru";
import {
  convert as convertPDFMathTranslate,
  properties as propertiesPDFMathTranslate,
} from "./pdfmathtranslate";
import { convert as convertOcrMyPdf, properties as propertiesOcrMyPdf } from "./ocrmypdf";
import {
  convert as convertPdfPackager,
  properties as propertiesPdfPackager,
  getOutputFileName as getPdfPackagerOutputFileName,
} from "./pdfpackager";
import { basename, dirname, parse } from "node:path";

// This should probably be reconstructed so that the functions are not imported instead the functions hook into this to make the converters more modular

// 🌍 跨架構引擎可用性檢查
const disabledEngines: string[] = [];

// 檢查 resvg 可用性（ARM64 可能禁用）
if (!isResvgAvailable()) {
  console.warn("⚠️ [Engine] resvg is disabled on this platform (ARM64 build failed)");
  disabledEngines.push("resvg");
}

// 導出禁用引擎列表供 UI 使用
export function getDisabledEngines(): string[] {
  return [...disabledEngines];
}

const properties: Record<
  string,
  {
    properties: {
      from: Record<string, string[]>;
      to: Record<string, string[]>;
      outputMode?: "archive";
      options?: Record<
        string,
        Record<
          string,
          {
            description: string;
            type: string;
            default: number | string | boolean;
          }
        >
      >;
    };
    converter: (
      filePath: string,
      fileType: string,
      convertTo: string,
      targetPath: string,

      options?: unknown,
    ) => unknown;
  }
> = {
  // Prioritize Inkscape for EMF files as it handles them better than ImageMagick
  inkscape: {
    properties: propertiesInkscape,
    converter: convertInkscape,
  },
  libjxl: {
    properties: propertiesLibjxl,
    converter: convertLibjxl,
  },
  resvg: {
    properties: propertiesresvg,
    converter: convertresvg,
  },
  vips: {
    properties: propertiesImage,
    converter: convertImage,
  },
  libheif: {
    properties: propertiesLibheif,
    converter: convertLibheif,
  },
  xelatex: {
    properties: propertiesxelatex,
    converter: convertxelatex,
  },
  calibre: {
    properties: propertiesCalibre,
    converter: convertCalibre,
  },
  dasel: {
    properties: propertiesDasel,
    converter: convertDasel,
  },
  libreoffice: {
    properties: propertiesLibreOffice,
    converter: convertLibreOffice,
  },
  pandoc: {
    properties: propertiesPandoc,
    converter: convertPandoc,
  },
  msgconvert: {
    properties: propertiesMsgconvert,
    converter: convertMsgconvert,
  },
  dvisvgm: {
    properties: propertiesDvisvgm,
    converter: convertDvisvgm,
  },
  imagemagick: {
    properties: propertiesImagemagick,
    converter: convertImagemagick,
  },
  graphicsmagick: {
    properties: propertiesGraphicsmagick,
    converter: convertGraphicsmagick,
  },
  assimp: {
    properties: propertiesassimp,
    converter: convertassimp,
  },
  ffmpeg: {
    properties: propertiesFFmpeg,
    converter: convertFFmpeg,
  },
  potrace: {
    properties: propertiesPotrace,
    converter: convertPotrace,
  },
  vtracer: {
    properties: propertiesVtracer,
    converter: convertVtracer,
  },
  vcf: {
    properties: propertiesVcf,
    converter: convertVcf,
  },
  markitDown: {
    properties: propertiesMarkitdown,
    converter: convertMarkitdown,
  },
  pdftops: {
    properties: propertiesPdftops,
    converter: convertPdftops,
  },
  MinerU: {
    properties: propertiesMineru,
    converter: convertMineru,
  },
  PDFMathTranslate: {
    properties: propertiesPDFMathTranslate,
    converter: convertPDFMathTranslate,
  },
  OCRmyPDF: {
    properties: propertiesOcrMyPdf,
    converter: convertOcrMyPdf,
  },
  "PDF Packager": {
    properties: propertiesPdfPackager,
    converter: convertPdfPackager,
  },
  deark: {
    properties: propertiesDeark,
    converter: convertDeark,
  },
};

export class ConversionSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionSelectionError";
  }
}

function matchingTarget(
  converterName: string,
  fileTypeOriginal: string,
  requestedTarget: string,
): string | null {
  const converter = properties[converterName];
  if (!converter || disabledEngines.includes(converterName)) return null;

  const fileType = normalizeFiletype(fileTypeOriginal);
  const target = normalizeFiletype(requestedTarget);
  for (const [group, fromList] of Object.entries(converter.properties.from)) {
    const supportsInput = fromList.some((entry) => normalizeFiletype(entry) === fileType);
    if (!supportsInput) continue;
    const canonicalTarget = converter.properties.to[group]?.find(
      (entry) => normalizeFiletype(entry) === target,
    );
    if (canonicalTarget) return canonicalTarget;
  }
  return null;
}

export function validateConversionSelection(
  fileNames: readonly string[],
  requestedTarget: string,
  converterName: string,
): string {
  if (fileNames.length === 0) {
    throw new ConversionSelectionError("At least one input file is required");
  }
  if (!properties[converterName] || disabledEngines.includes(converterName)) {
    throw new ConversionSelectionError(`Unknown or disabled converter: ${converterName}`);
  }

  let canonicalTarget: string | null = null;
  for (const fileName of fileNames) {
    if (!fileName || basename(fileName) !== fileName) {
      throw new ConversionSelectionError("Input file name must be a single path component");
    }
    const fileType = fileName.split(".").pop() ?? "";
    const match = matchingTarget(converterName, fileType, requestedTarget);
    if (!match) {
      throw new ConversionSelectionError(
        `Converter ${converterName} does not support ${normalizeFiletype(fileType)} to ${normalizeFiletype(requestedTarget)}`,
      );
    }
    canonicalTarget ??= match;
    if (normalizeFiletype(canonicalTarget) !== normalizeFiletype(match)) {
      throw new ConversionSelectionError("All files in a job must use the same conversion target");
    }
  }
  return canonicalTarget as string;
}

export function getConversionOutputFileName(
  fileName: string,
  convertTo: string,
  converterName: string,
): string {
  const converterProps = properties[converterName]?.properties;
  if (!converterProps) throw new Error(`Unknown converter: ${converterName}`);
  const canonicalTarget = validateConversionSelection([fileName], convertTo, converterName);
  if (converterName === "PDF Packager") {
    const parsed = parse(fileName);
    const sourceName = parsed.name || "converted";
    return `${sourceName}-${getPdfPackagerOutputFileName(canonicalTarget)}`;
  }
  const originalExtension = fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "";
  const outputExtension = normalizeOutputFiletype(canonicalTarget);
  let outputName =
    originalExtension === ""
      ? `${fileName}.${outputExtension}`
      : fileName.replace(
          new RegExp(`${originalExtension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          outputExtension,
        );
  if (converterProps.outputMode === "archive") outputName += ".tar";
  return outputName;
}
export async function mainConverter(
  inputFilePath: string,
  fileTypeOriginal: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  converterName?: string,
) {
  const fileType = normalizeFiletype(fileTypeOriginal);

  let converterFunc: (typeof properties)["libjxl"]["converter"] | undefined;

  if (converterName) {
    validateConversionSelection([`input.${fileTypeOriginal}`], convertTo, converterName);
    converterFunc = properties[converterName]?.converter;
  } else {
    // Iterate over each converter in properties
    converterSearch: for (const candidateName in properties) {
      const converterObj = properties[candidateName];

      if (!converterObj) {
        continue;
      }

      for (const key in converterObj.properties.from) {
        if (
          converterObj?.properties?.from[key]?.some(
            (entry) => normalizeFiletype(entry) === fileType,
          ) &&
          converterObj?.properties?.to[key]?.some(
            (entry) => normalizeFiletype(entry) === normalizeFiletype(convertTo),
          )
        ) {
          converterFunc = converterObj.converter;
          converterName = candidateName;
          break converterSearch;
        }
      }
    }
  }

  if (!converterFunc) {
    console.log(`No available converter supports converting from ${fileType} to ${convertTo}.`);
    throw new Error(`No available converter supports converting from ${fileType} to ${convertTo}`);
  }

  try {
    const result = await converterFunc(inputFilePath, fileType, convertTo, targetPath, options);

    console.log(
      `Converted ${inputFilePath} from ${fileType} to ${convertTo} successfully using ${converterName}.`,
      result,
    );

    // ========== ConvertX-CN TRA 封裝治理 ==========
    // 檢查是否為多輸出任務，如果是則自動封裝為 .tra
    const outputDir = dirname(targetPath);
    const { isMulti, reason, fileCount } = isMultiOutputTask(outputDir, convertTo);

    if (isMulti && converterName) {
      console.log(`[TRA Governance] Multi-output detected: ${reason} (${fileCount} files)`);

      try {
        const traResult = await autoPackageMultiOutput(outputDir, {
          jobId: `${Date.now()}`,
          engine: converterName,
          sourceFormat: fileType,
          outputFormat: convertTo,
        });

        if (traResult) {
          console.log(`[TRA Governance] Packaged as: ${traResult.packagePath}`);
          return `Done (TRA: ${traResult.manifest.artifact_count} files)`;
        }
      } catch (traError) {
        console.warn("[TRA Governance] Failed to package:", traError);
        // 繼續返回原始結果，不中斷流程
      }
    }

    if (typeof result === "string") {
      return result;
    }

    return "Done";
  } catch (error) {
    console.error(
      `Failed to convert ${inputFilePath} from ${fileType} to ${convertTo} using ${converterName}.`,
      error,
    );
    throw error;
  }
}

const possibleTargets: Record<string, Record<string, string[]>> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;
  if (!converterProperties) continue;

  for (const key in converterProperties.from) {
    const fromList = converterProperties.from[key];
    const toList = converterProperties.to[key];

    if (!fromList || !toList) continue;

    for (const ext of fromList) {
      const normalizedExtension = normalizeFiletype(ext);
      if (!possibleTargets[normalizedExtension]) possibleTargets[normalizedExtension] = {};

      possibleTargets[normalizedExtension][converterName] = toList;
    }
  }
}

export const getPossibleTargets = (from: string): Record<string, string[]> => {
  const fromClean = normalizeFiletype(from);

  return possibleTargets[fromClean] || {};
};

const possibleInputs: string[] = [];
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    for (const extension of converterProperties.from[key] ?? []) {
      if (!possibleInputs.includes(extension)) {
        possibleInputs.push(extension);
      }
    }
  }
}
possibleInputs.sort();

const allTargets: Record<string, string[]> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.to) {
    if (allTargets[converterName]) {
      allTargets[converterName].push(...(converterProperties.to[key] || []));
    } else {
      allTargets[converterName] = converterProperties.to[key] || [];
    }
  }
}

export const getAllTargets = () => {
  return allTargets;
};

const allInputs: Record<string, string[]> = {};
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    if (allInputs[converterName]) {
      allInputs[converterName].push(...(converterProperties.from[key] || []));
    } else {
      allInputs[converterName] = converterProperties.from[key] || [];
    }
  }
}

export const getAllInputs = (converter: string) => {
  return allInputs[converter] || [];
};
