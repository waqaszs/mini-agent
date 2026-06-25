import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts";
import boxen from "boxen";
import pc from "picocolors";
import { MODEL } from "./config";
import { createClient } from "./agent/anthropic";
import { runAgentTurn } from "./agent/loop";
import { discoverSkills } from "./skills/discover";
import type { Skill } from "./skills/types";

/** Project root (one level up from src/ in dev, or from dist/ once built). */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Read the version from package.json (rather than hardcoding it). */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** A small, original wordmark + status panel — its own visual identity. */
function renderBanner(skills: Skill[], version: string): string {
  const title = `${pc.cyan("◆")} ${pc.bold(pc.cyan("mini-agent"))} ${pc.dim(`v${version}`)}`;
  const tagline = pc.dim("a skill-aware coding agent · Agent Skills spec · Claude Sonnet");
  const skillsLine =
    skills.length > 0
      ? `${pc.dim("skills")}  ${skills.map((s) => pc.green(s.name)).join(pc.dim(" · "))}`
      : pc.yellow("no skills found in .skills/");
  const modelLine = `${pc.dim("model")}   ${pc.white(MODEL)}`;
  const content = [title, tagline, "", skillsLine, modelLine].join("\n");
  return boxen(content, { padding: 1, borderStyle: "round", borderColor: "cyan" });
}

/** Print the agent's reply, flagging any skill it activated (so matching is visible). */
function printReply(reply: string, activatedSkills: string[]): void {
  if (activatedSkills.length > 0) {
    log.step(pc.magenta(`◆ skill activated: ${activatedSkills.join(", ")}`));
  }
  log.message(reply);
}

/** Interactive REPL. */
async function runInteractive(skills: Skill[]): Promise<void> {
  const client = createClient();
  intro(pc.inverse(pc.bold(" mini-agent ")));
  log.info(pc.dim("Ask anything — a skill loads only when your prompt matches it. Type 'exit' to quit."));

  for (;;) {
    const input = await text({ message: "you", placeholder: "e.g. I'm new to this project, what should I do?" });
    if (isCancel(input)) {
      cancel("Goodbye.");
      return;
    }
    const prompt = input.trim();
    if (prompt === "") continue;
    if (prompt === "exit" || prompt === "quit") {
      outro("Goodbye.");
      return;
    }

    const progress = spinner();
    progress.start("thinking");
    try {
      const { text: reply, activatedSkills } = await runAgentTurn(client, skills, prompt);
      progress.stop(pc.dim("done"));
      printReply(reply, activatedSkills);
    } catch (err) {
      progress.stop(pc.red("error"));
      log.error(asMessage(err));
    }
  }
}

/** One-shot mode: run a single prompt and print the reply to stdout (handy for demos/evals). */
async function runOnce(skills: Skill[], prompt: string): Promise<void> {
  const client = createClient();
  const { text: reply, activatedSkills } = await runAgentTurn(client, skills, prompt);
  if (activatedSkills.length > 0) {
    process.stderr.write(pc.dim(`◆ skill activated: ${activatedSkills.join(", ")}\n`));
  }
  process.stdout.write(`${reply}\n`);
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const version = readVersion();
const program = new Command();

program
  .name("mini-agent")
  .description("A mini coding agent (CLI) that implements the open Agent Skills spec, powered by Claude Sonnet.")
  .version(version)
  .argument("[prompt]", "run a single prompt and exit; omit for interactive mode")
  .action(async (prompt?: string) => {
    const { skills, diagnostics } = discoverSkills(process.cwd());
    for (const d of diagnostics) {
      // Non-fatal skill issues go to stderr so they never pollute the agent's stdout reply.
      process.stderr.write(pc.dim(`[skills:${d.level}] ${d.message}\n`));
    }

    try {
      if (prompt && prompt.trim() !== "") {
        await runOnce(skills, prompt.trim());
      } else {
        console.log(renderBanner(skills, version));
        await runInteractive(skills);
      }
    } catch (err) {
      console.error(pc.red(`✖ ${asMessage(err)}`));
      process.exitCode = 1;
    }
  });

await program.parseAsync();
