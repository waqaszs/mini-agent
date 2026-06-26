import { log } from "@clack/prompts";
import boxen from "boxen";
import { render } from "cfonts";
import pc from "picocolors";
import { MODEL } from "./config";
import type { SkillRegistry } from "./skills/registry";

/**
 * Presentation layer — everything the CLI prints lives here, kept apart from the agent logic
 * and the command wiring so each stays small and the "look" can change in one place.
 */

/** Who built it — shown in the banner. */
const AUTHOR = "Waqas Haider · engr.waqashaider@gmail.com";

/**
 * The "mini-agent" wordmark as a clean ASCII logo. Uses cfonts' bold `block` font on wide
 * terminals and the narrower `simple` font otherwise (so it never wraps), with a plain-text
 * fallback if cfonts can't render for any reason.
 */
function logo(): string {
  const columns = process.stdout.columns ?? 80;
  const font = columns >= 95 ? "block" : "simple";
  try {
    const rendered = render("mini-agent", { font, colors: ["cyan"], space: false });
    if (rendered && rendered.string) {
      return rendered.string.replace(/^\n+|\n+$/g, "");
    }
  } catch {
    // fall through to the plain-text fallback
  }
  return pc.bold(pc.cyan("◆ mini-agent"));
}

/** The startup banner: ASCII wordmark + version, author, skills, and model. */
export function renderBanner(registry: SkillRegistry, version: string): string {
  const tagline = pc.dim(`v${version}  ·  a skill-aware coding agent  ·  Agent Skills spec  ·  Claude Sonnet`);
  const author = pc.dim(`by ${AUTHOR}`);
  const skillsLine = registry.isEmpty
    ? pc.yellow("no skills found in .skills/")
    : `${pc.dim("skills")}  ${registry.names().map((name) => pc.green(name)).join(pc.dim(" · "))}`;
  const modelLine = `${pc.dim("model")}   ${pc.white(MODEL)}`;
  const content = [logo(), "", tagline, author, "", skillsLine, modelLine].join("\n");
  return boxen(content, { padding: 1, borderStyle: "round", borderColor: "cyan" });
}

/** Print the agent's reply, flagging any skill it activated (so the matching is visible). */
export function printReply(reply: string, activatedSkills: string[]): void {
  if (activatedSkills.length > 0) {
    log.step(pc.magenta(`◆ skill activated: ${activatedSkills.join(", ")}`));
  }
  log.message(reply);
}
