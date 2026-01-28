import Elysia from "elysia";
import { getDisabledEngines } from "../converters/main";
import { userService } from "./user";
import os from "node:os";

/**
 * 引擎狀態 API
 *
 * 提供引擎可用性資訊，用於：
 * - UI 顯示禁用引擎
 * - 外部系統整合
 * - 健康檢查
 */
export const enginesApi = new Elysia()
  .use(userService)
  // 取得禁用引擎列表
  .get(
    "/api/engines/disabled",
    () => {
      const disabled = getDisabledEngines();
      const arch = os.arch();
      const platform = os.platform();

      return {
        disabled,
        count: disabled.length,
        platform: `${platform}/${arch}`,
        message:
          disabled.length > 0
            ? `${disabled.length} engine(s) disabled on this platform`
            : "All engines available",
      };
    },
    {
      auth: false,
    },
  )
  // 檢查特定引擎是否可用
  .get(
    "/api/engines/:name/available",
    ({ params: { name } }) => {
      const disabled = getDisabledEngines();
      const isDisabled = disabled.includes(name.toLowerCase());

      return {
        engine: name,
        available: !isDisabled,
        message: isDisabled ? `${name} is disabled on this platform` : `${name} is available`,
      };
    },
    {
      auth: false,
    },
  );
