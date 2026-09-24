/** Return the deployment owner's SiliconFlow key. No shared credential is bundled. */
export async function getApiKey(): Promise<string> {
  const key = process.env.SILICONFLOW_API_KEY?.trim();
  if (!key) {
    throw new Error("SILICONFLOW_API_KEY is required for SiliconFlow translation");
  }
  return key;
}
