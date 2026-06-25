# mini-agent

A mini coding agent — a **Node.js CLI** (TypeScript) that implements the open [Agent Skills](https://agentskills.io) specification, powered by **Claude's Sonnet** model.

The agent discovers **skills** under `.skills/`, shows the model a lightweight **catalog** (just each skill's `name` + `description`), and loads a skill's **full instructions only when the user's prompt matches it** — the spec's *progressive disclosure*. That "load the right skill at the right time, and nothing when nothing matches" behaviour is the core of the tool.

## Quick start

```bash
pnpm install
cp .env.example .env          # paste your ANTHROPIC_API_KEY (a budget-capped key is provided with the submission)
pnpm dev                      # interactive mode
```

Or run a single prompt (one-shot mode):

```bash
pnpm dev "I'm new to this project, what should I do"
```

## Try these prompts

| Prompt | What happens |
| --- | --- |
| `I'm new to this project, what should I do` | activates **welcome-me** → reply begins with `> Welcome to our coding agent!` |
| `create a changelog from the recent commits` | activates **changelog-generator** |
| `set up an isolated git worktree for a new feature` | activates **using-git-worktrees** |
| `what's the weather?` | **no skill loaded** — the agent just answers |

The CLI prints a `◆ skill activated: …` line whenever a skill is used, so the matching is visible.

## How it works (the spec, in this codebase)

It follows the [Agent Skills client-implementation guide](https://agentskills.io/client-implementation/adding-skills-support) step by step:

| Spec step | Code |
| --- | --- |
| 1 · Discover | `src/skills/discover.ts` — scans `.skills/` (and `.agents/skills/`) for `SKILL.md` directories, with precedence + shadowing |
| 2 · Parse | `src/skills/parse.ts` — splits frontmatter/body, validates with Zod, stays lenient (missing description → skip) |
| 3 · Disclose | `src/agent/prompt.ts` — builds the `<available_skills>` catalog (name + description **only**) |
| 4 · Activate | `src/agent/loop.ts` — model calls the `activate_skill` tool (its `name` is an **enum** of real skills); only then is that skill's body injected |
| 5 · Manage | `src/agent/loop.ts` — de-duplicates repeat activations within a turn |

Because a skill's body enters context **only on activation**, an unrelated prompt never pulls a skill's instructions into context.

## Project structure

```
mini-agent/
├── .skills/
│   ├── welcome-me/SKILL.md           # authored for this project
│   ├── changelog-generator/SKILL.md  # from CommandCodeAI/agent-skills
│   └── using-git-worktrees/SKILL.md  # from CommandCodeAI/agent-skills
├── src/
│   ├── cli.ts                        # the CLI / TUI (interactive + one-shot)
│   ├── config.ts                     # model + spend-bounding caps
│   ├── skills/{types,parse,discover}.ts
│   └── agent/{prompt,anthropic,loop}.ts
├── scripts/{eval.ts,eval-queries.json}   # live trigger-eval
└── tests/                            # unit tests
```

## Testing

```bash
pnpm test        # unit tests (offline): parsing, discovery, catalog, prompt construction
pnpm eval        # LIVE trigger-eval — runs prompts through the model and checks the right skill
                 # activates (and none for unrelated prompts). Set EVAL_RUNS=3 to average runs.
pnpm typecheck   # tsc --noEmit
```

The unit tests assert (among other things) that the catalog **never leaks skill bodies**, that the `activate_skill` tool is enum-constrained, and that welcome-me carries the exact required header.

## Security

- The API key is read **only** from `process.env.ANTHROPIC_API_KEY` — never hardcoded; `.env` is gitignored.
- Tool input is validated (Zod) before use; the tool's `name` is constrained to the real skill set.
- Spend is bounded per call (`max_tokens`) and per turn (`MAX_AGENT_TURNS`) in `src/config.ts`.

---

## Submission notes

**Time spent:** _(fill in your actual hours before submitting)_

**Challenges / what was interesting:**

- **Getting "matching" right *is* the assignment.** The naive approach — putting every skill's full `SKILL.md` into the prompt — would pass the happy path but fail the requirement that an unrelated prompt (`what's the weather?`) must **not** load a skill into context. Implementing the spec's *progressive disclosure* (a name+description catalog up front, and the body loaded only when the model calls `activate_skill`) is what makes that work.
- **A real gotcha in the skill itself.** Command Code's *own* published `welcome-me` skill (in `CommandCodeAI/agent-skills`) specifies a different header than this assignment's instructions. I followed the **assignment's** required header (`> Welcome to our coding agent!`) and authored my own `welcome-me`, rather than copying the published one.
- **Making a generic ask trigger reliably.** "What should I do?" is something the model can answer on its own, so it might *not* reach for a skill. I wrote welcome-me's `description` to be imperative and project-specific so it fires on newcomer prompts — but tuned it (and verified with the eval) so a near-miss like *"I'm new to Rust"* does **not** trigger it.
- **Forcing an exact output string from an LLM.** The header has to be byte-exact, so the skill body states it as a hard requirement; a unit test guards it and the live eval confirms it.

**Demo instructions:** `pnpm install && cp .env.example .env` (add the key), then `pnpm dev`. Test prompts: `I'm new to this project, what should I do` (→ welcome header), `create a changelog from recent commits` (→ changelog skill), `what's the weather?` (→ no skill).
