/**
 * SiliconFlow API Client
 *
 * 使用 SiliconFlow API 進行文字翻譯，
 * 基於 tencent/Hunyuan-MT-7B 模型。
 *
 * API 文件：
 * https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions
 */

/**
 * SiliconFlow API 配置
 */
export interface SiliconFlowConfig {
  /** API 端點 */
  baseUrl?: string;
  /** 模型名稱 */
  model?: string;
  /** 溫度參數（0-1，0 表示最確定的輸出） */
  temperature?: number;
  /** 請求超時時間（毫秒） */
  timeout?: number;
  /** 最大重試次數 */
  maxRetries?: number;
}

/**
 * 翻譯請求參數
 */
export interface TranslateRequest {
  /** API Key */
  apiKey: string;
  /** 要翻譯的文字 */
  text: string;
  /** 目標語言（預設：簡體中文） */
  targetLang?: string;
  /** 來源語言（可選） */
  sourceLang?: string;
  /** 配置選項 */
  config?: SiliconFlowConfig;
}

/**
 * Chat Completion Message
 */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Chat Completion Request
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream?: boolean;
}

/**
 * Chat Completion Response
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 預設配置
 */
const DEFAULT_CONFIG: Required<SiliconFlowConfig> = {
  baseUrl: "https://api.siliconflow.cn/v1",
  model: "tencent/Hunyuan-MT-7B",
  temperature: 0,
  timeout: 30000, // 30 秒
  maxRetries: 2,
};

/**
 * 語言代碼映射（用於 prompt）
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  "zh-CN": "Simplified Chinese",
  "zh-Hans": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  "zh-Hant": "Traditional Chinese",
  ja: "Japanese",
  ko: "Korean",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  vi: "Vietnamese",
  th: "Thai",
};

/**
 * 取得語言名稱
 */
function getLanguageName(langCode: string): string {
  return LANGUAGE_NAMES[langCode] || langCode;
}

/**
 * 建立翻譯 prompt
 */
function createTranslationPrompt(
  text: string,
  targetLang: string,
  sourceLang?: string,
): ChatMessage[] {
  const targetLanguageName = getLanguageName(targetLang);
  const sourceHint = sourceLang ? ` from ${getLanguageName(sourceLang)}` : "";

  const systemPrompt = [
    "You are a professional translator.",
    `Translate the user's text${sourceHint} to ${targetLanguageName}.`,
    "Return ONLY the translation wrapped inside <translation> and </translation> tags.",
    "Do not copy source text unchanged unless it is code, URL, or a proper noun.",
    "Do not add any notes, explanations, prefixes, or suffixes.",
  ].join(" ");

  const userPrompt = [
    "Translate the following text.",
    "Keep meaning and tone.",
    "Output format must be exactly:",
    "<translation>...translated text only...</translation>",
    "TEXT_START",
    text,
    "TEXT_END",
  ].join("\n");

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];
}

function extractTranslatedText(rawContent: string): string {
  const trimmed = rawContent.trim();
  const tagged = trimmed.match(/<translation>([\s\S]*?)<\/translation>/i);
  const extracted = tagged?.[1]?.trim() || trimmed;

  const withoutCodeFence = extracted
    .replace(/^```[a-zA-Z0-9_-]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();

  const withoutPrefix = withoutCodeFence.replace(
    /^(translation|translated text|translated|譯文|翻譯結果|结果|結果)\s*[:：]\s*/iu,
    "",
  );

  return withoutPrefix.replace(/^(["'“”‘’])|(["'“”‘’])$/gu, "").trim();
}

function isChineseTarget(targetLang: string): boolean {
  const normalized = targetLang.toLowerCase();
  return normalized.startsWith("zh");
}

function hasCjkCharacters(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function hasMostlyLatinWords(text: string): boolean {
  return /[A-Za-z]{3,}/.test(text);
}

function isLikelyUntranslated(
  sourceText: string,
  translatedText: string,
  targetLang: string,
): boolean {
  if (!isChineseTarget(targetLang)) {
    return false;
  }

  const source = sourceText.trim();
  const output = translatedText.trim();

  if (!source || !output) {
    return false;
  }

  if (source.length >= 20 && source.toLowerCase() === output.toLowerCase()) {
    return true;
  }

  if (
    source.length >= 20 &&
    source.includes(" ") &&
    hasMostlyLatinWords(output) &&
    !hasCjkCharacters(output)
  ) {
    return true;
  }

  return false;
}

/**
 * 呼叫 SiliconFlow Chat Completion API
 */
async function callChatCompletion(
  apiKey: string,
  request: ChatCompletionRequest,
  config: Required<SiliconFlowConfig>,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `SiliconFlow API error ${response.status}: ${response.statusText}\n${errorText}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No completion choices returned from API");
    }

    const messageContent = data.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error("Empty translation result from API");
    }

    const translatedText = extractTranslatedText(messageContent);
    if (!translatedText) {
      throw new Error("Empty translation result after normalization");
    }

    return translatedText;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`SiliconFlow API request timeout after ${config.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 使用 SiliconFlow API 翻譯文字
 *
 * @param request 翻譯請求參數
 * @returns 翻譯後的文字
 * @throws 如果 API 呼叫失敗
 */
export async function translateText(request: TranslateRequest): Promise<string> {
  const { apiKey, text, targetLang = "zh-CN", sourceLang, config: userConfig } = request;

  // 驗證輸入
  if (!apiKey) {
    throw new Error("API key is required");
  }

  if (!text || text.trim().length === 0) {
    return ""; // 空字串直接回傳
  }

  // 合併配置
  const config: Required<SiliconFlowConfig> = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  // 建立翻譯 prompt
  const messages = createTranslationPrompt(text, targetLang, sourceLang);

  // 建立請求
  const chatRequest: ChatCompletionRequest = {
    model: config.model,
    messages,
    temperature: config.temperature,
    stream: false,
  };

  // 執行翻譯（含重試）
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await callChatCompletion(apiKey, chatRequest, config);

      if (isLikelyUntranslated(text, result, targetLang)) {
        throw new Error("Model returned source-like text instead of translated output");
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果是最後一次嘗試，不再重試
      if (attempt === config.maxRetries) {
        break;
      }

      // 等待一段時間後重試（指數退避）
      const waitTime = Math.min(1000 * 2 ** attempt, 5000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // 所有重試都失敗
  throw new Error(
    `Translation failed after ${config.maxRetries + 1} attempts: ${lastError?.message}`,
  );
}

/**
 * 批次翻譯（將長文本分段處理）
 *
 * @param request 翻譯請求參數
 * @param maxChunkSize 每個分段的最大字數
 * @returns 翻譯後的文字
 */
export async function translateTextBatch(
  request: TranslateRequest,
  maxChunkSize = 1000,
): Promise<string> {
  const { text } = request;

  // 如果文本不長，直接翻譯
  if (text.length <= maxChunkSize) {
    return translateText(request);
  }

  // 分段翻譯
  const chunks: string[] = [];
  let currentChunk = "";

  // 按句子分割（簡單實現）
  const sentences = text.split(/([.!?。！？\n]+)/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // 逐段翻譯
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const translated = await translateText({
      ...request,
      text: chunk,
    });
    translatedChunks.push(translated);
  }

  return translatedChunks.join("");
}
