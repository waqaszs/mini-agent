import Anthropic from "@anthropic-ai/sdk";

/**
 * Create the Anthropic client.
 *
 * Security: the API key is read ONLY from the environment (`ANTHROPIC_API_KEY`) and is never
 * hardcoded or logged. We fail fast with an actionable message if it's missing.
 */
export function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n" +
        "  → Copy .env.example to .env and paste your key, or run: export ANTHROPIC_API_KEY=sk-ant-...",
    );
  }
  return new Anthropic({ apiKey });
}
