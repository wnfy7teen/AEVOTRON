import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";

// Server-side TanStack AI adapter for the self-hosted OpenAI-compatible gateway.
// Configure an internal service API key in the server environment; never expose it to Vite.
export const gatewayModel = (model = "gpt-4o-mini") => {
  const baseURL = process.env.AEVOTRON_GATEWAY_URL || "http://backend:3001/v1";
  const apiKey = process.env.AEVOTRON_INTERNAL_API_KEY || "";
  if (!apiKey) throw new Error("AEVOTRON_INTERNAL_API_KEY is not configured.");
  return openaiCompatibleText(model, { name: "aevotron", baseURL, apiKey });
};
