import { log } from "@clack/prompts";
import boxen from "boxen";
import pc from "picocolors";
import { MODEL } from "./config";
import type { SkillRegistry } from "./skills/registry";

/**
 * Presentation layer — everything the CLI prints lives here, kept apart from the agent logic
 * and the command wiring so each stays small and the "look" can change in one place.
 */

/** Who built it — shown in the banner. */
const AUTHOR = "Waqas Haider · engr.waqashaider@gmail.com";

/** A clean, readable wordmark + status panel (its own identity — no garbled ASCII art). */
export function renderBanner(registry: SkillRegistry, version: string): string {
  const title = `${pc.cyan("◆")} ${pc.bold(pc.cyan("mini-agent"))} ${pc.dim(`v${version}`)}`;
  const tagline = pc.dim("a skill-aware coding agent · Agent Skills spec · Claude Sonnet");
  const author = pc.dim(`by ${AUTHOR}`);
  const skillsLine = registry.isEmpty
    ? pc.yellow("no skills found in .skills/")
    : `${pc.dim("skills")}  ${registry.names().map((name) => pc.green(name)).join(pc.dim(" · "))}`;
  const modelLine = `${pc.dim("model")}   ${pc.white(MODEL)}`;
  const content = [title, tagline, author, "", skillsLine, modelLine].join("\n");
  return boxen(content, { padding: 1, borderStyle: "round", borderColor: "cyan" });
}

/** Print the agent's reply, flagging any skill it activated (so the matching is visible). */
export function printReply(reply: string, activatedSkills: string[]): void {
  if (activatedSkills.length > 0) {
    log.step(pc.magenta(`◆ skill activated: ${activatedSkills.join(", ")}`));
  }
  log.message(reply);
}
