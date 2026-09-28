import { afterEach, describe, expect, test } from "bun:test";
import { getApiKey } from "../../src/security/keyProvider";
import { SiliconFlowTranslationProvider } from "../../src/ai/translator";

const originalKey = process.env.SILICONFLOW_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.SILICONFLOW_API_KEY;
  } else {
    process.env.SILICONFLOW_API_KEY = originalKey;
  }
});

describe("SiliconFlow credentials", () => {
  test("fails explicitly without a user supplied key", async () => {
    delete process.env.SILICONFLOW_API_KEY;
    expect(await new SiliconFlowTranslationProvider().isAvailable()).toBe(false);
    await expect(getApiKey()).rejects.toThrow("SILICONFLOW_API_KEY is required");
  });

  test("reads the current key without retaining an old value", async () => {
    process.env.SILICONFLOW_API_KEY = " first-key ";
    expect(await getApiKey()).toBe("first-key");
    process.env.SILICONFLOW_API_KEY = "second-key";
    expect(await getApiKey()).toBe("second-key");
    expect(await new SiliconFlowTranslationProvider().isAvailable()).toBe(true);
  });
});
