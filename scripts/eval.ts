import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { createClient } from "../src/agent/anthropic";
import { runAgentTurn } from "../src/agent/loop";
import { SkillRegistry } from "../src/skills/registry";

/**
 * Live trigger-eval (spec: "Designing trigger eval queries").
 *
 * Runs a set of prompts through the real agent and checks that the RIGHT skill activates —
 * and that unrelated prompts activate NONE. This is how we verify the skill descriptions
 * (i.e. the prompts we send to the model) actually match as intended.
 *
 * Costs a few model calls. Set EVAL_RUNS to average over multiple runs (the spec suggests 3
 * because model behaviour is non-deterministic); a query passes if it behaves as expected in
 * more than half of its runs.
 */
interface EvalQuery {
  query: string;
  /** Expected skill name, or null = no skill should activate. */
  expect: string | null;
}

const WELCOME_HEADER = "> Welcome to our coding agent!";
const RUNS = Math.max(1, Number(process.env.EVAL_RUNS ?? 1));
const THRESHOLD = 0.5;

/** Did this single run behave as the query expects? */
function behavedAsExpected(query: EvalQuery, activatedSkills: string[], reply: string): boolean {
  if (query.expect === null) {
    return activatedSkills.length === 0; // unrelated prompt → no skill should load
  }
  // A positive case must activate EXACTLY the expected skill — nothing missing, nothing extra.
  if (activatedSkills.length !== 1 || activatedSkills[0] !== query.expect) {
    return false;
  }
  // welcome-me must additionally emit the exact required header.
  if (query.expect === "welcome-me") {
    return reply.includes(WELCOME_HEADER);
  }
  return true;
}

async function main(): Promise<void> {
  const queries = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", "eval-queries.json"), "utf8"),
  ) as EvalQuery[];

  const registry = SkillRegistry.fromProject(process.cwd());
  const client = createClient();

  console.log(pc.bold(`Running ${queries.length} trigger evals × ${RUNS} run(s)…\n`));

  let passed = 0;
  for (const query of queries) {
    let hits = 0;
    for (let i = 0; i < RUNS; i++) {
      const { activatedSkills, text } = await runAgentTurn(client, registry, query.query);
      if (behavedAsExpected(query, activatedSkills, text)) hits++;
    }
    const rate = hits / RUNS;
    const pass = rate > THRESHOLD;
    if (pass) passed++;

    const tag = pass ? pc.bgGreen(pc.black(" PASS ")) : pc.bgRed(pc.black(" FAIL "));
    const expectLabel = query.expect ?? pc.dim("∅ no skill");
    console.log(`${tag} ${pc.dim(`rate ${rate.toFixed(2)}`)}  → ${expectLabel}  ${pc.dim(`«${query.query}»`)}`);
  }

  const summary = `${passed}/${queries.length} passed (threshold ${THRESHOLD}, ${RUNS} run(s) each)`;
  console.log(`\n${passed === queries.length ? pc.green(`✓ ${summary}`) : pc.red(`✗ ${summary}`)}`);
  process.exitCode = passed === queries.length ? 0 : 1;
}

main().catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
