import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MAX_AGENT_TURNS, MAX_TOKENS, MODEL } from "../config";
import type { SkillRegistry } from "../skills/registry";
import { SKILL_TOOL_NAME, buildSkillTool, buildSystemPrompt, wrapSkillContent } from "./prompt";

/** Validate the Skill tool input before acting on it (never trust raw model input). */
const SkillToolInput = z.object({ skill: z.string() });

export interface AgentResult {
  /** The model's final text answer. */
  text: string;
  /** Names of skills activated during this turn, in order, de-duplicated. */
  activatedSkills: string[];
}

/**
 * Run one user turn through the agent loop (spec Steps 3–5).
 *
 * 1. Show the model the catalog (system prompt) + the enum-constrained `Skill` tool.
 * 2. If the model calls `Skill`, validate the name and inject THAT skill's body as the
 *    tool result, then loop. Otherwise return the model's text answer.
 *
 * Skill bodies enter context ONLY here, on activation — so an unrelated prompt
 * (e.g. "what's the weather?") never pulls a skill's instructions into context.
 */
export async function runAgentTurn(
  client: Anthropic,
  registry: SkillRegistry,
  userInput: string,
  history: Anthropic.MessageParam[] = [],
): Promise<AgentResult> {
  const system = buildSystemPrompt(registry.skills);
  const tools: Anthropic.Tool[] = registry.isEmpty ? [] : [buildSkillTool(registry.skills)];
  const activated: string[] = [];

  // The conversation history is caller-owned: an interactive session keeps memory across turns by
  // reusing the same array. Each new prompt is appended to everything that came before.
  const messages = history;
  messages.push({ role: "user", content: userInput });

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      ...(tools.length > 0 ? { tools } : {}),
      messages,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // No tool call → final answer. Append it so the NEXT turn remembers this exchange.
      messages.push({ role: "assistant", content: response.content });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      return { text: finalText(text, response.stop_reason), activatedSkills: dedupe(activated) };
    }

    // Echo the assistant's tool-use message, then answer each tool call.
    messages.push({ role: "assistant", content: response.content });
    const toolResults = toolUses.map((toolUse) => handleToolUse(toolUse, registry, activated));
    messages.push({ role: "user", content: toolResults });
  }

  return { text: "Stopped: reached the maximum number of agent turns.", activatedSkills: dedupe(activated) };
}

/** Resolve a single tool call into a `tool_result` block (activating the skill if the name is valid). */
function handleToolUse(
  toolUse: Anthropic.ToolUseBlock,
  registry: SkillRegistry,
  activated: string[],
): Anthropic.ToolResultBlockParam {
  if (toolUse.name !== SKILL_TOOL_NAME) {
    return { type: "tool_result", tool_use_id: toolUse.id, content: `Error: unknown tool "${toolUse.name}".`, is_error: true };
  }

  const parsed = SkillToolInput.safeParse(toolUse.input);
  if (!parsed.success) {
    return { type: "tool_result", tool_use_id: toolUse.id, content: "Error: the Skill tool requires a string 'skill'.", is_error: true };
  }

  const skill = registry.get(parsed.data.skill);
  if (!skill) {
    return { type: "tool_result", tool_use_id: toolUse.id, content: `Error: no skill named "${parsed.data.skill}".`, is_error: true };
  }

  activated.push(skill.name);
  return { type: "tool_result", tool_use_id: toolUse.id, content: wrapSkillContent(skill) };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Turn the model's text + stop reason into a user-facing reply, so we never return a silent
 * blank line. A refusal or an empty stop becomes an explicit note; a truncated reply is flagged.
 */
function finalText(text: string, stopReason: string | null): string {
  if (text === "") {
    return `(No reply — the model stopped with reason: ${stopReason ?? "unknown"}.)`;
  }
  if (stopReason === "max_tokens") {
    return `${text}\n\n[reply truncated at the output-token limit]`;
  }
  return text;
}
