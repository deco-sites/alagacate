import { Mistral } from "npm:@mistralai/mistralai";
import { Turbopuffer } from "npm:@turbopuffer/turbopuffer";

export function formatNamespace(name: string) {
  return `site-${name}`;
}

export function setupTurbopuffer() {
  const { TURBOPUFFER_API_KEY } = Deno.env.toObject();

  if (!TURBOPUFFER_API_KEY) throw new Error("TURBOPUFFER_API_KEY is not set");

  return new Turbopuffer({
    apiKey: TURBOPUFFER_API_KEY,
    baseUrl: "https://gcp-us-east4.turbopuffer.com",
  });
}

export function setupMistral() {
  const { MISTRAL_API_KEY } = Deno.env.toObject();

  if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not set");

  return new Mistral({ apiKey: MISTRAL_API_KEY });
}
