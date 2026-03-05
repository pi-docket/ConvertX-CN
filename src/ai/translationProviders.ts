import {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../helpers/translation/types";
import {
  OPENAI_API_KEY,
  DEEPSEEK_API_KEY,
  CUSTOM_LLM_BASE_URL,
  OTHER_LLM_API_KEY,
} from "../helpers/env";

class OpenAITranslationProvider implements TranslationProvider {
  readonly type = "openai";
  readonly name = "OpenAI";

  async isAvailable(): Promise<boolean> {
    return OPENAI_API_KEY.length > 0;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const start = Date.now();
    const systemPrompt = `Translate the following text to ${request.targetLang}. Only output the translation, no explanations or notes.`;
    const userPrompt = request.text;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const translated = data.choices[0]?.message?.content || "";

    return {
      translatedText: translated.trim(),
      detectedLang: request.sourceLang,
      elapsedMs: Date.now() - start,
      provider: "openai",
    };
  }
}

class DeepSeekTranslationProvider implements TranslationProvider {
  readonly type = "deepseek";
  readonly name = "DeepSeek";

  async isAvailable(): Promise<boolean> {
    return DEEPSEEK_API_KEY.length > 0;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    const start = Date.now();
    const systemPrompt = `Translate the following text to ${request.targetLang}. Only output the translation, no explanations or notes.`;
    const userPrompt = request.text;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const translated = data.choices[0]?.message?.content || "";

    return {
      translatedText: translated.trim(),
      detectedLang: request.sourceLang,
      elapsedMs: Date.now() - start,
      provider: "deepseek",
    };
  }
}

class CustomTranslationProvider implements TranslationProvider {
  readonly type = "custom";
  readonly name = "Custom LLM";

  async isAvailable(): Promise<boolean> {
    return CUSTOM_LLM_BASE_URL.length > 0;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!CUSTOM_LLM_BASE_URL) {
      throw new Error("CUSTOM_LLM_BASE_URL is not configured");
    }

    const start = Date.now();
    const systemPrompt = `Translate the following text to ${request.targetLang}. Only output the translation, no explanations or notes.`;
    const userPrompt = request.text;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (OTHER_LLM_API_KEY) {
      headers["Authorization"] = `Bearer ${OTHER_LLM_API_KEY}`;
    }

    const response = await fetch(`${CUSTOM_LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "default",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const translated = data.choices[0]?.message?.content || "";

    return {
      translatedText: translated.trim(),
      detectedLang: request.sourceLang,
      elapsedMs: Date.now() - start,
      provider: "custom",
    };
  }
}

export { OpenAITranslationProvider, DeepSeekTranslationProvider, CustomTranslationProvider };
