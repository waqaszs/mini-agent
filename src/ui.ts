import { log } from "@clack/prompts";
import boxen from "boxen";
import figlet from "figlet";
import pc from "picocolors";
import { MODEL } from "./config";
import type { SkillRegistry } from "./skills/registry";

/**
 * Presentation layer — everything the CLI prints lives here, kept apart from the agent logic
 * and the command wiring so each stays small and the "look" can change in one place.
 */

/** Below this terminal width we drop the ASCII art for a compact title (taste: width handling). */
const WIDE_TERMINAL = 60;

/**
 * The CLI name as a small ASCII-art wordmark (taste: an ASCII welcome banner), degrading
 * gracefully to a compact title on narrow terminals or if the figlet font can't be loaded.
 */
function wordmark(): string {
  const columns = process.stdout.columns ?? 80;
  if (columns >= WIDE_TERMINAL) {
    try {
      return figlet.textSync("mini-agent", { font: "Small" });
    } catch {
      // fall through to the compact form
    }
  }
  return "◆ mini-agent";
}

/** A small, original wordmark + status panel — its own visual identity. */
export function renderBanner(registry: SkillRegistry, version: string): string {
  const title = pc.cyan(wordmark());
  const tagline = pc.dim(`v${version}  ·  a skill-aware coding agent  ·  Agent Skills spec  ·  Claude Sonnet`);
  const skillsLine = registry.isEmpty
    ? pc.yellow("no skills found in .skills/")
    : `${pc.dim("skills")}  ${registry.names().map((name) => pc.green(name)).join(pc.dim(" · "))}`;
  const modelLine = `${pc.dim("model")}   ${pc.white(MODEL)}`;
  const content = [title, tagline, "", skillsLine, modelLine].join("\n");
  return boxen(content, { padding: 1, borderStyle: "round", borderColor: "cyan" });
}

/** Print the agent's reply, flagging any skill it activated (so the matching is visible). */
export function printReply(reply: string, activatedSkills: string[]): void {
  if (activatedSkills.length > 0) {
    log.step(pc.magenta(`◆ skill activated: ${activatedSkills.join(", ")}`));
  }
  log.message(reply);
}
