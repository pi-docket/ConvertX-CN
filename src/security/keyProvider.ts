import { createDecipheriv, pbkdf2 } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

interface WorkerResponse {
  encrypted_key: string;
  iv: string;
  expires_in: number;
}

let cachedKey: string | null = null;
let expireTime: number = 0;

const xorDecrypt = (hexData: string, key: string): string => {
  const data = Buffer.from(hexData, "hex").toString("utf8");
  return [...data]
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join("");
};

const WORKER_URL = xorDecrypt(
  "0b441a0640485b57005f0000560000004e53005b45130114171e5f440041464952025d174b0a5a0f0c42051341015a1c0646",
  "c0nv3rtx",
);

const ENCRYPTION_SECRET = xorDecrypt(
  "321e54630a451f3e14675837580177365c340f2877071e651b612c4a5a332d5b302b4b3f633267013c34574a",
  "s1l1c0nfl0w",
);

interface KeyProviderConfig {
  workerEndpoint?: string;
  encryptionKey?: string;
  timeout?: number;
  disableCache?: boolean;
}

const DEFAULT_CONFIG: KeyProviderConfig = {
  workerEndpoint: process.env.CONVERTX_WORKER_URL || WORKER_URL,
  encryptionKey: process.env.CONVERTX_ENCRYPTION_KEY || ENCRYPTION_SECRET,
  timeout: 10000,
};

async function fetchEncryptedKey(
  config: KeyProviderConfig = DEFAULT_CONFIG,
): Promise<WorkerResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

  try {
    const response = await fetch(config.workerEndpoint || WORKER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as WorkerResponse;

    if (!data.encrypted_key || !data.iv) {
      throw new Error("Invalid worker response: missing encrypted_key or iv");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Worker request timeout after ${config.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function decryptApiKey(
  encryptedData: string,
  iv: string,
  passphrase: string,
): Promise<string> {
  if (!passphrase) {
    throw new Error("Encryption passphrase is required");
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedData, "base64");
    const ivBuffer = Buffer.from(iv, "base64");

    const salt = Buffer.from("api-key-service-salt", "utf8");
    const key = await pbkdf2Async(passphrase, salt, 100000, 32, "sha256");

    const authTagLength = 16;
    const ciphertext = encryptedBuffer.subarray(0, -authTagLength);
    const authTag = encryptedBuffer.subarray(-authTagLength);

    const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(
      `Failed to decrypt API key: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getApiKey(config: KeyProviderConfig = DEFAULT_CONFIG): Promise<string> {
  const now = Date.now();
  const disableCache = config.disableCache === true;

  if (!disableCache && cachedKey && now < expireTime) {
    return cachedKey;
  }

  const encryptionKey = config.encryptionKey || ENCRYPTION_SECRET;
  if (!encryptionKey) {
    throw new Error("Encryption key is required for API key decryption");
  }

  const workerResponse = await fetchEncryptedKey({
    ...config,
    workerEndpoint: config.workerEndpoint || WORKER_URL,
  });

  const apiKey = await decryptApiKey(
    workerResponse.encrypted_key,
    workerResponse.iv,
    encryptionKey,
  );

  if (!apiKey || apiKey.length === 0) {
    throw new Error("Decrypted API key is empty");
  }

  if (!disableCache) {
    cachedKey = apiKey;
    expireTime = now + workerResponse.expires_in * 1000;
  }

  return apiKey;
}

export function clearApiKeyCache(): void {
  cachedKey = null;
  expireTime = 0;
}

export function clearApiKey(apiKey: string): void {
  void apiKey;
}
