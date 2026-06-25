import type Anthropic from "@anthropic-ai/sdk";
import type { Skill } from "../skills/types";

/**
 * Prompt construction — kept in pure, dependency-free functions so the exact text we send
 * to the model is easy to read, reuse, and unit-test (which is the heart of "skill matching").
 */

/** The dedicated tool the model calls to load a skill's full instructions. */
export const ACTIVATE_TOOL_NAME = "activate_skill";

/**
 * Build the system prompt (progressive disclosure — tier 1).
 *
 * It contains ONLY each skill's `name` + `description` (the "catalog") plus instructions on
 * when/how to activate a skill. Skill BODIES are deliberately never included here — they load
 * only when the model decides a skill is relevant and calls `activate_skill`.
 */
export function buildSystemPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return "You are a helpful coding agent. Answer the user's questions directly.";
  }

  const catalog = skills
    .map((s) => `  <skill>\n    <name>${escapeXml(s.name)}</name>\n    <description>${escapeXml(s.description)}</description>\n  </skill>`)
    .join("\n");

  return [
    "You are a helpful coding agent that can use specialized Skills.",
    "",
    "The following skills are available. Each lists what it does and when to use it:",
    "<available_skills>",
    catalog,
    "</available_skills>",
    "",
    `When the user's request matches a skill's description, call the \`${ACTIVATE_TOOL_NAME}\` tool with that skill's exact name to load its full instructions, then follow them precisely. ` +
      "Activate a skill even when the request is phrased casually or does not name the skill, as long as the description applies. " +
      "If no skill is relevant, just answer normally and do not call the tool. Never invent a skill name.",
  ].join("\n");
}

/**
 * Build the `activate_skill` tool, typed as the SDK's own `Anthropic.Tool` (no hand-rolled
 * duplicate). Its `name` parameter is constrained to the EXACT set of discovered skill names
 * (an enum), so the model cannot hallucinate a nonexistent skill.
 */
export function buildActivateSkillTool(skills: Skill[]): Anthropic.Tool {
  return {
    name: ACTIVATE_TOOL_NAME,
    description: "Load a skill's full instructions into context. Call this when the user's request matches a skill listed in <available_skills>.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: skills.map((s) => s.name),
          description: "The exact name of the skill to activate.",
        },
      },
      required: ["name"],
    },
  };
}

/**
 * Wrap an activated skill's body the way the spec suggests (Step 4 — "Structured wrapping"),
 * so the model can clearly tell skill instructions apart from the rest of the conversation.
 */
export function wrapSkillContent(skill: Skill): string {
  return `<skill_content name="${escapeXml(skill.name)}">\n${skill.body}\n</skill_content>\nSkill directory: ${skill.baseDir}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
