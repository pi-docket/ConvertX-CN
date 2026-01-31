import Elysia from "elysia";
import {
  getAllInputs,
  getAllTargets,
  getDisabledEngines,
  getPossibleTargets,
} from "../converters/main";
import { userService } from "./user";
import os from "node:os";

/**
 * 轉換器 API
 *
 * 提供轉換器資訊的 REST API，用於：
 * - 外部系統整合
 * - E2E 測試驗證
 * - API 文件生成
 *
 * 所有端點不需認證，適合公開查詢
 */
export const convertersApi = new Elysia()
  .use(userService)
  // ==============================================================================
  // 取得所有轉換器列表
  // ==============================================================================
  .get(
    "/api/converters",
    () => {
      const allTargets = getAllTargets();
      const disabledEngines = getDisabledEngines();
      const arch = os.arch();
      const platform = os.platform();

      const converters = Object.entries(allTargets).map(([name, outputs]) => {
        const inputs = getAllInputs(name);
        const isDisabled = disabledEngines.includes(name.toLowerCase());

        return {
          name,
          inputs,
          outputs,
          inputCount: inputs.length,
          outputCount: outputs.length,
          available: !isDisabled,
          disabledReason: isDisabled ? `Disabled on ${platform}/${arch}` : null,
        };
      });

      return {
        success: true,
        converters,
        totalConverters: converters.length,
        availableConverters: converters.filter((c) => c.available).length,
        disabledConverters: converters.filter((c) => !c.available).length,
        platform: `${platform}/${arch}`,
        timestamp: new Date().toISOString(),
      };
    },
    {
      auth: false,
    },
  )
  // ==============================================================================
  // 取得特定轉換器詳情
  // ==============================================================================
  .get(
    "/api/converters/:name",
    ({ params: { name } }) => {
      const allTargets = getAllTargets();
      const inputs = getAllInputs(name);
      const outputs = allTargets[name];
      const disabledEngines = getDisabledEngines();

      if (!outputs) {
        return {
          success: false,
          error: "CONVERTER_NOT_FOUND",
          message: `Converter '${name}' not found`,
        };
      }

      const isDisabled = disabledEngines.includes(name.toLowerCase());

      return {
        success: true,
        converter: {
          name,
          inputs,
          outputs,
          inputCount: inputs.length,
          outputCount: outputs.length,
          available: !isDisabled,
          disabledReason: isDisabled ? `Disabled on this platform` : null,
        },
      };
    },
    {
      auth: false,
    },
  )
  // ==============================================================================
  // 查詢特定格式可轉換的目標格式
  // ==============================================================================
  .get(
    "/api/converters/from/:format",
    ({ params: { format } }) => {
      const targets = getPossibleTargets(format.toLowerCase());

      if (Object.keys(targets).length === 0) {
        return {
          success: false,
          error: "FORMAT_NOT_SUPPORTED",
          message: `No converter supports input format '${format}'`,
          format,
        };
      }

      return {
        success: true,
        format: format.toLowerCase(),
        availableConverters: Object.entries(targets).map(([converter, outputs]) => ({
          converter,
          outputs,
          outputCount: outputs.length,
        })),
        totalConversions: Object.values(targets).flat().length,
      };
    },
    {
      auth: false,
    },
  );
