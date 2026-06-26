import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgentTurn } from "../src/agent/loop";
import type { Skill } from "../src/skills/types";
import { SkillRegistry } from "../src/skills/registry";

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
      toolCall("Skill", { skill: "welcome-me" }),
      finalAnswer("> Welcome to our coding agent!\nHi there!"),
    ]);
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "I'm new here");

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
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "what's the weather?");
    expect(result.activatedSkills).toEqual([]);
    expect(result.text).toBe("It's sunny today.");
  });

  it("returns an error tool_result for an unknown skill name (no crash, no activation)", async () => {
    const { client, create } = makeClient([
      toolCall("Skill", { skill: "does-not-exist" }),
      finalAnswer("ok"),
    ]);
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "x");
    expect(result.activatedSkills).toEqual([]);
    expect(JSON.stringify(create.mock.calls[1])).toContain('"is_error":true');
  });

  it("rejects malformed tool input (no activation)", async () => {
    const { client } = makeClient([toolCall("Skill", { wrong: "field" }), finalAnswer("ok")]);
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "x");
    expect(result.activatedSkills).toEqual([]);
  });

  it("de-duplicates repeat activations of the same skill", async () => {
    const { client } = makeClient([
      toolCall("Skill", { skill: "welcome-me" }),
      toolCall("Skill", { skill: "welcome-me" }),
      finalAnswer("done"),
    ]);
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "x");
    expect(result.activatedSkills).toEqual(["welcome-me"]);
  });

  it("stops after the maximum number of turns if the model never finishes", async () => {
    const create = vi.fn().mockResolvedValue(toolCall("Skill", { skill: "welcome-me" }));
    const client = { messages: { create } } as unknown as Anthropic;
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "x");
    expect(result.text).toMatch(/maximum number of agent turns/i);
  });

  it("surfaces a message (not a blank line) when the model stops with no text", async () => {
    const { client } = makeClient([finalAnswer("", "refusal")]);
    const result = await runAgentTurn(client, new SkillRegistry([skill]), "x");
    expect(result.text).not.toBe("");
    expect(result.text.toLowerCase()).toContain("refusal");
  });

  it("passes no tools and activates nothing when there are no skills", async () => {
    const { client, create } = makeClient([finalAnswer("hello")]);
    const result = await runAgentTurn(client, new SkillRegistry([]), "hi");
    expect(result.activatedSkills).toEqual([]);
    const firstCall = create.mock.calls[0]?.[0] as { tools?: unknown };
    expect(firstCall.tools).toBeUndefined();
  });

  it("replays the assistant's tool_use turn before the tool_result (correct Anthropic pairing — no orphaned results)", async () => {
    const { client, create } = makeClient([
      toolCall("Skill", { skill: "welcome-me" }),
      finalAnswer("> Welcome to our coding agent!"),
    ]);
    await runAgentTurn(client, new SkillRegistry([skill]), "I'm new here");

    // The 2nd API call's history must be: [0] user prompt → [1] assistant WITH the tool_use →
    // [2] user WITH the tool_result, paired by the same tool_use_id (or the real API returns 400).
    const secondCall = create.mock.calls[1]?.[0] as {
      messages: Array<{ role: string; content: Array<{ type: string; id?: string; tool_use_id?: string }> | string }>;
    };
    const assistantTurn = secondCall.messages[1];
    const resultTurn = secondCall.messages[2];

    expect(assistantTurn?.role).toBe("assistant");
    const toolUse = (assistantTurn!.content as Array<{ type: string; id?: string }>).find((b) => b.type === "tool_use");
    expect(toolUse?.id).toBe("tu_1"); // the AI's call is replayed in history

    expect(resultTurn?.role).toBe("user");
    const result = (resultTurn!.content as Array<{ type: string; tool_use_id?: string }>)[0];
    expect(result?.type).toBe("tool_result");
    expect(result?.tool_use_id).toBe("tu_1"); // result paired to the matching tool_use
  });
});
