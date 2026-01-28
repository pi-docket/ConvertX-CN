import Elysia from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { getAllInputs, getAllTargets, getDisabledEngines } from "../converters/main";
import { ALLOW_UNAUTHENTICATED, WEBROOT } from "../helpers/env";
import { userService } from "./user";

export const listConverters = new Elysia().use(userService).get(
  "/converters",
  async () => {
    const disabledEngines = getDisabledEngines();
    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX-CN | Converters">
        <>
          <Header webroot={WEBROOT} allowUnauthenticated={ALLOW_UNAUTHENTICATED} loggedIn />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <h1 class="mb-4 text-xl">Converters</h1>

              {/* 顯示禁用引擎警告 */}
              {disabledEngines.length > 0 && (
                <div class="mb-4 rounded-lg border border-yellow-600 bg-yellow-900/30 p-4">
                  <h3 class="mb-2 font-semibold text-yellow-400">⚠️ 部分引擎在此平台不可用</h3>
                  <p class="text-sm text-yellow-200">
                    以下引擎因架構限制而被禁用：
                    <span class="ml-2 font-mono">{disabledEngines.join(", ")}</span>
                  </p>
                  <p class="mt-1 text-xs text-yellow-300">
                    這通常發生在 ARM64 平台上。請參閱文檔了解替代方案。
                  </p>
                </div>
              )}

              <table
                class={`
                  w-full table-auto rounded bg-neutral-900 text-left
                  [&_td]:p-4
                  [&_tr]:rounded-sm [&_tr]:border-b [&_tr]:border-neutral-800
                  [&_ul]:list-inside [&_ul]:list-disc
                `}
              >
                <thead>
                  <tr>
                    <th class="mx-4 my-2">Converter</th>
                    <th class="mx-4 my-2">From (Count)</th>
                    <th class="mx-4 my-2">To (Count)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getAllTargets()).map(([converter, targets]) => {
                    const inputs = getAllInputs(converter);
                    const isDisabled = disabledEngines.includes(converter.toLowerCase());
                    return (
                      <tr class={isDisabled ? "opacity-50" : ""}>
                        <td safe>
                          {converter}
                          {isDisabled && (
                            <span class="ml-2 rounded bg-yellow-600 px-2 py-0.5 text-xs text-white">
                              禁用
                            </span>
                          )}
                        </td>
                        <td>
                          Count: {inputs.length}
                          <ul>
                            {inputs.map((input) => (
                              <li safe>{input}</li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          Count: {targets.length}
                          <ul>
                            {targets.map((target) => (
                              <li safe>{target}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  },
  {
    auth: true,
  },
);
