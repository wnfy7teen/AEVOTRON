export const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    code: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyPrefix: "sk-",
    modelOwner: "OpenAI",
  }),
  groq: Object.freeze({
    code: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyPrefix: "gsk_",
    modelOwner: "Groq",
  }),
});

export function getProvider(providerCode) {
  return PROVIDERS[String(providerCode || "").toLowerCase()] || null;
}

export function isValidProviderCredential(providerCode, credential) {
  const provider = getProvider(providerCode);
  return Boolean(
    provider &&
    typeof credential === "string" &&
    credential.length >= 20 &&
    credential.length <= 500 &&
    credential.startsWith(provider.keyPrefix) &&
    !/\s/.test(credential),
  );
}

export function normalizeProviderModels(providerCode, models) {
  const provider = getProvider(providerCode);
  if (!provider || !Array.isArray(models)) return [];
  return models
    .filter((model) => {
      if (!model || typeof model.id !== "string" || model.active === false) return false;
      if (providerCode === "openai") return /^(gpt-|chatgpt-)/i.test(model.id);
      return !/(whisper|speech|transcription|tts|embed|guard)/i.test(model.id);
    })
    .map((model) => ({
      id: `${provider.code}/${model.id}`,
      provider_model_id: model.id,
      owned_by: model.owned_by || provider.modelOwner,
      provider_code: provider.code,
    }));
}
