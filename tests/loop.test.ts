import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgentTurn } from "../src/agent/loop";
import type { Skill } from "../src/skills/types";

/**
 * Offline tests for the agent loop, using a mocked Anthropic client. These exercise the
 * deterministic activation branches (right skill, unknown skill, bad input, de-dup, turn cap,
 * empty reply) WITHOUT any paid API call — the live behaviour is covered separately by the eval.
 */

const skill: Skill = {
  name: "welcome-me",
  description: "Greet new users.",
  body: "WELCOME_BODY_MARKER",
  location: "/x/welcome-me/SKILL.md",
  baseDir: "/x/welcome-me",
  source: "test",
};

/** Build a fake client whose `messages.create` returns the given responses in order. */
function makeClient(responses: unknown[]) {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

const toolCall = (name: string, input: unknown) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "tu_1", name, input }],
});
const finalAnswer = (text: string, stop_reason = "end_turn") => ({
  stop_reason,
  content: [{ type: "text", text }],
});

describe("runAgentTurn (mocked client)", () => {
  it("activates the matched skill, injects its body, and returns the final answer", async () => {
    const { client, create } = makeClient([
      toolCall("activate_skill", { name: "welcome-me" }),
      finalAnswer("> Welcome to our coding agent!\nHi there!"),
    ]);
    const result = await runAgentTurn(client, [skill], "I'm new here");

    expect(result.activatedSkills).toEqual(["welcome-me"]);
    expect(result.text).toContain("> Welcome to our coding agent!");
    // The body is injected as a tool_result (activation); the system prompt / catalog never
    // carries it. (The no-leak guarantee is also covered deterministically in prompt.test.ts.)
    expect(JSON.stringify(create.mock.calls[1])).toContain("WELCOME_BODY_MARKER");
    const firstCall = create.mock.calls[0]?.[0] as { system: string } | undefined;
    expect(firstCall?.system).not.toContain("WELCOME_BODY_MARKER");
  });

  it("returns no activation when the model answers directly (unrelated prompt)", async () => {
    const { client } = makeClient([finalAnswer("It's sunny today.")]);
    const result = await runAgentTurn(client, [skill], "what's the weather?");
    expect(result.activatedSkills).toEqual([]);
    expect(result.text).toBe("It's sunny today.");
  });

  it("returns an error tool_result for an unknown skill name (no crash, no activation)", async () => {
    const { client, create } = makeClient([
      toolCall("activate_skill", { name: "does-not-exist" }),
      finalAnswer("ok"),
    ]);
    const result = await runAgentTurn(client, [skill], "x");
    expect(result.activatedSkills).toEqual([]);
    expect(JSON.stringify(create.mock.calls[1])).toContain('"is_error":true');
  });

  it("rejects malformed tool input (no activation)", async () => {
    const { client } = makeClient([toolCall("activate_skill", { wrong: "field" }), finalAnswer("ok")]);
    const result = await runAgentTurn(client, [skill], "x");
    expect(result.activatedSkills).toEqual([]);
  });

  it("de-duplicates repeat activations of the same skill", async () => {
    const { client } = makeClient([
      toolCall("activate_skill", { name: "welcome-me" }),
      toolCall("activate_skill", { name: "welcome-me" }),
      finalAnswer("done"),
    ]);
    const result = await runAgentTurn(client, [skill], "x");
    expect(result.activatedSkills).toEqual(["welcome-me"]);
  });

  it("stops after the maximum number of turns if the model never finishes", async () => {
    const create = vi.fn().mockResolvedValue(toolCall("activate_skill", { name: "welcome-me" }));
    const client = { messages: { create } } as unknown as Anthropic;
    const result = await runAgentTurn(client, [skill], "x");
    expect(result.text).toMatch(/maximum number of agent turns/i);
  });

  it("surfaces a message (not a blank line) when the model stops with no text", async () => {
    const { client } = makeClient([finalAnswer("", "refusal")]);
    const result = await runAgentTurn(client, [skill], "x");
    expect(result.text).not.toBe("");
    expect(result.text.toLowerCase()).toContain("refusal");
  });
});
